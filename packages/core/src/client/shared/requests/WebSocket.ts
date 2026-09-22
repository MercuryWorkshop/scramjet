/* eslint-disable scramjet-core/intercept-brand-check --
   Every member here is `const s = socketmap.get(this); if (!s) return super.x;`.
   Membership in that table *is* the brand check, and it is one a page cannot
   forge: the key is the object the constructor handed out. The rule cannot see
   that, because the safe path is the one that does not reach the native - and
   it cannot: these receivers are not real WebSocket objects, so `super.x` on one
   would throw the very error the fallback exists to raise for everything else.
   A receiver that is not ours misses the table and takes `super`, which
   brand-checks natively. */
import {
	type BareCompatibleWebSocket,
	type RawHeaders,
} from "@mercuryworkshop/proxy-transports";
import { ScramjetClient } from "@client/index";
import {
	Object_setPrototypeOf,
	Promise_then,
	Reflect_apply,
	String_split,
	TextEncoder_encode,
	TypedArray_prototype_byteLength,
	_URL,
} from "@/shared/snapshot";
import {
	Arguments,
	Constructor,
	Type,
	idlIsBufferSource,
	idlUSVString,
} from "@client/webidl";
import { EventHandlerSlot } from "@client/eventhandler";
import { registrableDomainForRedirect } from "@/fetch/fetch";

// https://websockets.spec.whatwg.org/#dom-websocket-connecting — named rather
// than read off `WebSocket.CONNECTING`, which is page-writable
export const WEBSOCKET_CONNECTING = 0;
export const WEBSOCKET_OPEN = 1;
export const WEBSOCKET_CLOSING = 2;
export const WEBSOCKET_CLOSED = 3;

/** https://websockets.spec.whatwg.org/#closeWebSocket - the abnormal-closure code */
export const CLOSE_ABNORMAL = 1006;
/** RFC 6455 7.4.1: the close frame carried no status code */
export const CLOSE_NO_STATUS = 1005;

/**
 * The code and reason a closed connection reports.
 *
 * Some transports (libcurl's among them) report every close with no code at
 * all, which reaches here as 0 - a value no close frame can carry. If the page
 * started the closing handshake, the server echoes its code back, so that is
 * the best answer; otherwise the frame is as good as statusless.
 */
export function reportedClose(
	code: number,
	reason: string,
	sent: { code: number; reason: string } | null
): { code: number; reason: string } {
	if (code !== 0) return { code, reason };

	return sent ?? { code: CLOSE_NO_STATUS, reason: "" };
}

/** The length of `reason` as it travels in the close frame: UTF-8 bytes. */
export const utf8Length = (reason: string): number =>
	Reflect_apply(
		TypedArray_prototype_byteLength,
		TextEncoder_encode(reason),
		[]
	);

/**
 * https://websockets.spec.whatwg.org/#dom-websocket-close steps 1 and 2, shared
 * with `WebSocketStream`'s close, which runs the same validation.
 */
export function validateClose(
	client: ScramjetClient,
	iface: "WebSocket" | "WebSocketStream",
	code: number | undefined,
	reason: string | undefined
) {
	// the code is either absent, 1000, or in the registered private range
	if (code !== undefined && code !== 1000 && (code < 3000 || code > 4999)) {
		throw client.errors.domException("InvalidAccessError", {
			execute: "close",
			on: iface,
			detail: `The close code must be either 1000, or between 3000 and 4999. ${code} is neither.`,
		});
	}

	// the reason travels in the close frame, which has 125 bytes for the code
	// and the reason together
	if (reason !== undefined && utf8Length(reason) > 123) {
		throw client.errors.domException("SyntaxError", {
			execute: "close",
			on: iface,
			detail: "The message must not be greater than 123 bytes.",
		});
	}
}

/**
 * https://websockets.spec.whatwg.org/#dom-websocket-websocket steps 1-6, shared
 * with `WebSocketStream`, whose constructor runs the same ones.
 *
 * Resolved against the document, `http(s):` mapped onto `ws(s):`, and every
 * failure a SyntaxError at construction - handing the transport anything else
 * made its own `new URL()` throw inside an async function nobody awaits, and
 * the socket then never opened, errored or closed.
 */
export function parseWebSocketUrl(
	client: ScramjetClient,
	iface: "WebSocket" | "WebSocketStream",
	url: string
): _URL {
	let parsed: _URL;
	try {
		parsed = new _URL(url, client.url.href);
	} catch {
		throw client.errors.domException("SyntaxError", {
			construct: iface,
			detail: `The URL '${url}' is invalid.`,
		});
	}

	if (parsed.protocol === "http:") {
		parsed = new _URL("ws:" + parsed.href.substring(parsed.protocol.length));
	} else if (parsed.protocol === "https:") {
		parsed = new _URL("wss:" + parsed.href.substring(parsed.protocol.length));
	}

	if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
		throw client.errors.domException("SyntaxError", {
			construct: iface,
			detail: `The URL's scheme must be either 'http', 'https', 'ws', or 'wss'. '${parsed.protocol}' is not allowed.`,
		});
	}

	// a fragment at all, not just a non-empty one: `ws://a/#` has one too,
	// which `hash` cannot tell apart from none
	const fragment = String_split(parsed.href, "#");
	if (fragment.length > 1) {
		throw client.errors.domException("SyntaxError", {
			construct: iface,
			detail: `The URL contains a fragment identifier ('${parsed.hash.substring(1)}'). Fragment identifiers are not allowed in WebSocket URLs.`,
		});
	}

	return parsed;
}

/** https://httpwg.org/specs/rfc9110.html#tokens - `tchar` */
const TOKEN_PUNCTUATION = "!#$%&'*+-.^_`|~";
const isToken = (s: string): boolean => {
	if (s.length === 0) return false;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		const alnum =
			(c >= 0x30 && c <= 0x39) ||
			(c >= 0x41 && c <= 0x5a) ||
			(c >= 0x61 && c <= 0x7a);
		if (!alnum && TOKEN_PUNCTUATION.indexOf(s[i]) === -1) return false;
	}

	return true;
};

/**
 * https://websockets.spec.whatwg.org/#dom-websocket-websocket steps 7-8, shared
 * with `WebSocketStream`: every protocol offered is a token, and none twice.
 */
export function validateProtocols(
	client: ScramjetClient,
	iface: "WebSocket" | "WebSocketStream",
	protocols: readonly string[]
) {
	for (let i = 0; i < protocols.length; i++) {
		const protocol = protocols[i];
		for (let j = 0; j < i; j++) {
			if (protocols[j] === protocol) {
				throw client.errors.domException("SyntaxError", {
					construct: iface,
					detail: `The subprotocol '${protocol}' is duplicated.`,
				});
			}
		}
		if (!isToken(protocol)) {
			throw client.errors.domException("SyntaxError", {
				construct: iface,
				detail: `The subprotocol '${protocol}' is invalid.`,
			});
		}
	}
}

/**
 * The handshake's request headers.
 *
 * `Origin` is the document's security origin - `siteOrigin`, serialized as
 * `"null"` when it is opaque. Not `scopeOrigin`: that is a storage key, and for
 * an opaque document it is a random `about-opaque://` string no browser would
 * ever send.
 *
 * `Cookie` is the *target's* cookies, the ones a browser would attach to a
 * request to that URL, filtered by SameSite the way a cross-site subresource
 * is. Reading the page's own cookies instead sent every one of them, HttpOnly
 * included, to whatever host the page opened a socket to.
 */
export function webSocketHeaders(
	client: ScramjetClient,
	self: Self,
	url: _URL
): RawHeaders {
	const origin = client.siteOrigin;
	const opaque = origin === null || origin === "null";

	const sameSite =
		!opaque &&
		registrableDomainForRedirect(new _URL(origin).hostname) ===
			registrableDomainForRedirect(url.hostname);

	const headers: RawHeaders = [
		["User-Agent", self.navigator.userAgent],
		["Origin", opaque ? "null" : origin],
	];

	const cookies = client.context.cookieJar.getCookies(
		url,
		false,
		sameSite ? "strict" : "cross-site"
	);
	if (cookies !== "") headers[headers.length] = ["Cookie", cookies];

	return headers;
}

type OrderedStep = {
	ready: boolean;
	run: () => void;
	next: OrderedStep | null;
};

/**
 * The socket's task queue.
 *
 * Everything the transport reports reaches the page in the order it arrived,
 * but not everything is ready at once: a binary message that has to become an
 * ArrayBuffer is a `blob.arrayBuffer()` away. Dispatching each one as soon as
 * it was ready let a text frame overtake the Blob frame sent before it, and a
 * close overtake both. So every step takes its place when it arrives and runs
 * only once everything ahead of it has.
 *
 * A linked list rather than an array: `push` and `shift` would be lookups on
 * the page's `Array.prototype`.
 */
export class OrderedSteps {
	private head: OrderedStep | null = null;
	private tail: OrderedStep | null = null;
	private draining = false;

	/** Queue a step that can run as soon as its turn comes. */
	push(run: () => void) {
		this.append({ ready: true, run, next: null });
	}

	/**
	 * Hold a place for a step that is not ready yet. Call what comes back with
	 * the step once it is; everything queued behind it waits until then.
	 */
	reserve(): (run: () => void) => void {
		const step: OrderedStep = { ready: false, run: () => {}, next: null };
		this.append(step);

		return (run) => {
			step.run = run;
			step.ready = true;
			this.drain();
		};
	}

	private append(step: OrderedStep) {
		if (this.tail) this.tail.next = step;
		else this.head = step;
		this.tail = step;

		this.drain();
	}

	private drain() {
		// a step dispatches to the page, and a listener can reach back in and
		// queue another - that one waits for this loop rather than running in
		// the middle of the dispatch that queued it
		if (this.draining) return;
		this.draining = true;
		try {
			while (this.head && this.head.ready) {
				const step = this.head;
				this.head = step.next;
				if (!this.head) this.tail = null;
				step.run();
			}
		} finally {
			this.draining = false;
		}
	}
}

export type FakeWebSocketState = {
	protocol: string;
	extensions: string;
	url: string;
	binaryType: BinaryType;
	barews: BareCompatibleWebSocket;
	/**
	 * https://websockets.spec.whatwg.org/#dom-websocket-readystate
	 *
	 * Kept here rather than read off the transport, which only ever holds
	 * CONNECTING, OPEN or CLOSED: it has no CLOSING, so after `close()` it went
	 * on answering OPEN, and a second `close()` or a `send()` went through to a
	 * socket the page had already closed.
	 */
	readyState: number;
	/**
	 * `close()` ran during CONNECTING, which fails the connection. The page
	 * has already been told so; the transport, which cannot be stopped mid
	 * handshake, is closed the moment it opens and heard from no more.
	 */
	failed: boolean;
	/** The close frame the page sent, if it started the closing handshake. */
	sentClose: { code: number; reason: string } | null;
	/** Report the failure `failed` records, from a task of its own. */
	fail: () => void;
	steps: OrderedSteps;
	/**
	 * What the page sends, in the order it sent it. The transport sends a
	 * Blob only once it has read it, so a `send()` after one overtook it;
	 * reading it here and holding everything behind it keeps the order the
	 * spec promises.
	 */
	outgoing: OrderedSteps;

	handlers: Record<"open" | "message" | "close" | "error", EventHandlerSlot>;
};
export default function (client: ScramjetClient, self: Self) {
	const {
		WebSocket,
		EventTarget,
		CloseEvent,
		Event,
		Blob,
		ArrayBuffer,
		MessageEvent,
		setTimeout,
	} = self;
	// read once, here, rather than per socket. `prototype` on an interface
	// object is non-writable and non-configurable, so these reads could not
	// be redirected later either - but nothing below has to rely on that
	const WebSocket_prototype = WebSocket.prototype;
	const ArrayBuffer_prototype = ArrayBuffer.prototype;

	const socketmap = client.box.socketmap;

	client.Intercept(class extends WebSocket {
		@Constructor("USVString", "optional (DOMString or sequence<DOMString>)")
		static konstructor(url: string, protocols: string | string[] = []) {
			// steps 1-6: a URL that cannot be a socket's is a SyntaxError here,
			// before anything is created
			const parsed = parseWebSocketUrl(client, "WebSocket", url);
			// a single string is a list of one
			if (typeof protocols === "string") protocols = [protocols];
			validateProtocols(client, "WebSocket", protocols);

			const fakeWebSocket = new EventTarget();
			// the page's prototype, which it may have modified - intentional:
			// that is what a real socket would inherit from too
			Object_setPrototypeOf(fakeWebSocket, WebSocket_prototype);
			// no own `constructor`: it used to be assigned here, which left an
			// own property on every instance where a real WebSocket has none,
			// so `Object.getOwnPropertyNames(ws)` answered ["constructor"].
			// `WebSocket.prototype.constructor` already names the interface
			// object, and this object's prototype *is* that prototype

			const barews = client.bare.createWebSocket(
				parsed.href,
				protocols,
				webSocketHeaders(client, self, parsed)
			);

			const state: FakeWebSocketState = {
				protocol: "",
				extensions: "",
				url: parsed.href,
				binaryType: "blob",
				barews,
				readyState: WEBSOCKET_CONNECTING,
				failed: false,
				sentClose: null,
				fail: () => {
					setTimeout(() => {
						state.steps.push(() => {
							if (state.readyState === WEBSOCKET_CLOSED) return;
							connectionClosed(CLOSE_ABNORMAL, "", true);
						});
					}, 0);
				},
				steps: new OrderedSteps(),
				outgoing: new OrderedSteps(),

				// the `on*` handlers are ordinary listeners on the socket, added
				// when each is first set - see `EventHandlerSlot` - so they see
				// the same stand-in the page's own listeners do, in the order
				// they would run natively
				handlers: {
					open: new EventHandlerSlot(client, fakeWebSocket, "open"),
					message: new EventHandlerSlot(client, fakeWebSocket, "message"),
					close: new EventHandlerSlot(client, fakeWebSocket, "close"),
					error: new EventHandlerSlot(client, fakeWebSocket, "error"),
				},
			};

			// https://websockets.spec.whatwg.org/#feedback-from-the-protocol -
			// "the WebSocket connection is closed". CLOSED first, then `error`
			// if the connection failed, then `close`.
			const connectionClosed = (
				code: number,
				reason: string,
				failed: boolean
			) => {
				state.readyState = WEBSOCKET_CLOSED;
				if (failed) client.dispatchEvent(fakeWebSocket, new Event("error"));
				client.dispatchEvent(
					fakeWebSocket,
					new CloseEvent("close", {
						code,
						reason,
						// 1006 is what a connection that ended without a closing
						// handshake reports; anything else came with one
						wasClean: !failed && code !== CLOSE_ABNORMAL,
					})
				);
			};

			// true once the page has been told the socket is closed, after
			// which nothing the transport says reaches it
			const finished = () =>
				state.failed || state.readyState === WEBSOCKET_CLOSED;

			barews.addEventListener("open", () => {
				// failed while connecting: the handshake is complete, so there
				// is finally something to close, and the page must not see an
				// `open` for a socket it has already been told is closed
				if (state.failed) {
					try {
						barews.close(1000, "");
					} catch {}

					return;
				}
				if (finished()) return;

				state.steps.push(() => {
					state.readyState = WEBSOCKET_OPEN;
					state.protocol = barews.protocol;
					state.extensions = barews.extensions;
					client.dispatchEvent(fakeWebSocket, new Event("open"));
				});
			});
			barews.addEventListener("close", (ev: CloseEvent) => {
				if (finished()) return;
				// read now: the queue can hold this past the listener's return
				const { code, reason } = ev;

				state.steps.push(() => {
					if (state.readyState === WEBSOCKET_CLOSED) return;
					// a close before the handshake finished is a failed
					// connection, whatever the transport put in it
					if (state.readyState === WEBSOCKET_CONNECTING) {
						connectionClosed(CLOSE_ABNORMAL, "", true);
					} else {
						const reported = reportedClose(code, reason, state.sentClose);
						connectionClosed(reported.code, reported.reason, false);
					}
				});
			});
			barews.addEventListener("error", () => {
				if (finished()) return;

				// the transport reports a failure as an `error` and may never
				// follow it with a `close`, so this is the connection closing,
				// and a `close` from it afterwards is ignored
				state.steps.push(() => {
					if (state.readyState === WEBSOCKET_CLOSED) return;
					connectionClosed(CLOSE_ABNORMAL, "", true);
				});
			});
			barews.addEventListener("message", (ev: MessageEvent) => {
				if (finished()) return;
				// read now: the queue can hold this past the listener's return
				const { data, lastEventId } = ev;

				const deliver = (payload: unknown) => {
					// messages still arrive while CLOSING, but not once closed
					if (state.readyState === WEBSOCKET_CLOSED) return;
					client.dispatchEvent(
						fakeWebSocket,
						new MessageEvent("message", {
							data: payload,
							// https://websockets.spec.whatwg.org/#feedback-from-the-protocol
							// - the socket URL's origin, which the transport
							// does not fill in
							origin: parsed.origin,
							lastEventId,
						})
					);
				};

				if (typeof data === "string") {
					state.steps.push(() => deliver(data));
				} else if ("byteLength" in data) {
					// arraybuffer, convert to blob if needed or set the proper prototype
					if (state.binaryType === "blob") {
						const blob = new Blob([data]);
						state.steps.push(() => deliver(blob));
					} else {
						Object_setPrototypeOf(data, ArrayBuffer_prototype);
						state.steps.push(() => deliver(data));
					}
				} else if ("arrayBuffer" in data) {
					// blob, convert to arraybuffer if neccesary - which takes a
					// turn, so it holds its place in the queue while it does
					if (state.binaryType === "arraybuffer") {
						const ready = state.steps.reserve();
						Promise_then(
							new client.native.Blob(data).arrayBuffer(),
							(buffer: ArrayBuffer) => {
								Object_setPrototypeOf(buffer, ArrayBuffer_prototype);
								ready(() => deliver(buffer));
							},
							() => ready(() => {})
						);
					} else {
						state.steps.push(() => deliver(data));
					}
				}
			});

			socketmap.set(fakeWebSocket as unknown as WebSocket, state);

			return fakeWebSocket;
		}

		@Type("USVString")
		get url() {
			const ws = socketmap.get(this);
			if (!ws) return super.url;

			return ws.url;
		}

		@Type("unsigned short")
		get readyState() {
			const ws = socketmap.get(this);
			if (!ws) return super.readyState;

			return ws.readyState;
		}

		@Type("unsigned long long")
		get bufferedAmount() {
			const ws = socketmap.get(this);
			if (!ws) return super.bufferedAmount;

			return 0;
		}

		@Type("DOMString")
		get extensions() {
			const ws = socketmap.get(this);
			if (!ws) return super.extensions;

			return ws.extensions;
		}

		@Type("DOMString")
		get protocol() {
			const ws = socketmap.get(this);
			if (!ws) return super.protocol;

			return ws.protocol;
		}

		@Type("BinaryType")
		get binaryType() {
			const ws = socketmap.get(this);
			if (!ws) return super.binaryType;

			return ws.binaryType;
		}

		@Type("BinaryType")
		set binaryType(v: BinaryType) {
			const ws = socketmap.get(this);
			if (!ws) {
				super.binaryType = v;

				return;
			}

			// anything outside the enum is ignored rather than thrown on, which
			// is what the native setter does for a non-nullable enum attribute
			if (v === "blob" || v === "arraybuffer") ws.binaryType = v;
		}

		@Type("EventHandler")
		get onopen() {
			const ws = socketmap.get(this);
			if (!ws) return super.onopen;

			return ws.handlers.open.get();
		}

		@Type("EventHandler")
		set onopen(v: ((ev: Event) => any) | null) {
			const ws = socketmap.get(this);
			if (!ws) {
				super.onopen = v;

				return;
			}

			ws.handlers.open.set(v);
		}

		@Type("EventHandler")
		get onmessage() {
			const ws = socketmap.get(this);
			if (!ws) return super.onmessage;

			return ws.handlers.message.get();
		}

		@Type("EventHandler")
		set onmessage(v: ((ev: MessageEvent) => any) | null) {
			const ws = socketmap.get(this);
			if (!ws) {
				super.onmessage = v;

				return;
			}

			ws.handlers.message.set(v);
		}

		@Type("EventHandler")
		get onclose() {
			const ws = socketmap.get(this);
			if (!ws) return super.onclose;

			return ws.handlers.close.get();
		}

		@Type("EventHandler")
		set onclose(v: ((ev: CloseEvent) => any) | null) {
			const ws = socketmap.get(this);
			if (!ws) {
				super.onclose = v;

				return;
			}

			ws.handlers.close.set(v);
		}

		@Type("EventHandler")
		get onerror() {
			const ws = socketmap.get(this);
			if (!ws) return super.onerror;

			return ws.handlers.error.get();
		}

		@Type("EventHandler")
		set onerror(v: ((ev: Event) => any) | null) {
			const ws = socketmap.get(this);
			if (!ws) {
				super.onerror = v;

				return;
			}

			ws.handlers.error.set(v);
		}

		@Arguments("(BufferSource or Blob or USVString)")
		send(data) {
			const ws = socketmap.get(this);
			if (!ws) return super.send(data);

			// https://websockets.spec.whatwg.org/#dom-websocket-send step 1.
			// Only CONNECTING throws; a send on a CLOSING or CLOSED socket is
			// discarded silently. This is how a page finds out it raced its own
			// handshake, and without it that race just vanished
			if (ws.readyState === WEBSOCKET_CONNECTING) {
				throw client.errors.domException("InvalidStateError", {
					execute: "send",
					on: "WebSocket",
					detail: "Still in CONNECTING state.",
				});
			}
			if (ws.readyState !== WEBSOCKET_OPEN) return;

			// the transport's send is async: returning its promise handed the
			// page a value where native returns undefined, and a failure in it
			// became an unhandled rejection the page never asked for
			const transmit = (payload: unknown) => {
				Promise_then(ws.barews.send(payload as string), undefined, () => {});
			};

			// https://webidl.spec.whatwg.org/#es-union: a BufferSource goes as
			// itself, a Blob as its bytes, and anything else is converted to a
			// string. The transport only knows those three, and threw at a number
			if (idlIsBufferSource(data)) {
				ws.outgoing.push(() => transmit(data));

				return;
			}
			if (typeof data === "object" && data) {
				// the `size` getter is the brand check: `arrayBuffer()` returns a
				// promise, so on something that is not a Blob it rejects rather
				// than throwing, and every object would have looked like one
				let isBlob = false;
				try {
					void new client.native.Blob(data).size;
					isBlob = true;
				} catch {
					// not a Blob
				}
				if (isBlob) {
					const bytes: Promise<ArrayBuffer> = new client.native.Blob(
						data
					).arrayBuffer();
					const ready = ws.outgoing.reserve();
					Promise_then(
						bytes,
						(buffer: ArrayBuffer) => ready(() => transmit(buffer)),
						() => ready(() => {})
					);

					return;
				}
			}

			const text = idlUSVString(data);
			ws.outgoing.push(() => transmit(text));
		}

		// https://websockets.spec.whatwg.org/#dom-websocket-close
		@Arguments("optional [Clamp] unsigned short", "optional USVString")
		close(code?: number, reason?: string) {
			const ws = socketmap.get(this);
			if (!ws) return super.close(code, reason);

			// steps 1 and 2. `[Clamp]` has already pinned the code to 0..65535
			validateClose(client, "WebSocket", code, reason);

			// step 3.1: already closing or closed, so there is nothing to do -
			// and in particular no error to raise
			if (
				ws.readyState === WEBSOCKET_CLOSING ||
				ws.readyState === WEBSOCKET_CLOSED
			) {
				return;
			}

			const connecting = ws.readyState === WEBSOCKET_CONNECTING;
			ws.readyState = WEBSOCKET_CLOSING;

			// step 3.2: closing during the handshake fails the connection:
			// `error`, then a `close` with 1006 and wasClean false. The
			// transport has no socket to close yet - reaching into it threw a
			// TypeError naming its own private field at the page - so it is
			// closed when it opens, and meanwhile the page hears the failure
			// from a task of its own, as it would natively
			if (connecting) {
				ws.failed = true;
				ws.fail();

				return;
			}

			// step 3.4: start the closing handshake
			ws.sentClose = { code: code ?? 1000, reason: reason ?? "" };
			try {
				ws.barews.close(ws.sentClose.code, ws.sentClose.reason);
			} catch {}
		}
	});
}
