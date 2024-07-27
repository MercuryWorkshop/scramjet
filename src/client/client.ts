import { createLocationProxy } from "./location";
import { decodeUrl } from "./shared";
import { createDocumentProxy, createWindowProxy } from "./window";

declare global {
	interface Window {
		$s: any;
		$tryset: any;
		$sImport: any;
	}
}

//eslint-disable-next-line
type AnyFunction = Function;

type ProxyCtx = {
	fn: AnyFunction;
	this: any;
	args: any[];
	newTarget: AnyFunction;
	return: (r: any) => void;
};
type Proxy = {
	construct?(ctx: ProxyCtx): any;
	apply?(ctx: ProxyCtx): any;
};

type TrapCtx<T> = {
	this: any;
	get: () => T;
	set: (v: T) => void;
};
type Trap<T> = {
	writable?: boolean;
	value?: any;
	enumerable?: boolean;
	configurable?: boolean;
	get?: (ctx: TrapCtx<T>) => T;
	set?: (ctx: TrapCtx<T>, v: T) => void;
};

export class ScramjetClient {
	static SCRAMJET = Symbol.for("scramjet client global");

	documentProxy: any;
	windowProxy: any;
	locationProxy: any;

	constructor(public global: typeof globalThis) {
		if ("document" in self) {
			this.documentProxy = createDocumentProxy(this, global);
		}

		this.locationProxy = createLocationProxy(this, global);
		this.windowProxy = createWindowProxy(this, global);

		global[ScramjetClient.SCRAMJET] = this;
	}

	hook() {
		dbg.log("hwat");

		// @ts-ignore
		const context = import.meta.webpackContext(".", {
			recursive: true,
		});

		for (const key of context.keys()) {
			if (!key.endsWith(".ts")) continue;
			if (
				(key.startsWith("./dom/") && "window" in self) ||
				(key.startsWith("./worker/") && "WorkerGlobalScope" in self) ||
				key.startsWith("./shared/")
			) {
				console.log("??", key);
				const module = context(key);
				module.default(this, this.global);
			}
		}
	}

	Proxy(name: string | string[], handler: Proxy) {
		if (Array.isArray(name)) {
			for (const n of name) {
				this.Proxy(n, handler);
			}

			return;
		}

		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], this.global);
		this.RawProxy(target, prop, handler);
	}
	RawProxy(target: any, prop: string, handler: Proxy) {
		if (!target) return;
		if (!prop) return;
		if (!Reflect.has(target, prop)) return;

		const value = Reflect.get(target, prop);
		delete target[prop];

		const h: ProxyHandler<any> = {};

		if (handler.construct) {
			h.construct = function (
				constructor: any,
				argArray: any[],
				newTarget: AnyFunction
			) {
				let returnValue: any = null;

				const ctx: ProxyCtx = {
					fn: constructor,
					this: null,
					args: argArray,
					newTarget: newTarget,
					return: (r: any) => {
						returnValue = r;
					},
				};

				handler.construct(ctx);

				if (returnValue) {
					return returnValue;
				}

				return Reflect.construct(ctx.fn, ctx.args, ctx.newTarget);
			};
		}

		if (handler.apply) {
			h.apply = function (fn: any, thisArg: any, argArray: any[]) {
				let returnValue: any = null;

				const ctx: ProxyCtx = {
					fn,
					this: thisArg,
					args: argArray,
					newTarget: null,
					return: (r: any) => {
						returnValue = r;
					},
				};

				handler.apply(ctx);

				if (returnValue) {
					return returnValue;
				}

				return Reflect.apply(ctx.fn, ctx.this, ctx.args);
			};
		}

		target[prop] = new Proxy(value, h);
	}
	Trap<T>(name: string | string[], descriptor: Trap<T>) {
		if (Array.isArray(name)) {
			for (const n of name) {
				this.Trap(n, descriptor);
			}

			return;
		}

		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], this.global);

		this.RawTrap(target, prop, descriptor);
	}
	RawTrap<T>(target: any, prop: string, descriptor: Trap<T>) {
		if (!target) return;
		if (!prop) return;
		if (!Reflect.has(target, prop)) return;

		const oldDescriptor = Object.getOwnPropertyDescriptor(target, prop);

		const ctx: TrapCtx<T> = {
			this: null,
			get: function () {
				return oldDescriptor && oldDescriptor.get.call(this.this);
			},
			set: function (v: T) {
				oldDescriptor && oldDescriptor.set.call(this.this, v);
			},
		};

		delete target[prop];

		const desc: PropertyDescriptor = {};

		if (descriptor.get) {
			desc.get = function () {
				ctx.this = this;

				return descriptor.get(ctx);
			};
		} else if (oldDescriptor?.get) {
			desc.get = oldDescriptor.get;
		}

		if (descriptor.set) {
			desc.set = function (v: T) {
				ctx.this = this;

				descriptor.set(ctx, v);
			};
		} else if (oldDescriptor?.set) {
			desc.set = oldDescriptor.set;
		}

		if (descriptor.enumerable) desc.enumerable = descriptor.enumerable;
		else if (oldDescriptor?.enumerable)
			desc.enumerable = oldDescriptor.enumerable;
		if (descriptor.configurable) desc.configurable = descriptor.configurable;
		else if (oldDescriptor?.configurable)
			desc.configurable = oldDescriptor.configurable;

		Object.defineProperty(target, prop, desc);
	}

	get url(): URL {
		return new URL(decodeUrl(location.href));
	}
}
