import {
	Array_includes,
	Array_map,
	Object_create,
	Promise_all,
	drain,
} from "@/shared/snapshot";

type Description = {
	context?: object;
	props?: object;
};

type Callback<T extends Description> = (
	context: T["context"],
	props: T["props"]
) => void | Promise<void>;

export type TapOrder = {
	/** Run before these plugins. */
	before?: readonly string[];
	/** Run after these plugins. */
	after?: readonly string[];
};

type CallbackInfo<T extends Description> = {
	callback: Callback<T>;
	plugin: Plugin;
	order: TapOrder;
};

type InternalHookDescription = {
	tap: TapInternal;
	key: string;
};

type TapInternal = {
	callbacks: Record<string, CallbackInfo<Description>[]>;
};

export type TapInstance<T extends Record<string, Description>> = {
	[K in keyof T]: T[K] & InternalHookDescription;
};

function mergeTapOrder(plugin: Plugin, order?: TapOrder): TapOrder {
	return {
		before: order?.before ?? plugin.tapOrder.before,
		after: order?.after ?? plugin.tapOrder.after,
	};
}

/**
 * Order `callbacks` so each runs after the plugins it names in `after`, and
 * before the ones it names in `before`.
 *
 * Dispatch happens in the page realm - every navigation and `pushState` goes
 * through here - so this sticks to `drain` and indexed writes: `for...of`,
 * spread and the `Array.prototype` methods all reach intrinsics the page can
 * replace, and with them which hooks run, in what order.
 */
function sortCallbacks<T extends Description>(
	callbacks: CallbackInfo<T>[]
): CallbackInfo<T>[] {
	const afters: Record<string, string[]> = Object_create(null);
	const addAfter = (plugin: string, after: string) => {
		const list = (afters[plugin] ??= []);
		if (!Array_includes(list, after)) list[list.length] = after;
	};
	for (const callback of drain(callbacks)) {
		if (callback.order.before) {
			for (const before of drain(callback.order.before)) {
				addAfter(before, callback.plugin.name);
			}
		}
		if (callback.order.after) {
			for (const after of drain(callback.order.after)) {
				addAfter(callback.plugin.name, after);
			}
		}
	}

	const byName = (name: string) => {
		for (const callback of drain(callbacks)) {
			if (callback.plugin.name === name) return callback;
		}

		return undefined;
	};

	const sorted: CallbackInfo<T>[] = [];
	// the chain of plugins being placed, innermost last
	const visiting: string[] = [];
	function recurse(callback: CallbackInfo<T>) {
		const name = callback.plugin.name;
		if (afters[name]) {
			visiting[visiting.length] = name;
			for (const after of drain(afters[name])) {
				if (Array_includes(visiting, after)) {
					throw `Circular dependency detected: ${name} -> ${after}. Using append order.`;
				}
				const afterCallback = byName(after);
				if (afterCallback) recurse(afterCallback);
			}
			visiting.length--;
		}
		if (!Array_includes(sorted, callback)) sorted[sorted.length] = callback;
	}

	try {
		for (const callback of drain(callbacks)) {
			recurse(callback);
		}
		return sorted;
	} catch (err) {
		dbg.error("an error occurred:", err);
		return sorted;
	}
}

export class Plugin {
	constructor(
		public name: string,
		public readonly tapOrder: TapOrder = {}
	) {}

	tap<T extends Description>(
		hook: T,
		callback: Callback<T>,
		order?: TapOrder
	): void {
		Tap.tap(hook, callback, this, mergeTapOrder(this, order));
	}
}

export class Tap {
	static dispatch<T extends Description>(
		hook: T,
		context: T["context"],
		props: T["props"]
	): Promise<void[]> | null {
		const internal = hook as unknown as InternalHookDescription;
		const callbacks = internal.tap.callbacks[internal.key];
		if (!callbacks || callbacks.length === 0) return null;

		const sorted = sortCallbacks(callbacks as CallbackInfo<T>[]);

		return Promise_all(Array_map(sorted, (cb) => cb.callback(context, props)));
	}

	static tap<T extends Description>(
		hook: T,
		callback: Callback<T>,
		plugin: Plugin = new Plugin("anonymous"),
		order: TapOrder = {}
	) {
		const internal = hook as unknown as InternalHookDescription;
		const callbacks = internal.tap.callbacks;
		if (!callbacks[internal.key]) callbacks[internal.key] = [];
		const list = callbacks[internal.key]!;
		list[list.length] = { callback, plugin, order };
	}

	static create<T extends Record<string, Description>>(): TapInstance<T> {
		const internal: TapInternal = {
			callbacks: {},
		};
		const hooks: Record<string, InternalHookDescription> = {};

		return new Proxy(internal as unknown as TapInstance<T>, {
			get(target, key: string) {
				if (key === "callbacks") return internal.callbacks;
				if (!hooks[key]) {
					hooks[key] = { tap: internal, key };
				}
				return hooks[key];
			},
		});
	}

	static getTappers<T extends Description>(hook: T): Plugin[] {
		const internal = hook as unknown as InternalHookDescription;
		return Array_map(internal.tap.callbacks[internal.key], (c) => c.plugin);
	}
}
