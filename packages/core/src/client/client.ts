import {
	BareCompatibleClient,
	ProxyTransport,
	RawHeaders,
} from "@mercuryworkshop/proxy-transports";
import { SCRAMJETCLIENT } from "@/symbols";
import { IFACE_NAME } from "@client/iface";
import { QP } from "@/fetch/parse";
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
	BooleanFlag,
	HtmlRewriterHooks,
	ScramjetContext,
	ScramjetHeaders,
} from "@/shared";
import { iswindow } from "./entry";
import { SingletonBox } from "./singletonbox";
import { AttributeLayer } from "./attributes";
import { TextLayer } from "./text";
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
	Reflect_ownKeys,
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
	Object_assign,
	Promise_then,
	drain,
	String_startsWith,
	String_trim,
	String_split,
	String_toLowerCase,
	_RegExp,
	Array_includes,
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
	/**
	 * The native member, as the engine had it - past every other layer and
	 * past `Intercept`'s implementation. For the layer that needs the real
	 * thing; {@link next} is the member as the layers under this one see it.
	 */
	fn: GlobalTraverse<T>;
	/**
	 * Run the rest of the chain under this layer - the next wrapper inward,
	 * then `Intercept`'s implementation, then the native - with a receiver and
	 * arguments of the handler's choosing. Unlike {@link call} it leaves
	 * `ctx.this` / `ctx.args` alone and does not decide the return value, so
	 * it can run more than once, or not be the answer.
	 */
	next: IfEquals<
		U,
		"construct",
		(
			args: ConstructorParameters<GlobalTraverse<T>>,
			newTarget?: any
		) => InstanceType<GlobalTraverse<T>>,
		(
			that: ProxyApplyThis<T>,
			args: Parameters<GlobalTraverse<T>>
		) => ReturnType<GlobalTraverse<T>>
	>;
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

/**
 * The target for a half `Intercept` adds that the native attribute does not
 * have. Never reached by anything we ship, but `new Proxy(undefined)` throws,
 * so the half has to exist.
 */
const missingHalf = () => undefined;

/** One place a member is installed: the object that owns it, and how. */
type SlotSite = {
	owner: any;
	key: string | symbol;
	/** the descriptor the engine had there, whose attributes we keep */
	descriptor: PropertyDescriptor;
};

/**
 * `Intercept`'s implementation of one half of a member - the innermost layer.
 *
 * `enter` is the binding's own steps (the `this` substitution, the receiver
 * check, argument conversion, and a promise for an async operation), which
 * run once, on the way in, before any wrapper. `next` is the rest of the
 * chain: every wrapper, then `body`. A rejected argument list goes straight
 * to the native instead, so the native raises the error it would have.
 */
type SlotBase = {
	enter(that: any, args: any[], next: (that: any, args: any[]) => any): any;
	body(that: any, args: any[]): any;
};

/** The same, for a constructor: `newTarget` in place of `this`. */
type SlotConstructBase = {
	enter(
		args: any[],
		newTarget: any,
		next: (args: any[], newTarget: any) => any
	): any;
	body(args: any[], newTarget: any): any;
};

/**
 * One patched member, and everything layered on it.
 *
 * A member is patched once, with objects that never change afterwards: a
 * proxy over the native function for a method, and a proxy over each native
 * accessor half for an attribute. Those dispatch through the layers at call
 * time. So a page sees exactly one object where it would see the native, no
 * matter how many layers there are - one `box.unproxy` hop reaches the
 * native, one trampoline frame appears in a trace - and a layer added later
 * reaches a reference taken earlier.
 *
 * `Intercept` supplies the innermost layer and there is only ever one.
 * `Proxy` and `Trap` wrap outside it, the latest outermost. The same handler
 * object twice on one slot is one layer: two names can reach one member
 * (`HTMLScriptElement.prototype.textContent` *is* `Node.prototype
 * .textContent`), and stacking it would run the handler twice per call.
 */
type Slot = {
	/** the first name it was reached by, for errors and trampolines */
	member: string;
	/**
	 * Every place it is installed. More than one when the native is a
	 * function reachable under several names - `Function` and
	 * `Function.prototype.constructor`, `Set.prototype.keys` and `values` -
	 * which natively are one object, and so have to stay one after patching
	 */
	sites: SlotSite[];
	/** the native as the first site had it */
	native: PropertyDescriptor;
	tramp: Trampoline;
	base: {
		value?: SlotBase;
		get?: SlotBase;
		set?: SlotBase;
		construct?: SlotConstructBase;
	} | null;
	/** `Proxy` / `RawProxy` handlers, innermost first */
	calls: Proxy<any>[];
	/** `Trap` / `RawTrap` handlers, innermost first */
	traps: Trap<any>[];
	/** what the page sees, each made the first time it is needed */
	callable?: any;
	getter?: any;
	setter?: any;
	/** `Intercept` declared a half the native attribute does not have */
	addsGet?: boolean;
	addsSet?: boolean;
};

export type ScramjetModule = {
	enabled: (client: ScramjetClient, self: GlobalThis) => boolean | undefined;
	disabled: (client: ScramjetClient, self: GlobalThis) => void | undefined;
	order: number | undefined;
	default: (client: ScramjetClient, self: GlobalThis) => void;
};

function findBox(global: Window, seen: Window[]): SingletonBox | null {
	if (Array_includes(seen, global)) return null;
	seen[seen.length] = global;

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
	/** the creator's {@link originKey}, for a document that inherits it */
	private readonly creatorOriginKey: string | null;
	/** whether this document's frame sandbox forces it into an opaque origin */
	private readonly sandboxedOrigin: boolean;
	serviceWorker: ServiceWorkerContainer;
	bare: BareCompatibleClient;
	/** builds errors a page cannot tell from the browser's own */
	errors: NativeErrors;

	wrapfn: (i: any, ...args: any) => any;

	meta: URLMeta;

	box: SingletonBox;

	/** The attribute layer: every attribute read and write goes through it. */
	attributes: AttributeLayer;
	/** The text layer: a script's and a style's source, and the text around them. */
	text: TextLayer;

	context: ScramjetContext;

	initHeaders: ScramjetHeaders;

	history: TrackedHistoryState[];

	/** Assigned by {@link SingletonBox.registerClient}. */
	id: string;

	/**
	 * Flags as read for `flagCacheTop`, so a repeat read skips the `siteFlags`
	 * regexes. Keyed on the top URL rather than kept for the client's life,
	 * which is what left a popup reading its flags for `about:blank`.
	 */
	private flagCache = new _Map<keyof ScramjetConfig["flags"], boolean>();
	private flagCacheTop: string | null = null;

	/** The members patched in this realm, keyed on the object that owns them. */
	private slots = new _WeakMap<object, _Map<string | symbol, Slot>>();
	/** The same slots, keyed on the native function a method slot replaced. */
	private slotsByNative = new _WeakMap<object, Slot>();
	/** Set once `hook` has installed every module; `Intercept` is closed after. */
	private hooked = false;

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
				// Each class closes over this client's fixed native descriptor table.
				const cached = this.nativeClasses.get(prototype);
				if (cached) return cached;
				const descriptors = this.nativeStore.get(prototype);
				if (!descriptors) {
					throw new Error(`No native descriptors found for ${prototype}`);
				}
				const nativeClass = class {
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
										// not `desc.get.call`: that looks `call` up on
										// Function.prototype, which the page can replace
										return Reflect_apply(desc.get, object, []);
									}
								},
								set(_target, method: string, value: any) {
									const desc = descriptors[method];
									if (!desc || !desc.set) {
										throw new Error(
											`No native setter ${method.toString()} found for ${prototype}`
										);
									}
									Reflect_apply(desc.set, object, [value]);
									return true;
								},
							}
						);
					}
				};
				this.nativeClasses.set(prototype, nativeClass);
				return nativeClass;
			},
		}
	);
	private nativeClasses = new _Map<string, any>();
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
		for (const key of drain(Object_getOwnPropertyNames(this.global))) {
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
		this.attributes = new AttributeLayer(this);
		this.text = new TextLayer(this);

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
		const creator = this.captureCreator();
		this.creatorOrigin = creator ? creator.siteOrigin : null;
		this.creatorOriginKey = creator ? creator.originKey : null;
		this.sandboxedOrigin = this.captureSandboxedOrigin();

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
			get topUrl() {
				return client.topUrl;
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
			get topFrameName() {
				if (!iswindow)
					throw new Error("topFrameName was called from a worker?");
				if (client.parentFrame() === "top") return null;

				return client.topmostClient().frameName();
			},
			get parentFrameName() {
				if (!iswindow)
					throw new Error("parentFrameName was called from a worker?");

				const parent = client.parentFrame();
				if (parent === "top" || parent === "unreachable") return null;
				// a parent outside the sandbox is the embedder, and the frame it
				// made for us is the one targets name
				if (parent === "foreign") return client.frameName();

				return parent.frameName();
			},
			get referrerPolicy(): string | undefined {
				if (client.initHeaders && client.initHeaders.has("referrer-policy")) {
					return client.initHeaders.get("referrer-policy");
				}
				if (!iswindow) return "";
				// TODO: need to nullify the actual meta tag so it still sends unsafe-url
				const nDoc = new client.native.Document(client.global.document);
				// only the last match counts, so look for it list by list from the
				// back. Indexed, and not `drain`: a NodeList is a live platform
				// collection, and spreading it ran the page-replaceable
				// iteration protocol over what decides the referrer policy
				let last: Element | undefined;
				for (const selector of drain([
					"meta[http-equiv='referrer-policy']",
					"meta[name='referrer-policy']",
					"meta[name='referrer']",
				])) {
					const list = nDoc.querySelectorAll(selector);
					last = list[list.length - 1];
					if (last) break;
				}
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
		// every module's `Proxy` and `Trap` handlers are fresh closures on each
		// run, so a second hook would stack a second copy of all of them
		if (this.hooked) throw new Error("client.hook() called twice");

		const context = import.meta.webpackContext(".", {
			recursive: true,
		});

		const modules: ScramjetModule[] = [];

		for (const key of drain(context.keys())) {
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

		for (const module of drain(modules)) {
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

		// read once every module has installed and before any page script has
		// run, so these are our interceptors rather than the page's
		const EventTarget_prototype = this.global.EventTarget.prototype;
		this.listenerMethods = {
			add: Object_getOwnPropertyDescriptor(
				EventTarget_prototype,
				"addEventListener"
			).value,
			remove: Object_getOwnPropertyDescriptor(
				EventTarget_prototype,
				"removeEventListener"
			).value,
		};

		this.hooked = true;
	}

	/**
	 * `addEventListener` / `removeEventListener` as the page sees them *after*
	 * hooking - `shared/event.ts`'s interceptors, not the natives.
	 *
	 * For a listener scramjet registers on the page's behalf, like the one
	 * behind a faked `on*` handler (see `EventHandlerSlot`). Going through the
	 * interceptor is the point: that is what hands it the same stand-in event
	 * the page's own listeners get. Captured once in `hook`, because reading it
	 * off `EventTarget.prototype` at the time would find whatever the page has
	 * put there since.
	 */
	listenerMethods: { add: AnyFunction; remove: AnyFunction } | null = null;

	/**
	 * Dispatch `event` at `target` on the platform's behalf.
	 *
	 * For an event the browser would have fired but cannot, because scramjet
	 * fakes the object that fires it - a WebSocket's `open`, `message`,
	 * `close` and `error`. Anything dispatched from script reads back
	 * `isTrusted === false`, and `isTrusted` is [LegacyUnforgeable], so the
	 * event is marked in `box.trustedEvents` instead and `shared/event.ts`
	 * answers `true` for it on the stand-in its listeners get.
	 *
	 * Through the saved native rather than `target.dispatchEvent`: that is a
	 * prototype lookup the page can redirect, and it would then be handed every
	 * event scramjet fires.
	 */
	dispatchEvent(target: EventTarget, event: Event): boolean {
		this.box.trustedEvents.add(event);

		return Reflect_apply(
			this.nativeStore.get("EventTarget").dispatchEvent.value,
			target,
			[event]
		);
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
	private captureCreator(): ScramjetClient | null {
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
			return creatorClient;
		} catch {
			// reading `parent` or `opener` threw, so the creator is cross-origin
			// to the *proxy* itself and is outside the sandbox
			return null;
		}
	}

	/**
	 * Whether the frame this document was loaded into is sandboxed without
	 * `allow-same-origin`, which gives the document an opaque origin whatever
	 * its URL says.
	 *
	 * The rewrite rule strips the real attribute - a sandboxed frame cannot run
	 * the proxy - so the browser never gives the document the origin it is
	 * owed, and the page's value has to be read back off the mirror. Read once,
	 * like the creator: the flags are fixed when the document is created.
	 *
	 * https://html.spec.whatwg.org/multipage/browsers.html#sandboxed-origin-browsing-context-flag
	 */
	private captureSandboxedOrigin(): boolean {
		if (!iswindow) return false;

		// https://html.spec.whatwg.org/multipage/browsers.html#determining-the-creation-sandboxing-flags
		// the parent document's active flags are inherited whatever the frame's
		// own attribute says, and an `allow-same-origin` on it cannot lift them
		const parent = this.parentFrame();
		if (typeof parent === "object" && parent.sandboxedOrigin) return true;

		try {
			const frame = new this.native.window(this.global).frameElement;
			if (!frame) return false;

			const sandbox = this.attributes.get(frame, "sandbox");
			if (sandbox === null) return false;

			// an unordered set of ASCII-whitespace-separated, ASCII
			// case-insensitive tokens
			const tokens = String_split(
				String_toLowerCase(sandbox),
				new _RegExp("[\\t\\n\\f\\r ]+")
			);
			for (const token of drain(tokens)) {
				if (token === "allow-same-origin") return false;
			}

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * `"Element.prototype.innerHTML"` as the object that owns the last name
	 * and that name, walked from this client's global. Null when a step along
	 * the way is missing from this realm.
	 */
	private resolvePath(name: string): { owner: any; prop: string } | null {
		const path = String_split(name, ".");
		const prop = path[path.length - 1];
		let owner: any = this.global;
		for (let i = 0; i < path.length - 1; i++) {
			owner = owner?.[path[i]];
		}

		return owner && prop ? { owner, prop } : null;
	}

	/**
	 * This document's origin as `postMessage` compares it: the serialized
	 * origin for a tuple origin, or for an opaque one a key unique to it -
	 * shared only with the documents that inherit it. Compare these for
	 * equality, and never show one to a page; {@link serializeOriginKey} is
	 * what `MessageEvent.origin` says.
	 *
	 * Unlike {@link siteOrigin} it can say *opaque*: a sandboxed frame, a
	 * `data:` document, and an about:blank with no creator scramjet knows each
	 * get an origin equal to nothing but itself, not a shared "null" that would
	 * match every other opaque document.
	 *
	 * https://html.spec.whatwg.org/multipage/browsers.html#concept-origin
	 */
	get originKey(): string {
		if (this.sandboxedOrigin) return this.opaqueScope;

		const url = this.url;
		const href = String_split(url.href, "#")[0];
		if (
			href === "about:blank" ||
			String_startsWith(href, "about:blank?") ||
			href === "about:srcdoc"
		) {
			return this.creatorOriginKey ?? this.opaqueScope;
		}

		const origin = url.origin;

		return origin === "null" ? this.opaqueScope : origin;
	}

	// below are the utilities for proxying and trapping dom APIs. They all
	// install through a `Slot`, which is where the layering is explained

	/**
	 * Wrap a method or constructor, named from this client's global.
	 *
	 * Goes outside whatever already wraps the member - and outside
	 * `Intercept`'s implementation of it, if it has one, whose argument
	 * conversion has then already run by the time the handler sees `ctx.args`.
	 */
	Proxy<T extends string>(name: T, handler: Proxy<T>): void {
		const target = this.resolvePath(name);
		if (!target) return;

		this.RawProxy(target.owner, target.prop, handler, name);
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
	 * The slot for `key` as reached from `target`, made on the first patch to
	 * reach it.
	 *
	 * Null - loudly for a member that cannot be replaced, silently for one this
	 * engine does not have - when there is nothing to patch. Adding a member
	 * that isn't there advertises the patch rather than hiding it.
	 */
	private slotFor(
		target: any,
		key: string | symbol,
		member: string
	): Slot | null {
		// walked rather than read straight off `target`, because where an engine
		// puts an interface's members is not fixed. Blink installs the global
		// scope's own onto the window instance but a worker's onto
		// `WorkerGlobalScope.prototype`, and an own-property-only lookup finds
		// nothing there - so the patch lands on `target` as a *shadowing own
		// property*, which the native does not have and a page can see
		let owner = target;
		while (owner) {
			const existing = this.slots.get(owner)?.get(key);
			if (existing) return existing;

			const descriptor = Object_getOwnPropertyDescriptor(owner, key);
			if (descriptor) {
				if (!descriptor.configurable) {
					dbg.error(`cannot intercept non-configurable ${member}`);

					return null;
				}

				const site: SlotSite = { owner, key, descriptor };
				const value = descriptor.value;

				// the same function under another name. It is one object
				// natively, so it is one slot here, and the next render puts the
				// slot's object in this place too
				const shared =
					typeof value === "function"
						? this.slotsByNative.get(value)
						: undefined;
				if (shared) {
					shared.sites[shared.sites.length] = site;
					this.registerSite(shared, site);
					this.render(shared);

					return shared;
				}

				const slot: Slot = {
					member,
					sites: [site],
					native: descriptor,
					tramp: this.trampoline(member),
					base: null,
					calls: [],
					traps: [],
				};
				this.registerSite(slot, site);
				if (typeof value === "function") this.slotsByNative.set(value, slot);

				return slot;
			}
			owner = Object_getPrototypeOf(owner);
		}

		return null;
	}

	private registerSite(slot: Slot, site: SlotSite): void {
		let keys = this.slots.get(site.owner);
		if (!keys) {
			keys = new _Map<string | symbol, Slot>();
			this.slots.set(site.owner, keys);
		}
		keys.set(site.key, slot);
	}

	/**
	 * Put a slot's objects where the native was, at every site.
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
	 *
	 * Run again on every change. The objects themselves are made once, so this
	 * only ever changes the descriptor's shape - a data property becoming an
	 * accessor when a trap is put over it - and which halves are ours.
	 */
	private render(slot: Slot): void {
		const native = slot.native;
		const isData = !native.get && !native.set;
		const base = slot.base;
		let trapsGet = false;
		let trapsSet = false;
		for (let i = 0; i < slot.traps.length; i++) {
			if (slot.traps[i].get) trapsGet = true;
			if (slot.traps[i].set) trapsSet = true;
		}

		if (slot.calls.length > 0 || base?.value || base?.construct) {
			this.callableFor(slot);
		}

		const next: PropertyDescriptor = {};
		if (isData && slot.traps.length === 0) {
			next.value = slot.callable ?? native.value;
		} else if (isData) {
			// a trap over a data property, which it turns into an accessor. It
			// has no native halves to stand behind, so these are plain
			// functions, and a setter only if some trap declared one - a write
			// nothing handles is dropped, as it always was
			slot.getter ??= this.dataHalf(slot, "get");
			next.get = slot.getter;
			if (trapsSet) slot.setter ??= this.dataHalf(slot, "set");
			next.set = slot.setter;
		} else {
			// a trap's half with no native half behind it is ignored rather than
			// invented; only `Intercept` can add one
			if ((base?.get || trapsGet) && (native.get || slot.addsGet)) {
				slot.getter ??= this.accessorHalf(slot, "get");
			}
			if ((base?.set || trapsSet) && (native.set || slot.addsSet)) {
				slot.setter ??= this.accessorHalf(slot, "set");
			}
			// both keys, always: `defineProperty` merges a partial descriptor
			// into the one already there, which would keep a half we meant to
			// leave native pointing at whatever was installed before
			next.get = slot.getter ?? native.get;
			next.set = slot.setter ?? native.set;
		}

		for (let i = 0; i < slot.sites.length; i++) {
			const site = slot.sites[i];
			const descriptor: PropertyDescriptor = {
				enumerable: site.descriptor.enumerable,
				configurable: site.descriptor.configurable,
			};
			if ("value" in next) {
				descriptor.value = next.value;
				descriptor.writable = site.descriptor.writable;
			} else {
				descriptor.get = next.get;
				descriptor.set = next.set;
			}
			Object_defineProperty(site.owner, site.key, descriptor);
		}
	}

	/** What the page sees for a method or constructor slot. */
	private callableFor(slot: Slot): any {
		if (slot.callable) return slot.callable;

		const fn = slot.native.value;
		const callable = new Proxy(fn, {
			apply: (_target, thisArg, args) =>
				this.dispatchApply(slot, thisArg, args),
			// only reachable when `fn` is a constructor: a proxy has
			// [[Construct]] exactly when its target does
			construct: (_target, args, newTarget) =>
				this.dispatchConstruct(slot, args, newTarget),
			getOwnPropertyDescriptor: getOwnPropertyDescriptorHandler,
		});
		slot.callable = callable;
		// `Function.prototype.toString` on a proxy renders `function () {
		// [native code] }` - no name - where the native it stands in for
		// renders `function fetch() { [native code] }`. `shared/sourcemaps.ts`
		// unwraps through this table so the real source text answers, and
		// there is only ever the one hop
		this.box.unproxy.set(callable, fn);
		// something that later reaches this object under another name is
		// reaching the same member
		this.slotsByNative.set(callable, slot);

		return callable;
	}

	/** One half of an accessor slot, as a proxy over the native half. */
	private accessorHalf(slot: Slot, half: "get" | "set"): any {
		const target = slot.native[half] ?? missingHalf;
		const proxy = new Proxy(target, {
			apply: (_target, thisArg, args) =>
				half === "get"
					? this.dispatchGet(slot, thisArg, args)
					: this.dispatchSet(slot, thisArg, args),
		});
		this.box.unproxy.set(proxy, target);

		return proxy;
	}

	/** One half of a data slot a trap has turned into an accessor. */
	private dataHalf(slot: Slot, half: "get" | "set"): any {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const client = this;
		if (half === "get") {
			return function (this: any) {
				return client.dispatchGet(slot, this, []);
			};
		}

		return function (this: any, v: any) {
			client.dispatchSet(slot, this, [v]);
		};
	}

	private dispatchApply(slot: Slot, thisArg: any, args: any[]): any {
		const base = slot.base?.value;
		const run = (that: any, a: any[]) =>
			this.applyLayer(slot, slot.calls.length - 1, that, a);

		return base ? base.enter(thisArg, args, run) : run(thisArg, args);
	}

	/** Layer `i` of a method slot, counting inward from the outermost. */
	private applyLayer(slot: Slot, i: number, that: any, args: any[]): any {
		while (i >= 0 && !slot.calls[i].apply) i--;
		if (i < 0) {
			const base = slot.base?.value;

			return base
				? base.body(that, args)
				: slot.tramp.apply(slot.native.value, that, args);
		}

		const at = i;
		const handler = slot.calls[at];
		let returnValue: any = undefined;
		let earlyreturn = false;

		const ctx: ProxyCtx<any, "apply"> = {
			fn: slot.native.value,
			next: (t: any, a: any[]) => this.applyLayer(slot, at - 1, t, a),
			this: that,
			args,
			newTarget: null,
			return: (r: any) => {
				earlyreturn = true;
				returnValue = r;
			},
			call: () => {
				earlyreturn = true;
				returnValue = this.applyLayer(slot, at - 1, ctx.this, ctx.args);

				return returnValue;
			},
		};
		// Called bare, the way `constructLayer` and `Intercept` both do.
		//
		// This used to run under a swapped-out `Error.prepareStackTrace` that
		// tagged any error whose top frame was outside the proxy prefix as
		// "from scramjet internals", logged it, and - with
		// `allowFailedIntercepts`, which the controller turns on - threw it away
		// and fell through to the native. That was written when an interceptor
		// throwing meant an interceptor was broken. It no longer does:
		// `client.errors` exists so members can throw the DOMException the spec
		// asks for, and every one of those is built in scramjet code, so it
		// looked exactly like a bug and got swallowed.
		//
		// Catching cost more than the diagnostic was worth even when it
		// rethrew. `err.stack` was replaced with an object and then put back,
		// which is observable; `Error.prepareStackTrace` is global and
		// `shared/error.ts` wants it for `cleanErrors`; and a rethrow moves the
		// throw site into this file, which re-points the `filename` a page sees
		// on the resulting error at scramjet.js.
		slot.tramp.apply(handler.apply, handler, [ctx]);

		if (earlyreturn) return returnValue;

		return this.applyLayer(slot, at - 1, ctx.this, ctx.args);
	}

	private dispatchConstruct(slot: Slot, args: any[], newTarget: any): any {
		const base = slot.base?.construct;
		const run = (a: any[], nt: any) =>
			this.constructLayer(slot, slot.calls.length - 1, a, nt);

		return base ? base.enter(args, newTarget, run) : run(args, newTarget);
	}

	private constructLayer(
		slot: Slot,
		i: number,
		args: any[],
		newTarget: any
	): any {
		while (i >= 0 && !slot.calls[i].construct) i--;
		if (i < 0) {
			const base = slot.base?.construct;

			return base
				? base.body(args, newTarget)
				: slot.tramp.construct(slot.native.value, args, newTarget);
		}

		const at = i;
		const handler = slot.calls[at];
		let returnValue: any = undefined;
		let earlyreturn = false;

		const ctx: ProxyCtx<any, "construct"> = {
			fn: slot.native.value,
			next: (a: any[], nt: any = ctx.newTarget) =>
				this.constructLayer(slot, at - 1, a, nt),
			this: null,
			args,
			newTarget,
			return: (r: any) => {
				earlyreturn = true;
				returnValue = r;
			},
			call: () => {
				earlyreturn = true;
				returnValue = this.constructLayer(
					slot,
					at - 1,
					ctx.args,
					ctx.newTarget
				);

				return returnValue;
			},
		};

		slot.tramp.apply(handler.construct, handler, [ctx]);

		if (earlyreturn) return returnValue;

		return this.constructLayer(slot, at - 1, ctx.args, ctx.newTarget);
	}

	private dispatchGet(slot: Slot, thisArg: any, args: any[]): any {
		const base = slot.base?.get;
		const run = (that: any) => this.getLayer(slot, slot.traps.length - 1, that);

		return base ? base.enter(thisArg, args, run) : run(thisArg);
	}

	private getLayer(slot: Slot, i: number, that: any): any {
		while (i >= 0 && !slot.traps[i].get) i--;
		if (i < 0) {
			const base = slot.base?.get;
			if (base) return base.body(that, []);

			// `native` is the descriptor from the *owner*, so this answers with
			// the real value for an inherited member. Read off the object the
			// call site named it would have been undefined, and a trap that
			// falls through to `ctx.get()` would have silently erased the
			// member it was wrapping
			const native = slot.native;
			if (native.get) return slot.tramp.apply(native.get, that, []);

			return slot.callable ?? native.value;
		}

		const handler = slot.traps[i];

		return slot.tramp.apply(handler.get, handler, [
			this.trapCtx(slot, i, that),
		]);
	}

	private dispatchSet(slot: Slot, thisArg: any, args: any[]): any {
		const base = slot.base?.set;
		const run = (that: any, a: any[]) =>
			this.setLayer(slot, slot.traps.length - 1, that, a[0]);

		return base ? base.enter(thisArg, args, run) : run(thisArg, args);
	}

	private setLayer(slot: Slot, i: number, that: any, v: any): void {
		while (i >= 0 && !slot.traps[i].set) i--;
		if (i < 0) {
			const base = slot.base?.set;
			if (base) {
				base.body(that, [v]);
			} else if (slot.native.set) {
				slot.tramp.apply(slot.native.set, that, [v]);
			}

			return;
		}

		const handler = slot.traps[i];
		slot.tramp.apply(handler.set, handler, [this.trapCtx(slot, i, that), v]);
	}

	/** The context trap `i` runs with: one per access, so a re-entrant one keeps its own `this`. */
	private trapCtx(slot: Slot, i: number, that: any): TrapCtx<any> {
		const ctx: TrapCtx<any> = {
			this: that,
			get: () => this.getLayer(slot, i - 1, ctx.this),
			set: (v: any) => this.setLayer(slot, i - 1, ctx.this, v),
		};

		return ctx;
	}

	/**
	 * Wrap the method or constructor `prop` reached from `target`.
	 *
	 * `target` only says where the lookup starts: the member is patched on
	 * whichever object in its prototype chain owns it, so this wraps it for
	 * every object that inherits it, never for `target` alone.
	 */
	RawProxy(target: any, prop: string, handler: Proxy<any>, debugname?: string) {
		if (!target) return;
		if (!prop) return;

		const member = debugname ?? prop;
		const slot = this.slotFor(target, prop, member);
		if (!slot) return;

		if (typeof slot.native.value !== "function") {
			dbg.error(`cannot proxy ${member}: it is not a method`);

			return;
		}
		if (Array_includes(slot.calls, handler)) return;

		slot.calls[slot.calls.length] = handler;
		this.render(slot);
	}

	/** Wrap an attribute, named from this client's global. See `RawTrap`. */
	Trap<T extends string>(name: T, descriptor: Trap<T>): void {
		const target = this.resolvePath(name);
		if (!target) return;

		this.RawTrap(target.owner, target.prop, descriptor, name);
	}

	/**
	 * Wrap the attribute `prop` reached from `target`, outside whatever already
	 * wraps it. Found and patched the way `RawProxy` finds and patches.
	 */
	RawTrap(
		target: any,
		prop: string,
		descriptor: Trap<any>,
		debugname?: string
	) {
		if (!target) return;
		if (!prop) return;

		const slot = this.slotFor(target, prop, debugname ?? prop);
		if (!slot) return;

		// an accessor's halves are replaced, never invented: a trap that
		// declares a setter for a readonly attribute used to get one installed,
		// which is a shape no browser has. A data property has no halves to
		// match, so a trap over one may declare whichever it needs
		const native = slot.native;
		const isAccessor = !!(native.get || native.set);
		const usable =
			(descriptor.get && (!isAccessor || native.get || slot.addsGet)) ||
			(descriptor.set && (!isAccessor || native.set || slot.addsSet));
		// a trap whose every declared half was refused - a setter-only trap
		// over a readonly attribute. Leave the member alone rather than
		// rewrite its descriptor with itself
		if (!usable) return;
		if (Array_includes(slot.traps, descriptor)) return;

		slot.traps[slot.traps.length] = descriptor;
		this.render(slot);
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
		// the one implementation of a member is scramjet's, and every module
		// has installed its own by now. Anything after is layering on top of
		// it, which is what `Proxy` and `Trap` are for
		if (this.hooked) {
			throw new Error(
				"client.Intercept() after client.hook() - wrap the member with client.Proxy() or client.Trap() instead"
			);
		}

		const foreignbaseclass = Object_getPrototypeOf(handler);
		const globalname: string =
			foreignbaseclass[IFACE_NAME] ?? foreignbaseclass.name;
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

		/**
		 * One half of `Intercept`'s implementation of a member, as the
		 * innermost layer of its slot.
		 */
		const createBase = (
			body: (...args: any[]) => any,
			old: ((...args: any[]) => any) | undefined,
			validate: IDLValidator | undefined,
			tramp: Trampoline,
			check: ((receiver: any) => void) | undefined
		): SlotBase => {
			// settled once, at install time, rather than on every call
			const isAsync =
				Object_getPrototypeOf(body) === AsyncFunction_prototype ||
				String_startsWith(
					String_trim(idlSignature(body)?.returns ?? ""),
					"Promise<"
				);
			const target = old || missingHalf;

			return {
				enter: (thisArg, args, next) => {
					// https://webidl.spec.whatwg.org/#dfn-create-operation-function
					// step 2, and the identical step in "create an attribute
					// getter" and "create an attribute setter": "Let esValue be
					// the this value, if it is not null or undefined, or the
					// current realm's global object otherwise."
					//
					// This is what makes an unqualified `addEventListener(...)`
					// work. The reference resolves against the global environment
					// record, whose WithBaseObject is undefined, so the native is
					// called with a `this` of undefined and WebIDL substitutes the
					// global. An interceptor body is strict-mode code, so without
					// this it sees that undefined instead - and then either throws
					// where a browser does not, or keys per-target state on a
					// primitive, which is how `shared/event.ts` came to throw
					// "Invalid value used as weak map key" out of every bare
					// `addEventListener`.
					//
					// For an interface the global does not implement, the body's
					// own `super.x()` brand-checks it and raises exactly the
					// TypeError the native would have.
					const that =
						thisArg === null || thisArg === undefined ? this.global : thisArg;

					const invoke = () => {
						// https://webidl.spec.whatwg.org/#dfn-create-operation-function
						check?.(that);
						// rejected: the native raises the error it would have
						if (validate && !validate(args)) {
							return tramp.apply(target, that, args);
						}

						return next(that, args);
					};

					// Promise-returning operations reject for *all* binding
					// exceptions, including receiver checks, conversion, and the
					// native fallback - and for a wrapper's throw, which runs
					// inside the same operation
					return isAsync ? this.relevantPromise(that, invoke) : invoke();
				},
				body: (that, args) => tramp.apply(body, that, args),
			};
		};

		const writePrototypeField = (
			key: string | symbol,
			prototype: any,
			handlerDescriptor: PropertyDescriptor,
			instance: boolean
		) => {
			const member = `${classname}.${String(key)}`;
			const slot = this.slotFor(prototype, key, member);
			if (!slot) return;
			if (slot.base) {
				dbg.error(
					`${member} was already intercepted - one member has one implementation, so the second is being skipped`
				);

				return;
			}

			const old = slot.native;
			const check = instance ? checkReceiver : undefined;
			const base: NonNullable<Slot["base"]> = {};

			if (old.get || old.set) {
				if (handlerDescriptor.get && !old.get) {
					dbg.warn(
						`Intercept(${member}) adds a getter absent from the native attribute`
					);
					slot.addsGet = true;
				}
				if (handlerDescriptor.set && !old.set) {
					dbg.warn(
						`Intercept(${member}) adds a setter absent from the native attribute`
					);
					slot.addsSet = true;
				}
				// a getter takes no arguments, so there is nothing to validate on one
				if (handlerDescriptor.get) {
					base.get = createBase(
						handlerDescriptor.get,
						old.get,
						undefined,
						slot.tramp,
						check
					);
				}
				if (handlerDescriptor.set) {
					base.set = createBase(
						handlerDescriptor.set,
						old.set,
						memberValidator(this.box, handlerDescriptor.set, true),
						slot.tramp,
						check
					);
				}
			} else if ("value" in handlerDescriptor) {
				base.value = createBase(
					handlerDescriptor.value,
					old.value,
					memberValidator(this.box, handlerDescriptor.value),
					slot.tramp,
					check
				);
			} else {
				return;
			}

			slot.base = base;
			this.render(slot);
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

		for (const prop of drain(Reflect_ownKeys(prototypeDescs))) {
			const classDesc = prototypeDescs[prop];
			if (isClassMetadata(prop, classDesc, false)) continue;
			if (isConstructorMember(classDesc.value)) continue;
			writePrototypeField(prop, baseclass.prototype, classDesc, true);
		}
		for (const prop of drain(Reflect_ownKeys(staticDescs))) {
			const handlerDesc = staticDescs[prop];
			if (isClassMetadata(prop, handlerDesc, true)) continue;
			const value = handlerDesc.value;
			if (value && isConstructorMember(value)) {
				const member = `new ${globalname}`;
				// the interface object isn't a field of anything but the global,
				// so the class itself is the member
				const slot = this.slotFor(this.global, globalname, member);
				if (!slot) continue;
				if (slot.base) {
					dbg.error(
						`${member} was already intercepted - one member has one implementation, so the second is being skipped`
					);
					continue;
				}

				const nativeCtor = slot.native.value;
				const validate = memberValidator(this.box, value);
				const tramp = slot.tramp;

				slot.base = {
					construct: {
						enter: (args, newTarget, next) => {
							// a rejected argument list has to reach the native as a
							// *construction*, or the page sees "cannot be invoked
							// without 'new'" where it should see the arity TypeError
							if (validate && !validate(args)) {
								return tramp.construct(nativeCtor, args, newTarget);
							}

							return next(args, newTarget);
						},
						body: (args, newTarget) => {
							// `new this(...)` in a `@Constructor` body has to reach the
							// native with the *page's* newTarget. Handing the body the
							// bare native constructor threw it away, so
							// `class Sub extends Request {}` produced an instance
							// carrying `Request.prototype` and `new Sub() instanceof
							// Sub` was false - while the rejection path above, which
							// does pass it on, got it right. A plain
							// `new Request(...)` names the slot's object as its
							// newTarget and wants the native constructor itself, which
							// is both the common case and the one that allocates nothing
							const construct =
								newTarget === slot.callable
									? nativeCtor
									: new Proxy(nativeCtor, {
											construct: (_target, inner) =>
												tramp.construct(nativeCtor, inner, newTarget),
										});

							// `construct` is the body's `this`, which is what makes
							// the `new this()` syntax work
							const constructed = tramp.apply(value, construct, args);

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
					},
				};
				this.render(slot);

				// https://webidl.spec.whatwg.org/#interface-prototype-object
				// "The interface prototype object must also have a property
				// named `constructor` [...] whose value is a reference to the
				// interface object."
				//
				// The page-visible interface object is now the slot's object, so
				// leaving the native one on the prototype makes
				// `X.prototype.constructor === X` false - an identity that holds
				// for every interface in every engine, and so a one-expression
				// enumeration of exactly which interfaces we construct through.
				// Reaching it is enough: it holds the same native function, so
				// `slotFor` puts it in the same slot, with the native's own
				// attributes (writable, not enumerable, configurable).
				//
				// Only when the prototype's `constructor` is the very function
				// being replaced. A legacy factory - `Audio`, `Image`, `Option` -
				// is not an interface object and does not own its `.prototype`:
				// `Audio.prototype` *is* `HTMLAudioElement.prototype`, whose
				// `constructor` correctly names `HTMLAudioElement`. Rewriting
				// that one would break the identity for the interface it really
				// belongs to, which is the same bug one interface over.
				const prototype = nativeCtor.prototype;
				const constructorDescriptor =
					prototype &&
					Object_getOwnPropertyDescriptor(prototype, "constructor");
				if (
					constructorDescriptor &&
					(constructorDescriptor.value === nativeCtor ||
						constructorDescriptor.value === slot.callable)
				) {
					this.slotFor(
						prototype,
						"constructor",
						`${globalname}.prototype.constructor`
					);
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

	/**
	 * This window's parent, as far as scramjet can see it: `"top"` for a
	 * top-level window, `"unreachable"` for a parent in another origin (an
	 * opaque sandboxed frame's), `"foreign"` for one scramjet does not control
	 * - the embedder - and otherwise the parent's client.
	 */
	parentFrame(): ScramjetClient | "top" | "unreachable" | "foreign" {
		try {
			const parent = this.global.parent.window;
			if (parent === this.global.window) return "top";

			return parent[SCRAMJETCLIENT] ?? "foreign";
		} catch {
			return "unreachable";
		}
	}

	/** The topmost scramjet-controlled window this one is inside, or itself. */
	topmostClient(): ScramjetClient {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let current: ScramjetClient = this;
		for (;;) {
			const parent = current.parentFrame();
			if (typeof parent !== "object") return current;
			current = parent;
		}
	}

	/**
	 * The name of the frame element holding this window, which is what the
	 * page's `_top` and `_parent` targets are rewritten to. Null when there is
	 * no frame element to be seen.
	 */
	frameName(): string | null {
		const frame = new this.native.window(this.global).frameElement;
		if (!frame) return null;
		if (!frame.name) {
			dbg.error(
				"YOU NEED TO USE `new ScramjetFrame()`! DIRECT IFRAMES WILL NOT WORK"
			);

			return null;
		}

		return frame.name;
	}

	// The URL of the top-level frame this client belongs to
	get topUrl(): _URL {
		const parent = iswindow ? this.parentFrame() : "unreachable";
		let top: _URL | null = null;
		if (typeof parent === "object") {
			top = parent.topUrl;
		} else if (parent === "unreachable") {
			try {
				const carried = new _URL(this.global.location.href).searchParams.get(
					QP.topUrl
				);
				if (carried) top = new _URL(carried);
			} catch {
				// not a URL scramjet made
			}
		}

		return top ?? this.url;
	}

	flagEnabled(flag: BooleanFlag): boolean {
		const top = this.topUrl;
		if (top.href !== this.flagCacheTop) {
			this.flagCache.clear();
			this.flagCacheTop = top.href;
		}

		const cached = this.flagCache.get(flag);
		if (cached !== undefined) return cached;

		const result = flagEnabled(flag, this.context, top);
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
			if (next === null) return this.box.objectPrototypes.get(current) ?? this;

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
