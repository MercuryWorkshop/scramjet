import {
	BareCompatibleClient,
	ProxyTransport,
	RawHeaders,
} from "@mercuryworkshop/proxy-transports";
import { SCRAMJETCLIENT } from "@/symbols";
import { getOwnPropertyDescriptorHandler } from "@client/helpers";
import { createLocationProxy } from "@client/location";
import { createWrapFn } from "@client/shared/wrap";
import { LifecycleHooks } from "@client/events";
import {
	rewriteUrl,
	RewriteUrlOptions,
	unrewriteUrl,
	type URLMeta,
} from "@rewriters/url";
import {
	flagEnabled,
	HtmlRewriterHooks,
	ScramjetContext,
	ScramjetHeaders,
} from "@/shared";
import { iswindow } from "./entry";
import { SingletonBox } from "./singletonbox";
import { ScramjetConfig } from "@/types";
import { Tap } from "@/Tap";
import {
	type CookieSyncEntry,
	type CookieSyncOptions,
	TrackedHistoryState,
} from "@/fetch";
import { AnyFunction } from "@/types";
import {
	AsyncFunction_prototype,
	_URL,
	Error,
	String,
	String_charCodeAt,
	String_fromCharCode,
	Reflect_get,
	Reflect_ownKeys,
	Array_isArray,
	Reflect_apply,
	Reflect_construct,
	Object_getOwnPropertyDescriptor,
	Object_defineProperty,
	Object_defineProperties,
	Math_random,
	_Map,
	_Set,
	_WeakMap,
	Object_create,
	Object_getOwnPropertyDescriptors,
	Object_getOwnPropertyNames,
	Object_getPrototypeOf,
	Object_setPrototypeOf,
	Function_call,
	Object_assign,
	Promise_then,
	String_startsWith,
	String_trim,
	String_split,
} from "@/shared/snapshot";
import {
	isConstructorMember,
	idlSignature,
	memberValidator,
	type IDLValidator,
} from "./webidl";
import { createIndirectEval } from "./shared/eval";
import { NativeErrors } from "./nativeerror";

// https://github.com/Microsoft/TypeScript/issues/27024#issuecomment-421529650
type IfEquals<T, U, Y = unknown, N = never> =
	(<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N;
// thank you psm (https://github.com/psmpm) <3
type Traverse<
	O extends Record<any, any>,
	P extends string,
> = P extends `${infer K}.${infer R}` ? Traverse<O[K], R> : O[P];
type GlobalTraverse<P extends string> = Traverse<
	GlobalThis & Record<string, any>,
	P
>;
type ProxyApplyThis<T extends string> =
	unknown extends ThisParameterType<Extract<GlobalTraverse<T>, AnyFunction>>
		? T extends `${infer ClassName}.prototype.${string}`
			? GlobalTraverse<ClassName> extends { prototype: infer Proto }
				? Proto
				: unknown
			: unknown
		: ThisParameterType<Extract<GlobalTraverse<T>, AnyFunction>>;

export type ScramjetClientInit = {
	context: ScramjetContext;
	transport: ProxyTransport;
	sendSetCookie: (
		cookies: CookieSyncEntry[],
		options?: CookieSyncOptions
	) => Promise<void>;
	shouldBlockMessageEvent?: (ev: MessageEvent) => boolean;
	hookSubcontext: (self: Self, frame?: HTMLIFrameElement) => ScramjetClient;
	initHeaders: RawHeaders;
	history: TrackedHistoryState[];
};

export type ProxyCtx<
	T extends string = string,
	U extends "construct" | "apply" = "apply",
> = {
	fn: GlobalTraverse<T>;
	this: IfEquals<U, "construct", null, ProxyApplyThis<T>>;
	args: IfEquals<
		U,
		"construct",
		ConstructorParameters<GlobalTraverse<T>>,
		Parameters<GlobalTraverse<T>>
	>;
	newTarget: IfEquals<U, "construct", GlobalTraverse<T>, null>;
	return: (
		r: IfEquals<
			U,
			"construct",
			InstanceType<GlobalTraverse<T>>,
			ReturnType<GlobalTraverse<T>>
		>
	) => void;
	call: () => IfEquals<
		U,
		"construct",
		InstanceType<GlobalTraverse<T>>,
		ReturnType<GlobalTraverse<T>>
	>;
};
export type Proxy<T extends string = string> = {
	construct?(ctx: ProxyCtx<T, "construct">): any;
	apply?(ctx: ProxyCtx<T, "apply">): any;
};

export type TrapCtx<T extends string> = {
	this: any;
	get: () => GlobalTraverse<T>;
	set: (v: GlobalTraverse<T>) => void;
};
export type Trap<T extends string> = {
	get?: (ctx: TrapCtx<T>) => GlobalTraverse<T>;
	set?: (ctx: TrapCtx<T>, v: GlobalTraverse<T>) => void;
};

/**
 * The pair of call helpers every crossing into or out of an interceptor goes
 * through. See {@link ScramjetClient.trampoline}.
 */
export type Trampoline = {
	apply: typeof Reflect_apply;
	construct: typeof Reflect_construct;
};

/** What a trampoline is with `debugTrampolines` off: no frame of its own. */
const UNLABELLED: Trampoline = {
	apply: Reflect_apply,
	construct: Reflect_construct,
};

/** A native member, and the object it is actually installed on. */
type NativeMember = {
	owner: any;
	key: string | symbol;
	descriptor: PropertyDescriptor;
};

export type ScramjetModule = {
	enabled: (client: ScramjetClient, self: GlobalThis) => boolean | undefined;
	disabled: (client: ScramjetClient, self: GlobalThis) => void | undefined;
	order: number | undefined;
	default: (client: ScramjetClient, self: GlobalThis) => void;
};

function findBox(global: Window, seen: Window[]): SingletonBox | null {
	if (seen.includes(global)) return null;
	seen.push(global);

	try {
		if ((SCRAMJETCLIENT in global) as any) {
			return global[SCRAMJETCLIENT].box;
		}
	} catch {}

	try {
		const b = findBox(global.parent, seen);
		if (b) return b;
	} catch {}

	try {
		const b = findBox(global.top, seen);
		if (b) return b;
	} catch {}

	try {
		if (global.opener) {
			const b = findBox(global.opener, seen);
			if (b) return b;
		}
	} catch {}

	for (let i = 0; i < global.length; i++) {
		try {
			const b = findBox(global[i], seen);
			if (b) return b;
		} catch {}
	}

	return null;
}

/**
 * Stands in for the global scope's own interface in an interceptor's heritage.
 *
 * A global member like `fetch` belongs to `Window` in a document and to
 * `WorkerGlobalScope` in a worker, and neither name exists in the other realm —
 * so naming either one directly is a ReferenceError half the time, and picking
 * between them means feature-detecting at class-evaluation time. Extend this
 * instead: it exists everywhere, and `Intercept` resolves it to the global
 * object itself, which is where both engines actually keep those members.
 *
 * Typed as `typeof Window` so members still check against lib.dom.
 *
 * `super.x` does not work in one of these, in two independent ways, so reach
 * the native through `new client.native.window(this)` instead:
 *
 *   - Its members have to be `static` (see `Intercept`: a global has no
 *     `.prototype` for the instance half to be written to), and `super` in a
 *     static resolves against the base's *static* side. That is
 *     `typeof Window`, which carries `prototype` and a construct signature and
 *     none of Window's IDL members - so `super.origin` is a type error.
 *     `Document.parseHTMLUnsafe` reads fine as `super.parseHTMLUnsafe` because
 *     it genuinely is a static in lib.dom; nothing on the global is.
 *   - `Intercept` builds the fake `super` object from the global's *own*
 *     descriptors only. WebIDL puts a [Global] interface's members on the
 *     global object itself, and Blink does that for a window - but a worker's
 *     go on `WorkerGlobalScope.prototype`, which is not walked. So in a worker
 *     `super.x` is `undefined` and silently does nothing, which is the worse
 *     of the two failures.
 *
 * `client.native.window` has neither problem: `saveNatives` builds it by
 * walking the whole prototype chain, and passing `this` keeps the receiver the
 * page used, so the native's own brand check still runs.
 */
export const GlobalScope = class {} as unknown as typeof Window;

export class ScramjetClient {
	locationProxy: any;
	indirectEval: any;
	private readonly creatorOrigin: string | null;
	serviceWorker: ServiceWorkerContainer;
	bare: BareCompatibleClient;
	/** builds errors a page cannot tell from the browser's own */
	errors: NativeErrors;

	wrapfn: (i: any, ...args: any) => any;

	meta: URLMeta;

	box: SingletonBox;

	context: ScramjetContext;

	initHeaders: ScramjetHeaders;

	history: TrackedHistoryState[];

	private flagCache = new _Map<keyof ScramjetConfig["flags"], boolean>();

	/**
	 * The members already patched in this realm, keyed on the object that owns
	 * them.
	 *
	 * Two call sites can name one member without meaning to: `Trap(["Node
	 * .prototype.textContent", "HTMLScriptElement.prototype.textContent"])`
	 * reads as two members and is one, because `textContent` is only ever own
	 * on `Node.prototype`. Patching in place - rather than leaving a shadow on
	 * whichever object was named - is what makes them collide, and a second
	 * patch would wrap the first, running the interceptor body twice per call.
	 */
	private patched = new _WeakMap<object, _Set<string | symbol>>();

	hooks = {
		rewriter: {
			html: Tap.create<HtmlRewriterHooks>(),
		},
		lifecycle: Tap.create<LifecycleHooks>(),
	};

	native = new Proxy(
		{},
		{
			get: (_target: any, prototype: string) => {
				const descriptors = this.nativeStore.get(prototype);
				if (!descriptors) {
					throw new Error(`No native descriptors found for ${prototype}`);
				}
				return class {
					constructor(object: any) {
						return new Proxy(
							{},
							{
								get(_target, method: string) {
									const desc = descriptors[method];
									if (!desc) {
										throw new Error(
											`No native method|getter ${method.toString()} found for ${prototype}`
										);
									}
									if (typeof desc.value === "function") {
										const fn = desc.value;

										return new Proxy(fn, {
											apply: (_t, _thisArg, args) =>
												Reflect_apply(fn, object, args),
										});
									} else if (desc.get) {
										return desc.get.call(object);
									}
								},
								set(_target, method: string, value: any) {
									const desc = descriptors[method];
									if (!desc || !desc.set) {
										throw new Error(
											`No native setter ${method.toString()} found for ${prototype}`
										);
									}
									desc.set.call(object, value);
									return true;
								},
							}
						);
					}
				};
			},
		}
	);
	nativeStore: Map<string, Record<string, PropertyDescriptor>> = new _Map();

	/**
	 * Both tables below are null-prototype, and not for tidiness. Each walk
	 * ends at `Object.prototype`, whose descriptor map carries an enumerable
	 * `__proto__` entry, and `Object_assign` copies with [[Set]] - so on an
	 * ordinary object that last step ran `Object.prototype.__proto__`'s
	 * *setter* and reparented the table to the descriptor object instead of
	 * storing a key on it. Two things followed: every entry silently lost its
	 * `__proto__` descriptor, and the table then inherited `get`, `set`,
	 * `enumerable` and `configurable` from that descriptor object - so a
	 * `client.native.X(o).get` for an interface with no own `get` answered
	 * `undefined` where it owes a "No native method" throw. With no prototype
	 * there is no setter to find and the key is defined outright.
	 */
	saveNatives() {
		for (const key of Object_getOwnPropertyNames(this.global)) {
			const value = this.global[key];
			if (typeof value === "function" && "prototype" in value) {
				const natives = Object_create(null);
				const walk = (proto: any) => {
					const prototype = Object_getPrototypeOf(proto);
					if (prototype) walk(prototype);
					Object_assign(natives, Object_getOwnPropertyDescriptors(proto));
				};
				walk(value.prototype);
				this.nativeStore.set(key, natives);
			}
		}

		// handle both globals bound to the scope's prototype, and globals bound to the scope itself (e.g. window)
		const globals = Object_create(null);
		const walkGlobal = (object: any) => {
			const prototype = Object_getPrototypeOf(object);
			if (prototype) walkGlobal(prototype);
			Object_assign(globals, Object_getOwnPropertyDescriptors(object));
		};
		walkGlobal(this.global);
		this.nativeStore.set("window", globals);
	}

	constructor(
		public global: GlobalThis,
		public init: ScramjetClientInit
	) {
		if (SCRAMJETCLIENT in global) {
			dbg.error(
				"attempted to initialize a scramjet client, but one is already loaded - this is very bad"
			);
			throw new Error();
		}

		if (iswindow) {
			const b = findBox(global as unknown as Window, []);
			if (b) {
				this.box = b;
			}
		}

		if (!this.box) {
			this.box = new SingletonBox(this);
		}

		this.saveNatives();
		this.errors = new NativeErrors(global as Self);

		this.box.registerClient(this, global as Self);

		this.context = init.context;
		if (init.initHeaders)
			this.initHeaders = ScramjetHeaders.fromRawHeaders(init.initHeaders);
		this.history = init.history;
		this.context.hooks = {
			rewriter: this.hooks.rewriter,
		};

		// after `registerClient` and `context`, both of which it reads through,
		// and before anything that could hand this window back to a page
		this.creatorOrigin = this.captureCreatorOrigin();

		this.bare = new BareCompatibleClient(init.transport);

		this.serviceWorker = this.global.navigator.serviceWorker;

		if (iswindow) {
			global.document[SCRAMJETCLIENT] = this;
		}

		this.indirectEval = createIndirectEval(this);
		this.wrapfn = createWrapFn(this, global);
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const client = this;
		this.meta = {
			get origin() {
				return client.url;
			},
			get base() {
				if (iswindow) {
					const base = new client.native.Document(
						client.global.document
					).querySelector("base");
					if (base) {
						let url = base.getAttribute("href");
						if (!url) return client.url;
						const frag = url.indexOf("#");
						url = url.substring(0, frag === -1 ? undefined : frag);
						if (!url) return client.url;

						return new _URL(url, client.url.origin);
					}
				}

				return client.url;
			},
			// TODO: very bad assumptions made here, window.parent never throws
			get topFrameName() {
				if (!iswindow)
					throw new Error("topFrameName was called from a worker?");

				let currentWin = client.global;

				try {
					if (currentWin.parent.window == currentWin.window) {
						// we're top level & we don't have a frame name
						return null;
					}
				} catch {
					// accessing parent was blocked by CORS, we're in a frame but the parent is cross origin
				}

				try {
					// find the topmost frame that's controlled by scramjet, stopping before the real top frame
					while (currentWin.parent.window !== currentWin.window) {
						if (!currentWin.parent.window[SCRAMJETCLIENT]) break;
						currentWin = currentWin.parent.window;
					}
				} catch {
					// doesn't matter if it throws here just means we found the topmost one
				}

				const curclient = currentWin[SCRAMJETCLIENT];
				const frame = new curclient.native.window(currentWin).frameElement;
				if (!frame) {
					// we're inside an iframe, but the top frame is scramjet-controlled and top level, so we can't get a top frame name
					// or we're cross-origin and frameElement doesn't exist. that's a TODO because this won't work
					return null;
				}
				if (!frame.name) {
					// the top frame is scramjet-controlled, but it has no name. this is user error
					dbg.error(
						"YOU NEED TO USE `new ScramjetFrame()`! DIRECT IFRAMES WILL NOT WORK"
					);

					return null;
				}

				return frame.name;
			},
			get parentFrameName() {
				if (!iswindow)
					throw new Error("parentFrameName was called from a worker?");

				try {
					try {
						if (client.global.parent.window == client.global.window) {
							// we're top level & we don't have a frame name
							return null;
						}
					} catch {
						// accessing parent was blocked by CORS, we're in a frame but the parent is cross origin
						return null;
					}

					const parentWin = client.global.parent.window;
					if (parentWin[SCRAMJETCLIENT]) {
						// we're inside an iframe, and the parent is scramjet-controlled
						const parentClient = parentWin[SCRAMJETCLIENT];
						const frame = new parentClient.native.window(parentWin)
							.frameElement;
						if (!frame) {
							// parent is scramjet controlled and top-level. there is no parent frame name
							return null;
						}

						if (!frame.name) {
							// the parent frame is scramjet-controlled, but it has no name. this is user error
							dbg.error(
								"YOU NEED TO USE `new ScramjetFrame()`! DIRECT IFRAMES WILL NOT WORK"
							);

							return null;
						}

						return frame.name;
					} else {
						// we're inside an iframe, and the parent is not scramjet-controlled
						// return our own frame name
						const frame = new client.native.window(client.global).frameElement;
						if (!frame.name) {
							// the parent frame is not scramjet-controlled, so we can't get a parent frame name
							dbg.error(
								"YOU NEED TO USE `new ScramjetFrame()`! DIRECT IFRAMES WILL NOT WORK"
							);

							return null;
						}

						return frame.name;
					}
				} catch {
					return null;
				}
			},
			get referrerPolicy(): string | undefined {
				if (client.initHeaders && client.initHeaders.has("referrer-policy")) {
					return client.initHeaders.get("referrer-policy");
				}
				if (!iswindow) return "";
				// TODO: need to nullify the actual meta tag so it still sends unsafe-url
				const nDoc = new client.native.Document(client.global.document);
				const meta = [
					...nDoc.querySelectorAll("meta[name='referrer']"),
					...nDoc.querySelectorAll("meta[name='referrer-policy']"),
					...nDoc.querySelectorAll("meta[http-equiv='referrer-policy']"),
				];
				const last = meta[meta.length - 1];
				if (last) {
					const nLast = new client.native.HTMLMetaElement(last);
					return nLast.getAttribute("content");
				}

				return "";
			},
		};
		this.locationProxy = createLocationProxy(this, global);

		global[SCRAMJETCLIENT] = this;
	}

	/** Apply document injection init when a client was already installed (e.g. early contentWindow). */
	syncDocumentInit(init: {
		initHeaders: RawHeaders;
		history: TrackedHistoryState[];
		cookies?: string;
	}) {
		this.initHeaders = ScramjetHeaders.fromRawHeaders(init.initHeaders);
		this.history = init.history;
		if (init.cookies !== undefined) {
			this.context.cookieJar.load(init.cookies);
		}
	}

	hook() {
		const context = import.meta.webpackContext(".", {
			recursive: true,
		});

		const modules: ScramjetModule[] = [];

		for (const key of context.keys()) {
			if (!key.endsWith(".ts")) continue;
			if (
				(key.startsWith("./dom/") && "window" in this.global) ||
				(key.startsWith("./worker/") && "WorkerGlobalScope" in this.global) ||
				key.startsWith("./shared/")
			) {
				modules.push(context(key) as ScramjetModule);
			}
		}

		modules.sort((a, b) => {
			const aorder = a.order || 0;
			const border = b.order || 0;

			return aorder - border;
		});

		for (const module of modules) {
			// one module throwing used to abort the loop, so a single interface
			// missing from this realm silently left every module after it
			// uninstalled. a hooked-but-incomplete realm is bad; an unhooked one
			// is a hole, so keep going and be loud about it
			try {
				if (!module.enabled || module.enabled(this, this.global))
					module.default(this, this.global);
				else if (module.disabled) module.disabled(this, this.global);
			} catch (err) {
				dbg.error("failed to install scramjet module", err);
			}
		}
	}

	get url(): _URL {
		return new _URL(this.unrewriteUrl(this.global.location.href));
	}

	set url(url: _URL | string) {
		url = String(url);

		Tap.dispatch(
			this.hooks.lifecycle.navigate,
			{
				type: "location",
			},
			{
				url,
			}
		);

		this.global.location.href = this.rewriteUrl(url, {
			navigateType: "location",
		});
	}

	/**
	 * The security origin of this client
	 *
	 * Since client.url.origin is null for about:blank/srcdoc, this value MUST be used when using it as a security or scope check
	 *
	 * Null when there was no creator to inherit from - in practice a creator
	 * outside the sandbox: the embedder's own page, or another proxy's frame.
	 *
	 * That null is a definite answer, not a missing one. The document has an
	 * origin; it is just not one of the origins scramjet models, so it is not
	 * equal to any site's. A security comparison must therefore *reject* on it
	 * rather than fall through - see `dom/history.ts` and `dom/open.ts` - and
	 * anything keying state on it needs a bucket of its own, which is what
	 * {@link scopeOrigin} hands out.
	 */
	get siteOrigin(): string | null {
		const url = this.url;
		// Fragments preserve the document's inherited origin. Queries are also
		// allowed for about:blank, but not for about:srcdoc.
		// https://html.spec.whatwg.org/multipage/urls-and-fetching.html#matches-about:blank
		const href = String_split(url.href, "#")[0];
		if (
			href === "about:blank" ||
			String_startsWith(href, "about:blank?") ||
			href === "about:srcdoc"
		) {
			return this.creatorOrigin;
		}

		return url.origin;
	}

	/**
	 * The origin to key per-site state on: storage areas, database and cache
	 * names, channel names.
	 *
	 * A null {@link siteOrigin} is not an unknown origin, it is a definite one
	 * that is not any proxied site's - so the answer here is a string unique to
	 * this document, not a shared stand-in. Keying those documents on one
	 * literal "null" would join namespaces that have nothing to do with each
	 * other, which is the whole bug this exists to avoid, one level down.
	 *
	 * Unique per client, so it does not survive a reload. That is the right
	 * shape for the case it covers: a browser gives an opaque origin no
	 * persistent storage at all and throws on `localStorage`, so an ephemeral
	 * bucket is closer than either a shared one or an exception.
	 *
	 * Never use this for a security comparison - it is deliberately unequal to
	 * everything, including itself across a reload. Use {@link siteOrigin} and
	 * reject on null, the way `dom/history.ts` and `dom/open.ts` do.
	 */
	get scopeOrigin(): string {
		const origin = this.siteOrigin;

		// "null" is how an origin that is already opaque serializes - a `data:`
		// document's, say - and it needs a bucket of its own for the same
		// reason a null does, so it takes the same stand-in
		return origin === null || origin === "null" ? this.opaqueScope : origin;
	}

	/**
	 * The stand-in {@link scopeOrigin} uses for a document with no site origin.
	 */
	private readonly opaqueScope = `about-opaque://${Math_random()}`;

	get scopeUrl(): _URL {
		return new _URL(this.scopeOrigin);
	}

	/**
	 * The origin of the document that created this one, or null if there is
	 * none to ask.
	 *
	 * Read once, in the constructor, and never again. A document's origin is
	 * fixed when the document is created; the references that lead back to its
	 * creator are not. `opener` is a settable attribute, so a page that can
	 * reach a window could otherwise hand it another site's origin, and either
	 * relationship can be navigated out from under us afterwards. Deriving the
	 * answer at read time would therefore be both forgeable and
	 * time-dependent.
	 *
	 * Here it is neither: every path that installs a client - `hookSubcontext`
	 * from the window-open steps, or from the `contentWindow` trap - runs
	 * before the new window's reference has been handed back to the page and
	 * before a single script in the new document has run.
	 *
	 * https://html.spec.whatwg.org/multipage/document-sequences.html#creating-a-new-browsing-context
	 */
	private captureCreatorOrigin(): string | null {
		// a worker has neither relationship, and its URL is never about:blank
		if (!iswindow) return null;

		try {
			const global = this.global as unknown as Window;
			// a child frame's creator is its parent's document, a popup's is
			// its opener's - and a top-level document being its own parent is
			// exactly what tells the two apart
			const creator =
				global.parent !== global ? global.parent : (global.opener as Window);
			if (!creator || creator === global) return null;

			const creatorClient = this.box.globals.get(creator as Self);
			if (!creatorClient || creatorClient === this) return null;

			// the creator's own creator origin was captured when *it* was
			// constructed, so a chain of about:blank documents resolves in one
			// step rather than a walk
			return creatorClient.siteOrigin;
		} catch {
			// reading `parent` or `opener` threw, so the creator is cross-origin
			// to the *proxy* itself and is outside the sandbox
			return null;
		}
	}

	// below are the utilities for proxying and trapping dom APIs
	// you don't have to understand this it just makes the rest easier
	// i'll document it eventually
	Proxy<T extends string>(name: T, handler: Proxy<T>): void;
	Proxy<const T extends readonly string[]>(
		name: T,
		handler: Proxy<T[number]>
	): void;
	Proxy(name: string | string[], handler: Proxy<any>): void {
		if (Array_isArray(name)) {
			for (const n of name) {
				this.Proxy(n, handler);
			}

			return;
		}

		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], this.global);
		if (!target) return;
		if (!prop) return;

		this.RawProxy(target, prop, handler, name);
	}
	/**
	 * A named `apply`/`construct` pair for one intercepted member.
	 *
	 * With `debugTrampolines` off these are `Reflect.apply` and
	 * `Reflect.construct`, which add no frame and cost nothing. With it on they
	 * are built by `Function` in the page's own realm behind a
	 * `//# sourceURL`, so a stack trace names the member it passed through
	 * instead of showing an anonymous frame inside the client bundle.
	 *
	 * Every crossing goes through the pair - into the interceptor body and back
	 * out to the native - so a member reads the same in a trace whether `Proxy`,
	 * `Trap` or `Intercept` installed it, and an interceptor that returns early
	 * is as visible as one that calls through.
	 *
	 * One `Function` evaluation per member, which with the flag on is every
	 * member `Intercept` installs. That is the price of the flag.
	 */
	private trampoline(member: string): Trampoline {
		if (!this.flagEnabled("debugTrampolines")) return UNLABELLED;

		/**
		 * These are interpolated into `//` comments and a `//# sourceURL`, and
		 * a line comment ends at any LineTerminator - LF and CR, but also
		 * U+2028 and U+2029, which the previous newline strip missed and which
		 * a page can put in `window.name`. Left in, they close the comment and
		 * the rest of the value is evaluated as source in the page's realm.
		 */
		const line = (value: string) => {
			const raw = String(value);
			let out = "";
			for (let i = 0; i < raw.length; i++) {
				const c = String_charCodeAt(raw, i);
				out +=
					c === 0x0a || c === 0x0d || c === 0x2028 || c === 0x2029
						? " "
						: String_fromCharCode(c);
			}

			return out;
		};

		const nGlobal = new this.native.window(this.global);

		let frame: string;
		try {
			// a service worker global has no `name` at all
			frame = line(nGlobal.name) || "<unnamed>";
		} catch {
			frame = "<no frame>";
		}

		try {
			// the snapshots are passed in rather than named in the source: this
			// is the page's realm, so a bare `Reflect.apply` would be looked up
			// on the page's `Reflect` at call time, and replacing it would hand
			// the page a hook into every intercepted call
			return nGlobal.Function(
				"reflectApply",
				"reflectConstruct",
				`"use strict";

// SCRAMJET INTERCEPT
// member: ${line(member)}
// frame: ${frame}
// location: ${line(this.url.href)}

function apply(fn, that, args) {
	return reflectApply(fn, that, args);
}

function construct(fn, args, newTarget) {
	return reflectConstruct(fn, args, newTarget);
}

return { apply, construct };

//# sourceURL=${line(member)}.sj`
			)(Reflect_apply, Reflect_construct);
		} catch (err) {
			// a CSP that forbids `Function` is not a reason to lose the member
			dbg.error(`could not build a debug trampoline for ${member}`, err);

			return UNLABELLED;
		}
	}

	/**
	 * Where `key` actually lives, and the descriptor it lives as.
	 *
	 * Null - loudly for a member that cannot be replaced, silently for one this
	 * engine does not have - when there is nothing to patch. Adding a member
	 * that isn't there advertises the patch rather than hiding it.
	 */
	private resolveNative(
		target: any,
		key: string | symbol,
		debugname: string
	): NativeMember | null {
		// walked rather than read straight off `target`, because where an engine
		// puts an interface's members is not fixed. Blink installs the global
		// scope's own onto the window instance but a worker's onto
		// `WorkerGlobalScope.prototype`, and an own-property-only lookup finds
		// nothing there - so the patch lands on `target` as a *shadowing own
		// property*, which the native does not have and a page can see
		let owner = target;
		while (owner) {
			const descriptor = Object_getOwnPropertyDescriptor(owner, key);
			if (descriptor) {
				if (!descriptor.configurable) {
					dbg.error(`cannot intercept non-configurable ${debugname}`);

					return null;
				}

				if (this.patched.get(owner)?.has(key)) {
					dbg.error(
						`${debugname} was already intercepted - the second patch would wrap the first, so it is being skipped`
					);

					return null;
				}

				return { owner, key, descriptor };
			}
			owner = Object_getPrototypeOf(owner);
		}

		return null;
	}

	/**
	 * Put a patched member back where the native one was.
	 *
	 * The single place `Proxy`, `Trap` and `Intercept` all install through, so
	 * that a page cannot tell from the *shape* of a member which of the three
	 * touched it - or that any of them did:
	 *
	 *   - onto whichever object owns the member, never as a shadow on the
	 *     object the call site happened to name
	 *   - defined over the top, never `delete`d first, because `delete` moves
	 *     the key to the end of the owner's key order and that ordering is
	 *     observable through `Object.getOwnPropertyNames`
	 *   - carrying the native's own enumerable / configurable / writable rather
	 *     than a guess at them
	 */
	private installNative(native: NativeMember, next: PropertyDescriptor): void {
		next.enumerable = native.descriptor.enumerable;
		next.configurable = native.descriptor.configurable;
		if (!("get" in next) && !("set" in next)) {
			next.writable = native.descriptor.writable;
		}

		Object_defineProperty(native.owner, native.key, next);

		let keys = this.patched.get(native.owner);
		if (!keys) {
			keys = new _Set<string | symbol>();
			this.patched.set(native.owner, keys);
		}
		keys.add(native.key);
	}

	RawProxy(target: any, prop: string, handler: Proxy<any>, debugname?: string) {
		if (!target) return;
		if (!prop) return;

		const native = this.resolveNative(target, prop, debugname ?? prop);
		if (!native) return;

		// read through the chain rather than off the descriptor: this is also
		// the path an accessor-backed member takes, and its value is whatever
		// the getter answers
		const value = Reflect_get(target, prop);

		const h: ProxyHandler<any> = {};

		const { apply: applyFn, construct: constructFn } = this.trampoline(
			debugname ?? prop
		);

		if (handler.construct) {
			h.construct = function (
				constructor: any,
				args: any[],
				newTarget: AnyFunction
			) {
				let returnValue: any = undefined;
				let earlyreturn = false;

				const ctx: ProxyCtx<any, "construct"> = {
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
						returnValue = constructFn(ctx.fn, ctx.args, ctx.newTarget);

						return returnValue;
					},
				};

				applyFn(handler.construct, handler, [ctx]);

				if (earlyreturn) {
					return returnValue;
				}

				return constructFn(ctx.fn, ctx.args, ctx.newTarget);
			};
		}

		if (handler.apply) {
			h.apply = (fn: any, that: any, args: any[]) => {
				let returnValue: any = undefined;
				let earlyreturn = false;

				const ctx: ProxyCtx<any, "apply"> = {
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
						returnValue = applyFn(ctx.fn, ctx.this, ctx.args);

						return returnValue;
					},
				};
				// Called bare, the way `construct` above and `Intercept` both do.
				//
				// This used to run under a swapped-out `Error.prepareStackTrace`
				// that tagged any error whose top frame was outside the proxy
				// prefix as "from scramjet internals", logged it, and - with
				// `allowFailedIntercepts`, which the controller turns on - threw
				// it away and fell through to the native. That was written when
				// an interceptor throwing meant an interceptor was broken. It
				// no longer does: `client.errors` exists so members can throw
				// the DOMException the spec asks for, and every one of those is
				// built in scramjet code, so it looked exactly like a bug and
				// got swallowed.
				//
				// Catching cost more than the diagnostic was worth even when it
				// rethrew. `err.stack` was replaced with an object and then put
				// back, which is observable; `Error.prepareStackTrace` is global
				// and `shared/error.ts` wants it for `cleanErrors`; and a
				// rethrow moves the throw site into this file, which re-points
				// the `filename` a page sees on the resulting error at
				// scramjet.js.
				applyFn(handler.apply, handler, [ctx]);

				if (earlyreturn) {
					return returnValue;
				}

				return applyFn(ctx.fn, ctx.this, ctx.args);
			};
		}

		const proxy = new Proxy(value, h);
		this.box.unproxy.set(proxy, value);
		h.getOwnPropertyDescriptor = getOwnPropertyDescriptorHandler;
		this.installNative(native, { value: proxy });
	}
	Trap<T extends string>(name: T, handler: Trap<T>): void;
	Trap<const T extends readonly string[]>(
		name: T,
		handler: Trap<T[number]>
	): void;
	Trap(name: string | string[], descriptor: Trap<any>): void {
		if (Array_isArray(name)) {
			for (const n of name) {
				this.Trap(n, descriptor);
			}

			return;
		}

		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], this.global);
		if (!target) return;
		if (!prop) return;

		this.RawTrap(target, prop, descriptor, name);
	}
	RawTrap(
		target: any,
		prop: string,
		descriptor: Trap<any>,
		debugname?: string
	) {
		if (!target) return;
		if (!prop) return;

		const member = debugname ?? prop;
		const native = this.resolveNative(target, prop, member);
		if (!native) return;

		const old = native.descriptor;
		const { apply } = this.trampoline(member);

		const ctx: TrapCtx<any> = {
			this: null,
			get: function () {
				// `old` is the descriptor from the *owner*, so this answers with
				// the real value for an inherited member. Read off the object the
				// call site named it would have been undefined, and a trap that
				// falls through to `ctx.get()` would have silently erased the
				// member it was wrapping
				return old.get ? apply(old.get, this.this, []) : old.value;
			},
			set: function (v: any) {
				if (old.set) apply(old.set, this.this, [v]);
			},
		};

		const next: PropertyDescriptor = {};
		const isAccessor = !!(old.get || old.set);
		let replaced = false;

		// an accessor's halves are replaced, never invented: a trap that
		// declares a setter for a readonly attribute used to get one installed,
		// which is a shape no browser has. A data property has no halves to
		// match, so a trap over one may declare whichever it needs
		if (descriptor.get && (old.get || !isAccessor)) {
			replaced = true;
			next.get = function () {
				ctx.this = this;

				return apply(descriptor.get, descriptor, [ctx]);
			};
		} else if (old.get) {
			next.get = old.get;
		}

		if (descriptor.set && (old.set || !isAccessor)) {
			replaced = true;
			next.set = function (v: any) {
				ctx.this = this;

				apply(descriptor.set, descriptor, [ctx, v]);
			};
		} else if (old.set) {
			next.set = old.set;
		}

		// a trap whose every declared half was refused - a setter-only trap
		// over a readonly attribute. Leave the native untouched rather than
		// rewrite its descriptor with itself, which would also claim the member
		// against a later patch that does have something to say about it
		if (!replaced) return;

		this.installNative(native, next);
	}

	/**
	 * `checkReceiver` must synchronously invoke a side-effect-free native getter
	 * or method on the receiver, throwing for an invalid receiver. Web IDL checks
	 * the receiver before converting arguments, and conversion runs page code, so
	 * an instance member with IDL arguments wants one. For example, Headers can
	 * use the saved `has` method with a fixed valid name; Blob can use its saved
	 * `size` getter. Merely constructing a `client.native` wrapper does not check
	 * anything.
	 *
	 * Wanted, not required: omitting it leaves the ordering imprecise rather than
	 * refusing the declaration, because a promise-only interface has no member
	 * that can satisfy the contract and the interfaces that do are better off
	 * installed. See #117.
	 */
	Intercept(handler: any, checkReceiver?: (receiver: any) => void): void {
		const foreignbaseclass = Object_getPrototypeOf(handler);
		const globalname = foreignbaseclass.name;
		// matched by identity, not by name: `GlobalScope` is the one heritage
		// that resolves to the global object itself rather than to an interface
		// on it
		const isglobal = foreignbaseclass === GlobalScope;
		const classname = isglobal ? "window" : globalname;
		const baseclass = isglobal ? this.global : this.global[classname];
		if (!baseclass) return;

		const prototypeDescs: Record<string | symbol, PropertyDescriptor> =
			Object_getOwnPropertyDescriptors(handler.prototype);
		const staticDescs: Record<string | symbol, PropertyDescriptor> =
			Object_getOwnPropertyDescriptors(handler);
		// A declaration that converts IDL arguments without a `checkReceiver`
		// used to be refused here. Nothing has ever passed one, so the refusal
		// threw for every such interface and `loadModules` swallowed it into a
		// `dbg.error` - silently uninstalling cookie, CookieStore, history,
		// performance and opfs, which is a far worse outcome than the argument
		// conversion ordering it was guarding. See #117 for the real fix: a
		// predicate that asks whether a conversion can run page code at all, an
		// async brand check for the promise-only interfaces, and a build-time
		// failure rather than a runtime one.

		// create a fake parent prototype for the handler, so that `super.method()` calls resolve to the native store versions
		const fakePrototype = {};
		Object_defineProperties(fakePrototype, this.nativeStore.get(classname));
		Object_setPrototypeOf(handler.prototype, fakePrototype);

		const fakeStatics = {};
		Object_defineProperties(
			fakeStatics,
			Object_getOwnPropertyDescriptors(baseclass)
		);
		Object_setPrototypeOf(handler, fakeStatics);

		const attemptToCallHandler = (
			handler: (...args: any[]) => any,
			that: any,
			args: any[],
			fallback: (args: any[]) => any,
			validate: IDLValidator | undefined,
			isAsync: boolean,
			tramp: Trampoline,
			check?: (receiver: any) => void
		) => {
			const invoke = () => {
				// https://webidl.spec.whatwg.org/#dfn-create-operation-function
				check?.(that);
				if (validate && !validate(args)) return fallback(args);

				return tramp.apply(handler, that, args);
			};
			// Promise-returning operations reject for *all* binding exceptions,
			// including receiver checks, conversion, and the native fallback.
			return isAsync ? this.relevantPromise(that, invoke) : invoke();
		};

		// a getter-only native attribute the interceptor writes to, or the
		// reverse. never reached by anything we ship, but `new Proxy(undefined)`
		// throws, so the half has to exist
		const missingHalf = () => undefined;

		const createProxy = (
			handler: (...args: any[]) => any,
			old: ((...args: any[]) => any) | undefined,
			validate: IDLValidator | undefined,
			member: string,
			check: ((receiver: any) => void) | undefined
		) => {
			// settled once, at install time, rather than on every call
			const isAsync =
				Object_getPrototypeOf(handler) === AsyncFunction_prototype ||
				String_startsWith(
					String_trim(idlSignature(handler)?.returns ?? ""),
					"Promise<"
				);
			const target = old || missingHalf;
			const tramp = this.trampoline(member);

			const proxy = new Proxy(target, {
				apply: (_, thisArg, args) => {
					// https://webidl.spec.whatwg.org/#dfn-create-operation-function
					// step 2, and the identical step in "create an attribute
					// getter" and "create an attribute setter": "Let esValue be
					// the this value, if it is not null or undefined, or the
					// current realm's global object otherwise."
					//
					// This is what makes an unqualified `addEventListener(...)`
					// work. The reference resolves against the global
					// environment record, whose WithBaseObject is undefined, so
					// the native is called with a `this` of undefined and WebIDL
					// substitutes the global. An interceptor body is strict-mode
					// code, so without this it sees that undefined instead - and
					// then either throws where a browser does not, or keys
					// per-target state on a primitive, which is how
					// `shared/event.ts` came to throw "Invalid value used as
					// weak map key" out of every bare `addEventListener`.
					//
					// For an interface the global does not implement, the body's
					// own `super.x()` brand-checks it and raises exactly the
					// TypeError the native would have.
					const that =
						thisArg === null || thisArg === undefined ? this.global : thisArg;

					return attemptToCallHandler(
						handler,
						that,
						args,
						(a) => tramp.apply(target, that, a),
						validate,
						isAsync,
						tramp,
						check
					);
				},
			});

			// registered the same way `RawProxy` registers its own, so that
			// `shared/sourcemaps.ts` can unwrap it. `Function.prototype
			// .toString` on a proxy renders `function () { [native code] }` -
			// no name - where the native it stands in for renders
			// `function fetch() { [native code] }`, and the table is what lets
			// the real source text answer instead
			this.box.unproxy.set(proxy, target);

			return proxy;
		};

		const writePrototypeField = (
			key: string | symbol,
			prototype: any,
			handlerDescriptor: PropertyDescriptor,
			instance: boolean
		) => {
			const native = this.resolveNative(
				prototype,
				key,
				`${classname}.${String(key)}`
			);
			if (!native) return;

			const oldDescriptor = native.descriptor;
			const newDescriptor: PropertyDescriptor = {};
			const member = `${classname}.${String(key)}`;
			const check = instance ? checkReceiver : undefined;

			if (oldDescriptor.get || oldDescriptor.set) {
				if (handlerDescriptor.get && !oldDescriptor.get) {
					dbg.warn(
						`Intercept(${member}) adds a getter absent from the native attribute`
					);
				}
				if (handlerDescriptor.set && !oldDescriptor.set) {
					dbg.warn(
						`Intercept(${member}) adds a setter absent from the native attribute`
					);
				}
				// a getter takes no arguments, so there is nothing to validate on one
				newDescriptor.get = handlerDescriptor.get
					? createProxy(
							handlerDescriptor.get,
							oldDescriptor.get,
							undefined,
							`get ${member}`,
							check
						)
					: oldDescriptor.get;
				newDescriptor.set = handlerDescriptor.set
					? createProxy(
							handlerDescriptor.set,
							oldDescriptor.set,
							memberValidator(this.box, handlerDescriptor.set, true),
							`set ${member}`,
							check
						)
					: oldDescriptor.set;
			} else {
				newDescriptor.value =
					"value" in handlerDescriptor
						? createProxy(
								handlerDescriptor.value,
								oldDescriptor.value,
								memberValidator(this.box, handlerDescriptor.value),
								member,
								check
							)
						: oldDescriptor.value;
			}

			this.installNative(native, newDescriptor);
		};

		/**
		 * Whether `key` is a property the class syntax generated rather than a
		 * member the interceptor declared.
		 */
		const isClassMetadata = (
			key: string | symbol,
			desc: PropertyDescriptor,
			isStatic: boolean
		): boolean => {
			if (key === "prototype") return true;
			// the only own property class evaluation puts on `.prototype`
			if (!isStatic) return key === "constructor";
			if (key !== "length" && key !== "name") return false;

			return "value" in desc && desc.writable === false;
		};

		for (const prop of Reflect_ownKeys(prototypeDescs)) {
			const classDesc = prototypeDescs[prop];
			if (isClassMetadata(prop, classDesc, false)) continue;
			if (isConstructorMember(classDesc.value)) continue;
			writePrototypeField(prop, baseclass.prototype, classDesc, true);
		}
		for (const prop of Reflect_ownKeys(staticDescs)) {
			const handlerDesc = staticDescs[prop];
			if (isClassMetadata(prop, handlerDesc, true)) continue;
			const value = handlerDesc.value;
			if (value && isConstructorMember(value)) {
				const nativeCtor = this.nativeStore.get("window")[globalname].value;
				const validate = memberValidator(this.box, value);
				const tramp = this.trampoline(`new ${globalname}`);
				// constructor isn't a field, replace the entire class on the global with a proxy
				const proxy = new Proxy(baseclass, {
					construct: (_, args, newTarget) => {
						// `new this(...)` in a `@Constructor` body has to reach the
						// native with the *page's* newTarget. Handing the body the
						// bare native constructor threw it away, so
						// `class Sub extends Request {}` produced an instance
						// carrying `Request.prototype` and `new Sub() instanceof
						// Sub` was false - while the rejection path below, which
						// does pass it on, got it right. A plain
						// `new Request(...)` names this proxy as its newTarget and
						// wants the native constructor itself, which is both the
						// common case and the one that allocates nothing
						const construct =
							newTarget === proxy
								? nativeCtor
								: new Proxy(nativeCtor, {
										construct: (_target, inner) =>
											tramp.construct(nativeCtor, inner, newTarget),
									});

						const constructed = attemptToCallHandler(
							value,
							construct, // used as `this` in order to make the `new this()` syntax work properly
							args,
							// a rejected argument list has to reach the native as a
							// *construction*, or the page sees "cannot be invoked
							// without 'new'" where it should see the arity TypeError
							(a) => tramp.construct(nativeCtor, a, newTarget),
							validate,
							false,
							tramp
						);

						// a `@Constructor` body that returns nothing means
						// "construct normally with the arguments as coerced",
						// which is what `webidl.ts` documents it as. It cannot be
						// left to fall out of the trap: `undefined` out of
						// [[Construct]] is a hard "proxy [[Construct]] must return
						// an object" TypeError rather than a pass-through. The
						// rejection path above always hands back an object, so
						// this only ever catches a body that declined to build one
						if (constructed === undefined) {
							return tramp.construct(nativeCtor, args, newTarget);
						}

						return constructed;
					},
				});

				// registered the way `RawProxy` and `createProxy` register
				// theirs, so `shared/sourcemaps.ts` can unwrap it.
				// `Function.prototype.toString` on a proxy renders
				// `function () { [native code] }` - nameless - where the
				// interface object it stands in for renders
				// `function Request() { [native code] }`, and the table is what
				// lets the real one answer instead.
				//
				// Mapped to the native rather than to `baseclass`: one hop then
				// always lands on a real function with the right name, even if
				// something else had already wrapped the global before we did.
				this.box.unproxy.set(proxy, nativeCtor);

				this.global[globalname] = proxy;

				// https://webidl.spec.whatwg.org/#interface-prototype-object
				// "The interface prototype object must also have a property
				// named `constructor` [...] whose value is a reference to the
				// interface object."
				//
				// The page-visible interface object is now this proxy, so
				// leaving the native one on the prototype makes
				// `X.prototype.constructor === X` false - an identity that
				// holds for every interface in every engine, and so a
				// one-expression enumeration of exactly which interfaces we
				// construct through. Through `installNative` like every other
				// patch, so the native's own attributes (writable, not
				// enumerable, configurable) are carried over rather than
				// guessed at.
				// Only when the prototype's `constructor` is the very function
				// being replaced. A legacy factory - `Audio`, `Image`,
				// `Option` - is not an interface object and does not own its
				// `.prototype`: `Audio.prototype` *is*
				// `HTMLAudioElement.prototype`, whose `constructor` correctly
				// names `HTMLAudioElement`. Rewriting that one would break the
				// identity for the interface it really belongs to, which is the
				// same bug one interface over.
				const constructorSlot =
					baseclass.prototype &&
					this.resolveNative(
						baseclass.prototype,
						"constructor",
						`${globalname}.prototype.constructor`
					);
				if (
					constructorSlot &&
					constructorSlot.descriptor.value === nativeCtor
				) {
					this.installNative(constructorSlot, { value: proxy });
				}
			} else {
				// normal static method
				writePrototypeField(prop, baseclass, handlerDesc, isglobal);
			}
		}
	}

	rewriteUrl(url: string | URL, options?: RewriteUrlOptions): string {
		return rewriteUrl(url, this.context, this.meta, options);
	}

	unrewriteUrl(url: string | URL): string {
		return unrewriteUrl(url, this.context);
	}

	flagEnabled(flag: keyof ScramjetConfig["flags"]): boolean {
		const cached = this.flagCache.get(flag);
		if (cached !== undefined) return cached;

		const result = flagEnabled(flag, this.context, this.url);
		this.flagCache.set(flag, result);
		return result;
	}

	get config(): ScramjetConfig {
		return this.context.config;
	}

	// The client whose realm created `obj`.
	// note: this is based on a heuristic that can be fooled, i don't know of a 100% reliable way to do this
	relevantClient(obj: any): ScramjetClient {
		let current = obj;

		// bounded: a page can build an arbitrarily long prototype chain
		for (let i = 0; i < 64; i++) {
			if (current === null || current === undefined) break;

			const next = Object_getPrototypeOf(current);
			if (next === null) return this.box.realms.get(current) ?? this;

			current = next;
		}

		return this;
	}

	// generate a promise in the same realm as the relevant object
	relevantPromise<T>(
		relevantObject: any,
		callback: () => Promise<T>
	): Promise<T> {
		const RelevantPromise = this.relevantClient(relevantObject).nativeStore.get(
			"window"
		)!.Promise.value as PromiseConstructor;

		return new RelevantPromise<T>((resolve, reject) => {
			Promise_then(callback(), resolve, reject);
		});
	}
}
