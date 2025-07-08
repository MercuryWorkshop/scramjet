import { iswindow } from ".";
import { ScramjetFrame } from "../controller/frame";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "../symbols";
import { createDocumentProxy } from "./document";
import { createGlobalProxy } from "./global";
import { getOwnPropertyDescriptorHandler } from "./helpers";
import { createLocationProxy } from "./location";
import { nativeGetOwnPropertyDescriptor } from "./natives";
import {
	BareClient,
	CookieStore,
	config,
	unrewriteUrl,
	rewriteUrl,
} from "../shared";
import type { BareClient as BareClientType } from "@mercuryworkshop/bare-mux";
import { createWrapFn } from "./shared/wrap";
import { NavigateEvent } from "./events";
import type { URLMeta } from "../shared/rewriters/url";
import { SourceMaps } from "./shared/sourcemaps";

type NativeStore = {
	store: Record<string, any>;
	call: (target: string, that: any, ...args) => any;
	construct: (target: string, ...args) => any;
};
type DescriptorStore = {
	store: Record<string, PropertyDescriptor>;
	get: (target: string, that: any) => any;
	set: (target: string, that: any, value: any) => void;
};
//eslint-disable-next-line
export type AnyFunction = Function;

export type ScramjetModule = {
	enabled: (client: ScramjetClient) => boolean | undefined;
	disabled: (
		client: ScramjetClient,
		self: typeof globalThis
	) => void | undefined;
	order: number | undefined;
	default: (client: ScramjetClient, self: typeof globalThis) => void;
};

export type ProxyCtx = {
	fn: AnyFunction;
	this: any;
	args: any[];
	newTarget: AnyFunction;
	return: (r: any) => void;
	call: () => any;
};
export type Proxy = {
	construct?(ctx: ProxyCtx): any;
	apply?(ctx: ProxyCtx): any;
};

export type TrapCtx<T> = {
	this: any;
	get: () => T;
	set: (v: T) => void;
};
export type Trap<T> = {
	writable?: boolean;
	value?: any;
	enumerable?: boolean;
	configurable?: boolean;
	get?: (ctx: TrapCtx<T>) => T;
	set?: (ctx: TrapCtx<T>, v: T) => void;
};

export class ScramjetClient {
	documentProxy: any;
	globalProxy: any;
	locationProxy: any;
	serviceWorker: ServiceWorkerContainer;
	bare: BareClientType;

	natives: NativeStore;
	descriptors: DescriptorStore;
	sourcemaps: SourceMaps;
	wrapfn: (i: any, ...args: any) => any;

	cookieStore = new CookieStore();

	eventcallbacks: Map<
		any,
		[
			{
				event: string;
				originalCallback: AnyFunction;
				proxiedCallback: AnyFunction;
			},
		]
	> = new Map();

	meta: URLMeta;

	constructor(public global: typeof globalThis) {
		if (SCRAMJETCLIENT in global) {
			console.error(
				"attempted to initialize a scramjet client, but one is already loaded - this is very bad"
			);
			throw new Error();
		}

		if (iswindow) {
			this.bare = new BareClient();
		} else {
			this.bare = new BareClient(
				new Promise((resolve) => {
					addEventListener("message", ({ data }) => {
						if (typeof data !== "object") return;
						if (
							"$scramjet$type" in data &&
							data.$scramjet$type === "baremuxinit"
						) {
							resolve(data.port);
						}
					});
				})
			);
		}

		this.serviceWorker = this.global.navigator.serviceWorker;

		if (iswindow) {
			this.documentProxy = createDocumentProxy(this, global);

			global.document[SCRAMJETCLIENT] = this;
		}

		this.locationProxy = createLocationProxy(this, global);
		this.globalProxy = createGlobalProxy(this, global);
		this.wrapfn = createWrapFn(this, global);
		this.sourcemaps = {};
		this.natives = {
			store: new Proxy(
				{},
				{
					get: (target, prop: string) => {
						if (prop in target) {
							return target[prop];
						}

						const split = prop.split(".");
						const realProp = split.pop();
						const realTarget = split.reduce((a, b) => a?.[b], this.global);

						if (!realTarget) return;

						const original = Reflect.get(realTarget, realProp);
						target[prop] = original;

						return target[prop];
					},
				}
			),
			construct(target: string, ...args) {
				const original = this.store[target];
				if (!original) return null;

				return new original(...args);
			},
			call(target: string, that: any, ...args) {
				const original = this.store[target];
				if (!original) return null;

				return original.call(that, ...args);
			},
		};
		this.descriptors = {
			store: new Proxy(
				{},
				{
					get: (target, prop: string) => {
						if (prop in target) {
							return target[prop];
						}

						const split = prop.split(".");
						const realProp = split.pop();
						const realTarget = split.reduce((a, b) => a?.[b], this.global);

						if (!realTarget) return;

						const original = nativeGetOwnPropertyDescriptor(
							realTarget,
							realProp
						);
						target[prop] = original;

						return target[prop];
					},
				}
			),
			get(target: string, that: any) {
				const original = this.store[target];
				if (!original) return null;

				return original.get.call(that);
			},
			set(target: string, that: any, value: any) {
				const original = this.store[target];
				if (!original) return null;

				original.set.call(that, value);
			},
		};
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const client = this;
		this.meta = {
			get origin() {
				return client.url;
			},
			get base() {
				if (iswindow) {
					const base = client.natives.call(
						"Document.prototype.querySelector",
						client.global.document,
						"base"
					);
					if (base) {
						let url = base.getAttribute("href");
						const frag = url.indexOf("#");
						url = url.substring(0, frag === -1 ? undefined : frag);
						if (!url) return client.url;

						return new URL(url, client.url.origin);
					}
				}

				return client.url;
			},
		};

		global[SCRAMJETCLIENT] = this;
	}

	get frame(): ScramjetFrame | null {
		if (!iswindow) return null;
		const frame = this.descriptors.get("window.frameElement", this.global);

		if (!frame) return null; // we're top level
		const sframe = frame[SCRAMJETFRAME];

		if (!sframe) {
			// we're in a subframe, recurse upward until we find one
			let currentwin = this.global.window;
			while (currentwin.parent !== currentwin) {
				if (!currentwin.frameElement) return null; // ??
				if (currentwin.frameElement && currentwin.frameElement[SCRAMJETFRAME]) {
					return currentwin.frameElement[SCRAMJETFRAME];
				}
				currentwin = currentwin.parent.window;
			}
		}

		return sframe;
	}
	get isSubframe(): boolean {
		if (!iswindow) return false;
		const frame = this.descriptors.get("window.frameElement", this.global);

		if (!frame) return false; // we're top level
		const sframe = frame[SCRAMJETFRAME];
		if (!sframe) return true;

		return false;
	}
	loadcookies(cookiestr: string) {
		this.cookieStore.load(cookiestr);
	}

	hook() {
		// @ts-ignore
		const context = import.meta.webpackContext(".", {
			recursive: true,
		});

		const modules: ScramjetModule[] = [];

		for (const key of context.keys()) {
			const module: ScramjetModule = context(key);
			if (!key.endsWith(".ts")) continue;
			if (
				(key.startsWith("./dom/") && "window" in this.global) ||
				(key.startsWith("./worker/") && "WorkerGlobalScope" in this.global) ||
				key.startsWith("./shared/")
			) {
				modules.push(module);
			}
		}

		modules.sort((a, b) => {
			const aorder = a.order || 0;
			const border = b.order || 0;

			return aorder - border;
		});

		for (const module of modules) {
			if (!module.enabled || module.enabled(this))
				module.default(this, this.global);
			else if (module.disabled) module.disabled(this, this.global);
		}
	}

	get url(): URL {
		return new URL(unrewriteUrl(this.global.location.href));
	}

	set url(url: URL | string) {
		if (url instanceof URL) url = url.toString();

		const ev = new NavigateEvent(url);
		if (this.frame) {
			this.frame.dispatchEvent(ev);
		}
		if (ev.defaultPrevented) return;

		this.global.location.href = rewriteUrl(ev.url, this.meta);
	}

	// below are the utilities for proxying and trapping dom APIs
	// you don't have to understand this it just makes the rest easier
	// i'll document it eventually

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
		if (!target) return;

		const original = Reflect.get(target, prop);
		this.natives.store[name] = original;

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
				args: any[],
				newTarget: AnyFunction
			) {
				let returnValue: any = undefined;
				let earlyreturn = false;

				const ctx: ProxyCtx = {
					fn: constructor,
					this: null,
					args,
					newTarget: newTarget,
					return: (r: any) => {
						earlyreturn = true;
						returnValue = r;
					},
					call: () => {
						earlyreturn = true;
						returnValue = Reflect.construct(ctx.fn, ctx.args, ctx.newTarget);

						return returnValue;
					},
				};

				handler.construct(ctx);

				if (earlyreturn) {
					return returnValue;
				}

				return Reflect.construct(ctx.fn, ctx.args, ctx.newTarget);
			};
		}

		if (handler.apply) {
			h.apply = function (fn: any, that: any, args: any[]) {
				let returnValue: any = undefined;
				let earlyreturn = false;

				const ctx: ProxyCtx = {
					fn,
					this: that,
					args,
					newTarget: null,
					return: (r: any) => {
						earlyreturn = true;
						returnValue = r;
					},
					call: () => {
						earlyreturn = true;
						returnValue = Reflect.apply(ctx.fn, ctx.this, ctx.args);

						return returnValue;
					},
				};

				const pst = Error.prepareStackTrace;

				Error.prepareStackTrace = function (err, s) {
					if (
						s[0].getFileName() &&
						!s[0].getFileName().startsWith(location.origin + config.prefix)
					) {
						return { stack: err.stack };
					}
				};

				try {
					handler.apply(ctx);
				} catch (err) {
					if (err instanceof Error) {
						if ((err.stack as any) instanceof Object) {
							//@ts-expect-error i'm not going to explain this
							err.stack = err.stack.stack;
							console.error("ERROR FROM SCRAMJET INTERNALS", err);
						} else {
							throw err;
						}
					} else {
						throw err;
					}
				}

				Error.prepareStackTrace = pst;

				if (earlyreturn) {
					return returnValue;
				}

				return Reflect.apply(ctx.fn, ctx.this, ctx.args);
			};
		}

		h.getOwnPropertyDescriptor = getOwnPropertyDescriptorHandler;
		target[prop] = new Proxy(value, h);
	}
	Trap<T>(name: string | string[], descriptor: Trap<T>): PropertyDescriptor {
		if (Array.isArray(name)) {
			for (const n of name) {
				this.Trap(n, descriptor);
			}

			return;
		}

		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], this.global);
		if (!target) return;

		const original = nativeGetOwnPropertyDescriptor(target, prop);
		this.descriptors.store[name] = original;

		return this.RawTrap(target, prop, descriptor);
	}
	RawTrap<T>(
		target: any,
		prop: string,
		descriptor: Trap<T>
	): PropertyDescriptor {
		if (!target) return;
		if (!prop) return;
		if (!Reflect.has(target, prop)) return;

		const oldDescriptor = nativeGetOwnPropertyDescriptor(target, prop);

		const ctx: TrapCtx<T> = {
			this: null,
			get: function () {
				return oldDescriptor && oldDescriptor.get.call(this.this);
			},
			set: function (v: T) {
				// eslint-disable-next-line @typescript-eslint/no-unused-expressions
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

		return oldDescriptor;
	}
}
