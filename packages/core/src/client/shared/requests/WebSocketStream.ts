/* eslint-disable scramjet-core/intercept-brand-check --
   Every member here is `const s = socketstreammap.get(this); if (!s) return super.x;`.
   Membership in that table *is* the brand check, and it is one a page cannot
   forge: the key is the object the constructor handed out. The rule cannot see
   that, because the safe path is the one that does not reach the native - and
   it cannot: these receivers are not real WebSocketStream objects, so `super.x` on one
   would throw the very error the fallback exists to raise for everything else.
   A receiver that is not ours misses the table and takes `super`, which
   brand-checks natively. */
import {
	Array_from,
	Object_setPrototypeOf,
	Promise_then,
} from "@/shared/snapshot";
import { ScramjetClient } from "@client/client";
import {
	Arguments,
	Constructor,
	Type,
	clampToIDLInteger,
	idlDictionary,
	idlIsBufferSource,
	idlUSVString,
} from "@client/webidl";
import { type BareCompatibleWebSocket } from "@mercuryworkshop/proxy-transports";
import {
	CLOSE_ABNORMAL,
	OrderedSteps,
	WEBSOCKET_CLOSED,
	WEBSOCKET_CLOSING,
	WEBSOCKET_CONNECTING,
	WEBSOCKET_OPEN,
	parseWebSocketUrl,
	reportedClose,
	validateClose,
	validateProtocols,
	webSocketHeaders,
} from "./WebSocket";

export type FakeWebSocketStreamState = {
	url: string;
	barews: BareCompatibleWebSocket;
	/** The same states a `WebSocket` has, tracked here for the same reason. */
	readyState: number;

	opened: Promise<WebSocketOpenInfo>;
	closed: Promise<WebSocketCloseInfo>;
	/** https://websockets.spec.whatwg.org/#close-using-a-websocketcloseinfo */
	close: (code: number | null, reason: string) => void;
};

/**
 * https://websockets.spec.whatwg.org/#dictdef-websocketcloseinfo, read by hand:
 * `closeCode` is `[Clamp]` - Chrome's binding, measured: 70000 is an
 * InvalidAccessError, not a TypeError - which `dictionaryReader` does not
 * carry through, and wrapping 70000 to 4464 would close with a code nobody
 * named.
 */
function readWebSocketCloseInfo(value: unknown): {
	closeCode?: number;
	reason: string;
} {
	const dict = idlDictionary(value, "WebSocketCloseInfo");
	const out: { closeCode?: number; reason: string } = { reason: "" };

	// read once each, in WebIDL's (lexicographic) order
	const closeCode = dict.closeCode;
	if (closeCode !== undefined) {
		out.closeCode = clampToIDLInteger(closeCode, [0, 65535]);
	}

	const reason = dict.reason;
	if (reason !== undefined) out.reason = idlUSVString(reason);

	return out;
}

export const enabled = (client: ScramjetClient, self: Self) =>
	"WebSocketStream" in self;
export default function (client: ScramjetClient, self: Self) {
	const {
		ArrayBuffer,
		Promise,
		ReadableStream,
		WritableStream,
		WebSocketStream,
		WebSocketError,
		DOMException,
	} = self;
	// read once, here, rather than per stream - see `WebSocket.ts`
	const WebSocketStream_prototype = WebSocketStream.prototype;
	const ArrayBuffer_prototype = ArrayBuffer.prototype;

	/**
	 * What a failed connection rejects with, and errors the streams with. No
	 * `closeCode`: the constructor only takes the codes a page may send, and
	 * 1006 is not one of them.
	 */
	const connectionError = (message = ""): Error =>
		WebSocketError
			? new WebSocketError(message)
			: new DOMException(message, "NetworkError");

	/**
	 * What an abort during the handshake rejects with. Not the signal's
	 * reason, which Chrome ignores here - measured.
	 */
	const abortError = (): DOMException =>
		client.errors.domException("AbortError", {
			detail: "WebSocket handshake was aborted",
		});

	/**
	 * https://websockets.spec.whatwg.org/#websocketstream-cancel - a
	 * WebSocketError says how to close, anything else closes without a code.
	 */
	const closeInfoFromReason = (
		reason: unknown
	): { code: number | null; reason: string } => {
		if (WebSocketError && typeof reason === "object" && reason) {
			// the native getters brand-check, so this throws for anything that
			// is not a real WebSocketError, whatever its prototype says
			try {
				const error = new client.native.WebSocketError(reason);

				return { code: error.closeCode, reason: error.reason };
			} catch {
				// not a WebSocketError
			}
		}

		return { code: null, reason: "" };
	};

	const map = client.box.socketstreammap;
	client.Intercept(class extends WebSocketStream {
		@Constructor("USVString", "optional WebSocketStreamOptions")
		static konstructor(url: string, rawOptions?: WebSocketStreamOptions) {
			// https://websockets.spec.whatwg.org/#dom-websocketstream-websocketstream
			// - the dictionary first, then the URL, as the binding converts
			// arguments before the constructor's own steps run
			const dict = idlDictionary(rawOptions, "WebSocketStreamOptions");
			const rawProtocols = dict.protocols;
			let protocols: string[] = [];
			if (rawProtocols !== undefined) {
				if (typeof rawProtocols !== "object" || rawProtocols === null) {
					throw client.errors.typeError({
						construct: "WebSocketStream",
						detail:
							"Failed to read the 'protocols' property from 'WebSocketStreamOptions': The provided value cannot be converted to a sequence.",
					});
				}
				protocols = Array_from(rawProtocols as Iterable<unknown>, idlUSVString);
			}
			const rawSignal = dict.signal;
			let signal: AbortSignal | undefined;
			if (rawSignal !== undefined) {
				try {
					// a brand check: the native getter throws for anything else
					void new client.native.AbortSignal(rawSignal).aborted;
				} catch {
					throw client.errors.typeError({
						construct: "WebSocketStream",
						detail:
							"Failed to read the 'signal' property from 'WebSocketStreamOptions': Failed to convert value to 'AbortSignal'.",
					});
				}
				signal = rawSignal as AbortSignal;
			}

			const parsed = parseWebSocketUrl(client, "WebSocketStream", url);
			validateProtocols(client, "WebSocketStream", protocols);

			// no own `constructor`, for the reason `WebSocket` has none - and
			// the prototype captured at install rather than read off `this`
			const fakeWebSocketStream = {};
			Object_setPrototypeOf(fakeWebSocketStream, WebSocketStream_prototype);

			let resolveOpened!: (info: WebSocketOpenInfo) => void;
			let rejectOpened!: (error: unknown) => void;
			let resolveClosed!: (info: WebSocketCloseInfo) => void;
			let rejectClosed!: (error: unknown) => void;
			const opened = new Promise<WebSocketOpenInfo>((resolve, reject) => {
				resolveOpened = resolve;
				rejectOpened = reject;
			});
			const closed = new Promise<WebSocketCloseInfo>((resolve, reject) => {
				resolveClosed = resolve;
				rejectClosed = reject;
			});
			// the spec marks both as handled, so a page that never looks at
			// one does not get an unhandled rejection for it
			Promise_then(opened, undefined, () => {});
			Promise_then(closed, undefined, () => {});

			// an already-aborted signal: nothing is connected at all
			if (signal && new client.native.AbortSignal(signal).aborted) {
				const error = abortError();
				rejectOpened(error);
				rejectClosed(error);
				map.set(fakeWebSocketStream as WebSocketStream, {
					url: parsed.href,
					barews: null!,
					readyState: WEBSOCKET_CLOSED,
					opened,
					closed,
					close: () => {},
				});

				return fakeWebSocketStream;
			}

			const barews = client.bare.createWebSocket(
				parsed.href,
				protocols,
				webSocketHeaders(client, self, parsed)
			);

			const steps = new OrderedSteps();
			let readableController: ReadableStreamDefaultController | null = null;
			let writableController: WritableStreamDefaultController | null = null;
			let readableDone = false;
			// the handshake was abandoned: the transport is closed the moment
			// it opens, and nothing it says after that reaches the page
			let failed = false;
			// the close frame the page sent, if it started the closing handshake
			let sentClose: { code: number; reason: string } | null = null;

			const readable = new ReadableStream({
				start(controller) {
					readableController = controller;
				},
				cancel(reason) {
					readableDone = true;
					const info = closeInfoFromReason(reason);
					state.close(info.code, info.reason);
				},
			});
			const writable = new WritableStream({
				start(controller) {
					writableController = controller;
				},
				write(chunk) {
					// https://websockets.spec.whatwg.org/#websocketstream-write -
					// a BufferSource goes as binary, anything else as text
					const data = idlIsBufferSource(chunk) ? chunk : idlUSVString(chunk);

					return barews.send(data);
				},
				close() {
					state.close(null, "");
				},
				abort(reason) {
					const info = closeInfoFromReason(reason);
					state.close(info.code, info.reason);
				},
			});

			const closeReadable = () => {
				if (readableDone) return;
				readableDone = true;
				try {
					readableController!.close();
				} catch {}
			};
			const errorStreams = (error: unknown) => {
				if (!readableDone) {
					readableDone = true;
					try {
						readableController!.error(error);
					} catch {}
				}
				try {
					writableController!.error(error);
				} catch {}
			};

			// https://websockets.spec.whatwg.org/#websocketstream-feedback-from-the-protocol
			// - "the WebSocket connection is closed"
			const connectionClosed = (
				code: number,
				reason: string,
				wasClean: boolean
			) => {
				const wasOpen = state.readyState !== WEBSOCKET_CONNECTING;
				state.readyState = WEBSOCKET_CLOSED;

				if (wasClean) {
					resolveClosed({ closeCode: code, reason });
					closeReadable();
					try {
						writableController!.error(connectionError());
					} catch {}

					return;
				}

				const error = connectionError();
				if (!wasOpen) rejectOpened(error);
				rejectClosed(error);
				errorStreams(error);
			};

			// the page has been told the stream is closed, so nothing more
			const finished = () => failed || state.readyState === WEBSOCKET_CLOSED;

			/** Fail the connection with `error` - an abort or an early close. */
			const failConnection = (error: unknown) => {
				failed = true;
				state.readyState = WEBSOCKET_CLOSED;
				rejectOpened(error);
				rejectClosed(error);
				errorStreams(error);
			};

			const state: FakeWebSocketStreamState = {
				url: parsed.href,
				barews,
				readyState: WEBSOCKET_CONNECTING,
				opened,
				closed,
				close: (code, reason) => {
					if (
						state.readyState === WEBSOCKET_CLOSING ||
						state.readyState === WEBSOCKET_CLOSED
					) {
						return;
					}
					// closing during the handshake fails the connection. The
					// transport has no socket to close until it opens - calling
					// through threw `this._close is not a function` at the page
					if (state.readyState === WEBSOCKET_CONNECTING) {
						failConnection(
							connectionError("WebSocket closed before handshake complete.")
						);

						return;
					}

					state.readyState = WEBSOCKET_CLOSING;
					// a close with a reason but no code carries 1000
					sentClose = { code: code ?? 1000, reason };
					try {
						barews.close(sentClose.code, sentClose.reason);
					} catch {}
				},
			};

			// the signal only governs the handshake: once open, aborting it
			// does nothing
			if (signal) {
				new client.native.EventTarget(signal).addEventListener("abort", () => {
					if (state.readyState !== WEBSOCKET_CONNECTING) return;
					failConnection(abortError());
				});
			}

			barews.addEventListener("open", () => {
				if (failed) {
					try {
						barews.close(1000, "");
					} catch {}

					return;
				}
				if (finished()) return;

				steps.push(() => {
					state.readyState = WEBSOCKET_OPEN;
					resolveOpened({
						readable,
						writable,
						protocol: barews.protocol,
						extensions: barews.extensions,
					});
				});
			});
			barews.addEventListener("close", (ev: CloseEvent) => {
				if (finished()) return;
				const { code, reason } = ev;

				steps.push(() => {
					if (state.readyState === WEBSOCKET_CLOSED) return;
					if (state.readyState === WEBSOCKET_CONNECTING) {
						connectionClosed(CLOSE_ABNORMAL, "", false);
					} else {
						const reported = reportedClose(code, reason, sentClose);
						connectionClosed(
							reported.code,
							reported.reason,
							reported.code !== CLOSE_ABNORMAL
						);
					}
				});
			});
			barews.addEventListener("error", () => {
				if (finished()) return;

				steps.push(() => {
					if (state.readyState === WEBSOCKET_CLOSED) return;
					connectionClosed(CLOSE_ABNORMAL, "", false);
				});
			});
			barews.addEventListener("message", (ev: MessageEvent) => {
				if (finished()) return;
				const data = ev.data;

				const deliver = (payload: unknown) => {
					// after a cancel, or once closed, there is nowhere to put it
					if (readableDone || state.readyState === WEBSOCKET_CLOSED) return;
					readableController!.enqueue(payload);
				};

				// TODO: this needs to be changed to uint8array later
				// chrome isnt following spec though so we are just going to do this
				if (typeof data === "string") {
					steps.push(() => deliver(data));
				} else if ("byteLength" in data) {
					// arraybuffer, set the realms prototype so its recognized
					Object_setPrototypeOf(data, ArrayBuffer_prototype);
					steps.push(() => deliver(data));
				} else if ("arrayBuffer" in data) {
					// blob, convert to arraybuffer - which takes a turn, so it
					// holds its place in the queue while it does
					const ready = steps.reserve();
					Promise_then(
						new client.native.Blob(data).arrayBuffer(),
						(buffer: ArrayBuffer) => {
							Object_setPrototypeOf(buffer, ArrayBuffer_prototype);
							ready(() => deliver(buffer));
						},
						() => ready(() => {})
					);
				}
			});

			map.set(fakeWebSocketStream as WebSocketStream, state);

			return fakeWebSocketStream;
		}

		@Type("USVString")
		get url() {
			const ws = map.get(this);
			if (!ws) return super.url;

			return ws.url;
		}

		@Type("Promise<WebSocketOpenInfo>")
		get opened() {
			const ws = map.get(this);
			if (!ws) return super.opened;

			return ws.opened;
		}

		@Type("Promise<WebSocketCloseInfo>")
		get closed() {
			const ws = map.get(this);
			if (!ws) return super.closed;

			return ws.closed;
		}

		// https://websockets.spec.whatwg.org/#dom-websocketstream-close
		@Arguments("optional WebSocketCloseInfo")
		close(closeInfo?: WebSocketCloseInfo) {
			const ws = map.get(this);
			if (!ws) return super.close(closeInfo);

			const info = readWebSocketCloseInfo(closeInfo);
			// the reason is checked whether or not a code came with it
			validateClose(client, "WebSocketStream", info.closeCode, info.reason);

			ws.close(info.closeCode ?? null, info.reason);
		}
	});
}
