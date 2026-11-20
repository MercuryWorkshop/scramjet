import { iswindow } from "@client/entry";
import { Arguments, Returns } from "@client/webidl";
import { ScramjetClient, type Trap } from "@client/index";
import {
	readAddEventListenerOptions,
	readEventListenerOptions,
} from "@client/helpers";
import {
	Object_defineProperty,
	Object_getOwnPropertyDescriptor,
	Object_getOwnPropertyNames,
	Object_hasOwn,
	Object_keys,
	Reflect_apply,
	Reflect_get,
	String_indexOf,
	String_startsWith,
	String_substring,
	_Map,
	_WeakMap,
	drain,
	Array_includes,
} from "@/shared/snapshot";

export default function (client: ScramjetClient, self: Self) {
	const handlers = {
		message: {
			init(this: MessageEvent) {
				if (client.init.shouldBlockMessageEvent?.(this)) {
					return false;
				}

				return true;
			},
			props: {
				source(this: MessageEvent) {
					if (this.source === null) return null;

					const data = this.data;
					if (
						typeof data === "object" &&
						data !== null &&
						Object_hasOwn(data, "$scramjet$messagetype")
					) {
						const cl = client.box.clientIds.get(data.$scramjet$clientid);
						// a sender whose client has since gone - its document
						// navigated away - leaves nothing better than the native
						if (cl) return cl.global;
					}

					return this.source;
				},
				/**
				 * The *sender's* origin, fixed when the message was posted.
				 *
				 * `postmessage.ts` stamps every message it sends with a
				 * `$scramjet$messagetype` saying which shape it is, so that is
				 * what gets read here rather than guessing from whether an
				 * origin happens to be present.
				 */
				origin(this: MessageEvent) {
					const data = this.data;

					if (
						typeof data === "object" &&
						data !== null &&
						Object_hasOwn(data, "$scramjet$messagetype")
					) {
						// ports, workers and a worker's own `postMessage` carry no
						// origin, and neither does the event a browser fires for
						// them - it is the empty string
						if (data.$scramjet$messagetype === "worker") return "";

						if (Object_hasOwn(data, "$scramjet$origin"))
							return data.$scramjet$origin;
					}

					// not one of ours: a control message from the service worker or
					// the embedder. its native origin is the *proxy's*, so that is
					// the one answer we must not give; the site's own leaks nothing
					return client.url.origin;
				},
				data(this: MessageEvent) {
					const data = this.data;

					if (
						typeof data === "object" &&
						data !== null &&
						Object_hasOwn(data, "$scramjet$data")
					)
						return data.$scramjet$data;

					return data;
				},
			},
		},
		hashchange: {
			props: {
				oldURL(this: HashChangeEvent) {
					return client.unrewriteUrl(this.oldURL);
				},
				newURL(this: HashChangeEvent) {
					return client.unrewriteUrl(this.newURL);
				},
			},
		},
		storage: {
			init(this: StorageEvent) {
				// `clear()` fires one event with a null key. scramjet's own clear
				// removes keys one at a time, so a null key is another origin's
				// doing and cannot be attributed to this site
				if (this.key === null) return false;

				// the same prefix `dom/storage.ts` namespaces every read and
				// write with - the whole `scopeOrigin`, which for an about:blank
				// or srcdoc document is its creator's - so the events a document
				// sees are for exactly the keys it can read. Any other prefix
				// hands some documents keys they cannot read and drops ones
				// they can
				return String_startsWith(this.key, client.scopeOrigin + "@");
			},
			props: {
				key(this: StorageEvent) {
					return String_substring(this.key, String_indexOf(this.key, "@") + 1);
				},
				url(this: StorageEvent) {
					return client.unrewriteUrl(this.url);
				},
			},
		},
	};

	/**
	 * https://dom.spec.whatwg.org/#dom-event-istrusted
	 *
	 * The props for an event scramjet dispatched on the platform's behalf - a
	 * fake WebSocket is an EventTarget, so its `open`, `message`, `close` and
	 * `error` all go out through `dispatchEvent` and read back as page-made,
	 * which is the one bit an `if (!event.isTrusted) return` guard turns on.
	 *
	 * It has to be a wrapper. `isTrusted` is `[LegacyUnforgeable]`, so it is a
	 * *non-configurable own property of every event instance* rather than a
	 * prototype accessor - there is nothing on `Event.prototype` to intercept,
	 * and the instance's own copy cannot be redefined. The stand-in listeners
	 * already get is the only place the answer can change.
	 */
	const trustedProps = {
		isTrusted(this: Event) {
			// until the page dispatches it itself, which makes any event
			// untrusted - see the `dispatchEvent` trap below
			return client.box.trustedEvents.has(this);
		},
	};

	/**
	 * The stand-in handed to listeners for one dispatched event.
	 *
	 * One per event, not one per listener - see `box.wrappedEvents`.
	 *
	 * A proxy over the real event, which fails every platform brand check it
	 * reaches. The members of the interfaces a stand-in can be an instance of
	 * accept it in place of the real event, all but two (see `acceptStandIns`
	 * below). So a method read off it is the page-visible one, the same object
	 * `Event.prototype` has, and calling it with the stand-in as `this` is
	 * fine.
	 */
	const wrapEvent = (realEvent: Event, props: object): Event => {
		const existing = client.box.wrappedEvents.get(realEvent);
		if (existing) return existing;

		const wrapped = new Proxy(realEvent, {
			get(target, prop) {
				// own only: `props` is an object literal, so an `in` test also
				// answers to `constructor`, `toString` and every other
				// `Object.prototype` member, and would call them as rewriters
				if (Object_hasOwn(props, prop)) {
					return Reflect_apply(props[prop], target, []);
				}

				// with the real event as the receiver, so an accessor runs its
				// native half on the object it belongs to
				return Reflect_get(target, prop);
			},
		});

		client.box.wrappedEvents.set(realEvent, wrapped);
		client.box.standIns.set(wrapped, realEvent);
		client.box.standInViews.set(wrapped, props as any);

		return wrapped;
	};

	/** What {@link standInFor} answers for an event the page must never see. */
	const DROP = {};

	/**
	 * What the page is handed in place of `event`: the stand-in for it, the
	 * event itself when it needs none, or {@link DROP}.
	 */
	const standInFor = (event: any): any => {
		const existing = event && client.box.wrappedEvents.get(event);
		if (existing) {
			// an event that already has a stand-in, dispatched again: the page
			// re-dispatching one it was handed. It is the same object natively,
			// and the page's view of it has not changed
			return existing;
		}

		if (event && event.isTrusted) {
			// we only need to handle events dispatched from the browser
			const type = event.type;
			if (!Object_hasOwn(handlers, type)) return event;

			const handler = handlers[type];
			// if init returns false, we skip the event, and it never dispatches
			// to listeners
			if (handler.init && Reflect_apply(handler.init, event, []) === false) {
				return DROP;
			}

			return wrapEvent(event, handler.props);
		}

		if (event && client.box.trustedEvents.has(event)) {
			// one scramjet dispatched standing in for the platform. It is
			// deliberately *not* run through `handlers`: a fake WebSocket's
			// `message` is not a postMessage envelope, and unwrapping it as one
			// would hand the page `$scramjet$data`
			return wrapEvent(event, trustedProps);
		}

		return event;
	};

	function wraplistener(listener: (...args: any) => any) {
		return new Proxy(listener, {
			apply(target, that, args) {
				const event = standInFor(args[0]);
				if (event === DROP) return;
				args[0] = event;

				return Reflect_apply(target, that, args);
			},
		});
	}

	/**
	 * The same, for an event handler content attribute - which the browser
	 * compiles and calls itself, with the real event, so it gets no listener
	 * wrapper. Its rewritten body calls this first, and returns on the
	 * function itself; see `eventHandlerPrelude` in `rewriters/html.ts`.
	 * Anything that is not an event - `onerror`'s message string - comes back
	 * as it went in.
	 */
	if (iswindow) {
		const standin = function (event: any): any {
			// the page can call this too, with anything at all. Only a real
			// event goes on: `standInFor` trusts what it is handed to be one,
			// and a made-up object answering `isTrusted` with true would be
			// handed the views meant for the browser's events - `source`
			// resolving a client id it chose to that client's window. Brand
			// checked through the saved native, so nothing on the object runs
			try {
				void new client.native.Event(event).type;
			} catch {
				return event;
			}

			const result = standInFor(event);

			return result === DROP ? standin : result;
		};
		Object_defineProperty(self, client.config.globals.standinfn, {
			value: standin,
			writable: false,
			configurable: false,
			enumerable: false,
		});
	}

	/**
	 * https://webidl.spec.whatwg.org/#call-a-user-objects-operation
	 *
	 * An `EventListener` that is an object rather than a function, as a
	 * function `wraplistener` can take. `handleEvent` is looked up on every
	 * dispatch rather than once here: the spec gets it fresh each time, so a
	 * page that reassigns it after registering is calling the new one.
	 *
	 * `this` is the object, never `currentTarget` - that is the callable
	 * branch of the same algorithm, which `addEventListener` hands over as-is.
	 * A missing or non-callable `handleEvent` throws out of the listener, which
	 * the dispatch reports the same way it reports the native's own TypeError.
	 */
	const objectListener = (listener: EventListenerObject) =>
		function (event: Event) {
			const handleEvent = Reflect_get(listener, "handleEvent");
			if (typeof handleEvent !== "function") {
				throw client.errors.typeError({
					detail: "The listener's handleEvent is not a function.",
				});
			}

			return Reflect_apply(handleEvent, listener, [event]);
		};

	/** The (type, capture) half of the DOM's listener identity, as one key. */
	const listenerKey = (event: string, capture: boolean) =>
		(capture ? "1" : "0") + event;

	/** The wrappers registered on `target` for one (type, capture), if any. */
	const wrappersFor = (target: EventTarget, key: string, create: boolean) => {
		let byType = client.box.eventcallbacks.get(target);
		if (!byType) {
			if (!create) return undefined;
			byType = new _Map();
			client.box.eventcallbacks.set(target, byType);
		}

		let wrappers = byType.get(key);
		if (!wrappers) {
			if (!create) return undefined;
			wrappers = new _WeakMap();
			byType.set(key, wrappers);
		}

		return wrappers;
	};

	/**
	 * The wrapper already registered for this exact listener, or a new one.
	 *
	 * The DOM dedupes listeners on (type, callback, capture), so adding the same
	 * one twice is a no-op. Minting a fresh wrapper per call defeated that
	 * entirely - the native saw two different function objects and fired both,
	 * so every double-registration ran twice. That is the usual shape of
	 * idempotent init code, which would double-count on every re-run.
	 */
	const listenerFor = (
		target: EventTarget,
		event: string,
		callback: EventListenerOrEventListenerObject,
		capture: boolean
	) => {
		const wrappers = wrappersFor(target, listenerKey(event, capture), true)!;

		const existing = wrappers.get(callback);
		if (existing) return existing;

		const proxiedCallback = wraplistener(
			typeof callback === "function"
				? (callback as (...args: any) => any)
				: objectListener(callback)
		);
		wrappers.set(callback, proxiedCallback);

		return proxiedCallback;
	};

	/**
	 * Whether `callback` is a listener we stand in for.
	 *
	 * https://webidl.spec.whatwg.org/#es-callback-interface - any object is an
	 * `EventListener`, callable or not. null and undefined are the nullable
	 * type's null, which the native ignores, and every other primitive is a
	 * TypeError the native raises itself, so neither is ours to wrap.
	 */
	const isListener = (
		callback: unknown
	): callback is EventListenerOrEventListenerObject =>
		typeof callback === "function" ||
		(typeof callback === "object" && callback !== null);

	/**
	 * Whether `options` takes the dictionary branch of
	 * `(AddEventListenerOptions or boolean)` / `(EventListenerOptions or
	 * boolean)`.
	 *
	 * https://webidl.spec.whatwg.org/#es-union - null and undefined take the
	 * dictionary (step 12), and so does any object or function (step 13).
	 * Everything else falls past the string and numeric steps to step 19, which
	 * is `ToBoolean`, because `boolean` is the only other member.
	 *
	 * Testing `typeof options === "boolean"` instead sends a number or a string
	 * down the dictionary branch, where the conversion throws a TypeError the
	 * spec never asks for: `addEventListener("x", fn, 1)` means `capture: true`.
	 */
	const takesDictionary = (options: unknown): boolean =>
		options === null ||
		options === undefined ||
		typeof options === "object" ||
		typeof options === "function";

	client.Intercept(class extends EventTarget {
		@Arguments(
			"DOMString",
			"EventListener?",
			"optional (AddEventListenerOptions or boolean)"
		)
		@Returns("undefined")
		addEventListener(
			type: string,
			callback: EventListenerOrEventListenerObject | null,
			options?: AddEventListenerOptions | boolean
		): void {
			if (!isListener(callback)) {
				return super.addEventListener(type, callback, options);
			}

			// `(AddEventListenerOptions or boolean)`, where the boolean is just
			// `capture`. The dictionary form is read once, by the shared reader
			// in helpers.ts, because `capture` decides the listener's identity
			// here and the same object then goes to the native
			const init = takesDictionary(options)
				? readAddEventListenerOptions(options)
				: { capture: !!options };

			return super.addEventListener(
				type,
				listenerFor(this, type, callback, init.capture),
				init
			);
		}

		@Arguments(
			"DOMString",
			"EventListener?",
			"optional (EventListenerOptions or boolean)"
		)
		@Returns("undefined")
		removeEventListener(
			type: string,
			callback: EventListenerOrEventListenerObject | null,
			options?: EventListenerOptions | boolean
		): void {
			if (!isListener(callback)) {
				return super.removeEventListener(type, callback, options);
			}

			const capture = takesDictionary(options)
				? readEventListenerOptions(options).capture
				: !!options;
			const wrappers = wrappersFor(this, listenerKey(type, capture), false);
			const proxiedCallback = wrappers && wrappers.get(callback);

			if (proxiedCallback) {
				// dropped rather than kept, so that a later re-add mints a fresh
				// wrapper - the same thing the native does with the registration
				wrappers.delete(callback);

				return super.removeEventListener(type, proxiedCallback, { capture });
			}

			return super.removeEventListener(type, callback, { capture });
		}
	});

	/**
	 * Every member of an interface a stand-in can be an instance of, made to
	 * accept the stand-in wherever it takes the real event.
	 *
	 * A stand-in is a proxy, and a platform member called on one - with `.call`,
	 * or through an assignment like `e.returnValue = false`, which runs the
	 * setter with the proxy as its receiver - throws "Illegal invocation". So:
	 *
	 *   - a getter answers what the same property read off the stand-in does:
	 *     `MessageEvent.prototype.data`'s getter, called on one, is its `data`,
	 *     as it is natively. It runs on the real event and goes on down the
	 *     member's layers from here, rather than reading the property back off
	 *     the stand-in, which would run every layer outside this one twice
	 *   - a setter and a method run on the real event
	 *   - `dispatchEvent` dispatches the real event, which the listener wrapper
	 *     then hands back out as the same stand-in
	 *
	 * Checked per call against `box.standIns`, so an event that has no stand-in
	 * - nearly all of them - is untouched but for the lookup. The view itself
	 * stays on the stand-in and nowhere else: scramjet's own listeners, and the
	 * embedder's, read the real events natively and must keep seeing the real
	 * values.
	 *
	 * Two are left out, and throw called on a stand-in: `Event.prototype`'s
	 * own getters (see below), and `isTrusted`, which is [LegacyUnforgeable] -
	 * a non-configurable accessor on each instance, so its getter cannot be
	 * replaced.
	 */
	const standInInterfaces = [
		"Event",
		// the types `handlers` rewrites
		"MessageEvent",
		"StorageEvent",
		"HashChangeEvent",
		// and the ones scramjet dispatches through `client.dispatchEvent`
		"CloseEvent",
	];

	// every one of these only looks the receiver up, in maps keyed by
	// scramjet's own stand-ins, and swaps it for the real event - nothing is
	// read off it or called on it
	const getter = (key: string | symbol): Trap<any>["get"] =>
		function (ctx) {
			// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
			const real = client.box.standIns.get(ctx.this);
			if (real) {
				// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
				const view = client.box.standInViews.get(ctx.this);
				if (view && Object_hasOwn(view, key)) {
					return Reflect_apply(view[key], real, []);
				}

				ctx.this = real;
			}

			return ctx.get();
		};
	const setter: Trap<any>["set"] = (ctx, value) => {
		// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
		const real = client.box.standIns.get(ctx.this);
		if (real) ctx.this = real;

		ctx.set(value);
	};

	const acceptStandIns = (
		proto: object,
		key: string | symbol,
		name: string,
		getters: boolean
	) => {
		const descriptor = Object_getOwnPropertyDescriptor(proto, key);
		if (!descriptor) return;

		if (descriptor.get || descriptor.set) {
			const trap: Trap<any> = {};
			if (getters && descriptor.get) trap.get = getter(key);
			if (descriptor.set) trap.set = setter;
			if (trap.get || trap.set)
				client.RawTrap(proto, key as string, trap, name);

			return;
		}

		if (typeof descriptor.value !== "function") return;

		client.RawProxy(
			proto,
			key as string,
			{
				apply(ctx) {
					// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
					const real = client.box.standIns.get(ctx.this as Event);
					if (real) ctx.this = real;
				},
			},
			name
		);
	};

	for (const iface of drain(standInInterfaces)) {
		const ctor = self[iface];
		if (typeof ctor !== "function") continue;

		const proto = ctor.prototype;
		for (const key of drain(Object_getOwnPropertyNames(proto))) {
			if (key === "constructor") continue;

			// not `Event.prototype`'s getters: every event on the page reads
			// through them - `e.type`, `e.target` - where the rest are read about
			// once per event of their own type. A layer on them costs every one
			// of those reads about 100ns, to serve a getter taken off the
			// prototype and called on a stand-in, which nothing but a test does.
			// A stand-in read the usual way already runs them on the real event
			acceptStandIns(
				proto,
				key,
				`${iface}.prototype.${key}`,
				iface !== "Event"
			);
		}
	}

	client.RawProxy(
		self.EventTarget.prototype,
		"dispatchEvent",
		{
			apply(ctx) {
				// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
				const real = client.box.standIns.get(ctx.args[0] as Event);
				if (!real) return;

				ctx.args[0] = real;
				// untrusted for its listeners - unless the dispatch throws,
				// because it is still in flight, which leaves it as it was
				const trusted = client.box.trustedEvents.delete(real);
				try {
					ctx.call();
				} catch (err) {
					if (trusted) client.box.trustedEvents.add(real);
					throw err;
				}
			},
		},
		"EventTarget.prototype.dispatchEvent"
	);

	/**
	 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-window-event
	 *
	 * `window.event` is the event currently being dispatched, and for a type we
	 * wrap the page has to be handed the same stand-in its listeners were given
	 * - otherwise it reads `$scramjet$data` off the raw event and the proxy's
	 * origin off `origin`.
	 *
	 * Answered from the native rather than remembered: the browser already
	 * tracks which event is in flight, including the ones we never wrap and the
	 * `undefined` outside a dispatch, and `box.wrappedEvents` is keyed on the
	 * real event, so the wrapper is one lookup away.
	 *
	 * This used to define `window.event` itself, once, the first time a wrapped
	 * listener ran - and then never again, because the guard it was behind
	 * (`!self.event`) was true only until it had installed something. Every
	 * later read answered with the first event the page ever saw. It also
	 * invented the member on an engine that has none, which is the thing
	 * `slotFor` refuses to do; `Trap` skips a member this engine does not
	 * have, so that stops happening too.
	 */
	if (iswindow) {
		client.Trap("event", {
			get(ctx) {
				const current = ctx.get() as Event | undefined;
				if (!current) return current;

				return client.box.wrappedEvents.get(current) ?? current;
			},
		});
	}

	// every object carrying an `on<type>` for a type we rewrite.
	//
	// less the interfaces scramjet fakes outright. A fake WebSocket is an
	// EventTarget wearing `WebSocket.prototype`, so its `onmessage` is not a
	// native slot to wrap - `requests/WebSocket.ts` owns the member, and its
	// events already reach us as synthetic ones through `client.dispatchEvent`.
	// Trapping it here first (this module loads ahead of that one) took the
	// member out from under it, and every `ws.onmessage = fn` then hit the
	// native setter on a non-WebSocket and threw "Illegal invocation".
	const synthetic = ["WebSocket"];

	const ontargets = (): object[] => {
		const found: object[] = [self.self];

		for (const name of drain(Object_getOwnPropertyNames(self))) {
			if (Array_includes(synthetic, name)) continue;

			const descriptor = Object_getOwnPropertyDescriptor(self, name);
			if (!descriptor || typeof descriptor.value !== "function") continue;

			const proto = descriptor.value.prototype;
			if (proto) found[found.length] = proto;
		}

		return found;
	};

	const handlertypes = Object_keys(handlers);

	for (const target of drain(ontargets())) {
		for (const type of drain(handlertypes)) {
			const key = "on" + type;

			const descriptor = Object_getOwnPropertyDescriptor(target, key);
			if (!descriptor || !descriptor.get || !descriptor.set) continue;
			if (!descriptor.configurable) continue;

			// these are the `onmessage`, `onhashchange`, etc. properties
			//
			// the native slot stays the one source of truth, holding our
			// wrapper, and a read translates it back. Nothing is remembered per
			// receiver: `document.body.onmessage` *is* `window.onmessage` - both
			// name the Window's handler - and a copy kept per object went stale
			// the moment the other one, or a content attribute, changed it
			client.RawTrap(target, key, {
				get(ctx) {
					const current = ctx.get() as object | null;
					if (current === null) return current;

					return client.box.eventhandlers.get(current) ?? current;
				},
				set(ctx, value: any) {
					// anything else - null, a primitive, a non-callable object -
					// goes to the native as-is, which converts it
					// ([LegacyTreatNonObjectAsNull]) and never calls it
					if (typeof value !== "function") return ctx.set(value);

					const wrapped = wraplistener(value);
					client.box.eventhandlers.set(wrapped, value);
					ctx.set(wrapped);
				},
			});
		}
	}
}
