import { iswindow } from "@client/entry";
import { Arguments, Returns } from "@client/webidl";
import { ScramjetClient } from "@client/index";
import {
	readAddEventListenerOptions,
	readEventListenerOptions,
} from "@client/helpers";
import {
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
		isTrusted() {
			return true;
		},
	};

	/**
	 * The stand-in handed to listeners for one dispatched event.
	 *
	 * One per event, not one per listener - see `box.wrappedEvents`.
	 */
	const wrapEvent = (realEvent: Event, props: object): Event => {
		const existing = client.box.wrappedEvents.get(realEvent);
		if (existing) return existing;

		// one wrapper per underlying function, so `e.stopPropagation` is the same
		// object on every read as it is natively
		const methods = new _WeakMap<object, any>();

		const wrapped = new Proxy(realEvent, {
			get(target, prop, reciever) {
				// own only: `props` is an object literal, so an `in` test also
				// answers to `constructor`, `toString` and every other
				// `Object.prototype` member, and would call them as rewriters
				if (Object_hasOwn(props, prop)) return props[prop].call(target);

				const value = Reflect_get(target, prop);

				// a bare proxy fails the brand check on every method and getter
				// ("Illegal invocation"), so anything callable has to be handed
				// over with the receiver corrected back to the real event.
				// `constructor` is the exception: it is the one function-valued
				// interface member nobody invokes against a receiver, and a page
				// comparing `e.constructor === MessageEvent` would otherwise be
				// comparing against the wrapper
				if (typeof value === "function" && prop !== "constructor") {
					const cached = methods.get(value);
					if (cached) return cached;

					const wrappedfn = new Proxy(value, {
						apply(target, that, args) {
							if (that === reciever) {
								return Reflect_apply(target, realEvent, args);
							}

							return Reflect_apply(target, that, args);
						},
					});
					methods.set(value, wrappedfn);

					return wrappedfn;
				}

				return value;
			},
		});

		client.box.wrappedEvents.set(realEvent, wrapped);
		client.box.standIns.set(wrapped, realEvent);

		return wrapped;
	};

	function wraplistener(listener: (...args: any) => any) {
		return new Proxy(listener, {
			apply(target, that, args) {
				const realEvent: Event = args[0];

				// we only need to handle events dispatched from the browser
				if (realEvent && realEvent.isTrusted) {
					const type = realEvent.type;

					if (Object_hasOwn(handlers, type)) {
						const handler = handlers[type];

						// if init returns false, we skip the event, and it never
						// dispatches to listeners
						if (handler.init && handler.init.call(realEvent) === false) return;

						args[0] = wrapEvent(realEvent, handler.props);
					}
				} else if (realEvent && client.box.trustedEvents.has(realEvent)) {
					// one scramjet dispatched standing in for the platform. It
					// is deliberately *not* run through `handlers`: a fake
					// WebSocket's `message` is not a postMessage envelope, and
					// unwrapping it as one would hand the page `$scramjet$data`
					args[0] = wrapEvent(realEvent, trustedProps);
				}

				const rv = Reflect_apply(target, that, args);

				return rv;
			},
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
	 * `resolveNative` refuses to do; `Trap` skips a member this engine does not
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
