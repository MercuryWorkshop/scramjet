type Description = {
	context?: object;
	props?: object;
};

type Callback<T extends Description> = (
	context: T["context"],
	props: T["props"]
) => void | Promise<void>;

type Sorter = (other: Plugin) => number;

type CallbackInfo<T extends Description> = {
	callback: Callback<T>;
	plugin: Plugin;
	sorter: Sorter;
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

export class Plugin {
	constructor(public name: string) {}

	tap<T extends Description>(
		hook: T,
		callback: Callback<T>,
		sorter?: Sorter
	): void {
		sorter ??= () => 0;
		Tap.tap(hook, callback, this, sorter);
	}
}

export class Tap {
	static dispatch<T extends Description>(
		hook: T,
		context: T["context"],
		props: T["props"]
	): Promise<void[]> {
		let internal = hook as unknown as InternalHookDescription;
		let callbacks = internal.tap.callbacks[internal.key];
		if (!callbacks || callbacks.length === 0) return;

		callbacks = [...callbacks];
		callbacks.sort((a, b) => a.sorter(b.plugin));

		const results = callbacks.map((cb) => cb.callback(context, props));
		return Promise.all(results);
	}

	static tap<T extends Description>(
		hook: T,
		callback: Callback<T>,
		plugin: Plugin,
		sorter: Sorter
	) {
		let internal = hook as unknown as InternalHookDescription;
		let callbacks = internal.tap.callbacks;
		if (!callbacks[internal.key]) callbacks[internal.key] = [];
		callbacks[internal.key]!.push({
			callback,
			plugin,
			sorter,
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
}
