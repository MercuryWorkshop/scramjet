import { Promise_all } from "@/shared/snapshot";

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

function sortCallbacks<T extends Description>(
	callbacks: CallbackInfo<T>[]
): CallbackInfo<T>[] {
	const afters: Record<string, string[]> = {};
	for (const callback of callbacks) {
		if (callback.order.before) {
			for (const before of callback.order.before) {
				afters[before] ??= [];
				if (!afters[before].includes(callback.plugin.name)) {
					afters[before].push(callback.plugin.name);
				}
			}
		}
		if (callback.order.after) {
			for (const after of callback.order.after) {
				afters[callback.plugin.name] ??= [];
				if (!afters[callback.plugin.name].includes(after)) {
					afters[callback.plugin.name].push(after);
				}
			}
		}
	}

	const sorted: CallbackInfo<T>[] = [];
	function recurse(callback: CallbackInfo<T>, visited: string[]) {
		if (afters[callback.plugin.name]) {
			for (const after of afters[callback.plugin.name]) {
				if (visited.includes(after)) {
					throw `Circular dependency detected: ${callback.plugin.name} -> ${after}. Using append order.`;
				}
				const afterCallback = callbacks.find((c) => c.plugin.name === after);
				if (afterCallback) {
					recurse(afterCallback, [...visited, callback.plugin.name]);
				}
			}
		}
		if (!sorted.includes(callback)) {
			sorted.push(callback);
		}
	}

	try {
		for (const callback of callbacks) {
			recurse(callback, []);
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
		let callbacks = internal.tap.callbacks[internal.key];
		if (!callbacks || callbacks.length === 0) return null;

		callbacks = sortCallbacks([...callbacks] as CallbackInfo<T>[]);

		const results = callbacks.map((cb) => cb.callback(context, props));
		return Promise_all(results);
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
		callbacks[internal.key]!.push({
			callback,
			plugin,
			order,
		});
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
		return internal.tap.callbacks[internal.key].map((c) => c.plugin);
	}
}
