import { type BareWebSocket } from "@mercuryworkshop/bare-mux";
import { ScramjetClient } from "../../client";

type FakeWebSocketState = {
	extensions: string;
	protocol: string;
	url: string;
	binaryType: string;
	barews: BareWebSocket;

	onclose?: (ev: CloseEvent) => any;
	onerror?: (ev: Event) => any;
	onmessage?: (ev: MessageEvent) => any;
	onopen?: (ev: Event) => any;
};
type FakeWebSocketStreamState = {
	extensions: string;
	protocol: string;
	url: string;
	barews: BareWebSocket;

	opened: any;
	closed: any;
	readable: ReadableStream;
	writable: WritableStream;
};
export default function (client: ScramjetClient, self: typeof globalThis) {
	const socketmap: WeakMap<WebSocket, FakeWebSocketState> = new WeakMap();
	const socketstreammap: WeakMap<object, FakeWebSocketStreamState> =
		new WeakMap();
	client.Proxy("WebSocket", {
		construct(ctx) {
			const fakeWebSocket = new EventTarget() as WebSocket;
			Object.setPrototypeOf(fakeWebSocket, ctx.fn.prototype);
			fakeWebSocket.constructor = ctx.fn;

			const trustEvent = (ev: Event) =>
				new Proxy(ev, {
					get(target, prop) {
						if (prop === "isTrusted") return true;

						return Reflect.get(target, prop);
					},
				});

			const barews = client.bare.createWebSocket(
				ctx.args[0],
				ctx.args[1],
				null,
				{
					"User-Agent": self.navigator.userAgent,
					Origin: client.url.origin,
				}
			);

			const state: FakeWebSocketState = {
				extensions: "",
				protocol: "",
				url: ctx.args[0],
				binaryType: "blob",
				barews,

				onclose: null,
				onerror: null,
				onmessage: null,
				onopen: null,
			};

			function fakeEventSend(fakeev: Event) {
				state["on" + fakeev.type]?.(trustEvent(fakeev));
				fakeWebSocket.dispatchEvent(fakeev);
			}

			barews.addEventListener("open", () => {
				fakeEventSend(new Event("open"));
			});
			barews.addEventListener("close", (ev) => {
				fakeEventSend(new CloseEvent("close", ev));
			});
			barews.addEventListener("message", async (ev) => {
				let payload = ev.data;
				if (typeof payload === "string") {
					// DO NOTHING
				} else if ("byteLength" in payload) {
					// arraybuffer, convert to blob if needed or set the proper prototype
					if (state.binaryType === "blob") {
						payload = new Blob([payload]);
					} else {
						Object.setPrototypeOf(payload, ArrayBuffer.prototype);
					}
				} else if ("arrayBuffer" in payload) {
					// blob, convert to arraybuffer if neccesary.
					if (state.binaryType === "arraybuffer") {
						payload = await payload.arrayBuffer();
						Object.setPrototypeOf(payload, ArrayBuffer.prototype);
					}
				}

				const fakeev = new MessageEvent("message", {
					data: payload,
					origin: ev.origin,
					lastEventId: ev.lastEventId,
					source: ev.source,
					ports: ev.ports,
				});

				fakeEventSend(fakeev);
			});
			barews.addEventListener("error", () => {
				fakeEventSend(new Event("error"));
			});

			socketmap.set(fakeWebSocket, state);
			ctx.return(fakeWebSocket);
		},
	});
	client.Trap("WebSocket.prototype.binaryType", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.binaryType;
		},
		set(ctx, v: string) {
			const ws = socketmap.get(ctx.this);
			if (v === "blob" || v === "arraybuffer") ws.binaryType = v;
		},
	});

	client.Trap("WebSocket.prototype.bufferedAmount", {
		get() {
			return 0;
		},
	});

	client.Trap("WebSocket.prototype.extensions", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.extensions;
		},
	});

	client.Trap("WebSocket.prototype.onclose", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.onclose;
		},
		set(ctx, v: (ev: CloseEvent) => any) {
			const ws = socketmap.get(ctx.this);
			ws.onclose = v;
		},
	});

	client.Trap("WebSocket.prototype.onerror", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.onerror;
		},
		set(ctx, v: (ev: Event) => any) {
			const ws = socketmap.get(ctx.this);
			ws.onerror = v;
		},
	});

	client.Trap("WebSocket.prototype.onmessage", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.onmessage;
		},
		set(ctx, v: (ev: MessageEvent) => any) {
			const ws = socketmap.get(ctx.this);
			ws.onmessage = v;
		},
	});

	client.Trap("WebSocket.prototype.onopen", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.onopen;
		},
		set(ctx, v: (ev: Event) => any) {
			const ws = socketmap.get(ctx.this);
			ws.onopen = v;
		},
	});

	client.Trap("WebSocket.prototype.url", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.url;
		},
	});

	client.Trap("WebSocket.prototype.protocol", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.protocol;
		},
	});

	client.Trap("WebSocket.prototype.readyState", {
		get(ctx) {
			const ws = socketmap.get(ctx.this);

			return ws.barews.readyState;
		},
	});

	client.Proxy("WebSocket.prototype.send", {
		apply(ctx) {
			const ws = socketmap.get(ctx.this);

			ctx.return(ws.barews.send(ctx.args[0]));
		},
	});

	client.Proxy("WebSocket.prototype.close", {
		apply(ctx) {
			const ws = socketmap.get(ctx.this);
			if (ctx.args[0] === undefined) ctx.args[0] = 1000;
			if (ctx.args[1] === undefined) ctx.args[1] = "";
			ctx.return(ws.barews.close(ctx.args[0], ctx.args[1]));
		},
	});

	client.Proxy("WebSocketStream", {
		construct(ctx) {
			const fakeWebSocket = {};
			Object.setPrototypeOf(fakeWebSocket, ctx.fn.prototype);
			fakeWebSocket.constructor = ctx.fn;

			const barews = client.bare.createWebSocket(
				ctx.args[0],
				ctx.args[1],
				null,
				{
					"User-Agent": self.navigator.userAgent,
					Origin: client.url.origin,
				}
			);
			ctx.args[1]?.signal.addEventListener("abort", () => {
				barews.close(1000, "");
			});
			let openResolver, closeResolver;
			let openRejector;
			const state: FakeWebSocketStreamState = {
				extensions: "",
				protocol: "",
				url: ctx.args[0],
				barews,

				opened: new Promise((resolve, reject) => {
					openResolver = resolve;
					openRejector = reject;
				}),
				closed: new Promise((resolve) => {
					closeResolver = resolve;
				}),
				readable: new ReadableStream({
					start(controller) {
						barews.addEventListener("message", async (ev: MessageEvent) => {
							let payload = ev.data;
							if (typeof payload === "string") {
								// DO NOTHING
							} else if ("byteLength" in payload) {
								// arraybuffer, set the realms prototype so its recognized
								Object.setPrototypeOf(payload, ArrayBuffer.prototype);
							} else if ("arrayBuffer" in payload) {
								// blob, convert to arraybuffer
								payload = await payload.arrayBuffer();
								Object.setPrototypeOf(payload, ArrayBuffer.prototype);
							}
							controller.enqueue(payload);
						});
					},
				}),
				writable: new WritableStream({
					write(chunk) {
						barews.send(chunk);
					},
				}),
			};
			barews.addEventListener("open", () => {
				openResolver({
					readable: state.readable,
					writable: state.writable,
					extensions: state.extensions,
					protocol: state.protocol,
				});
			});
			barews.addEventListener("close", (ev: CloseEvent) => {
				closeResolver({ code: ev.code, reason: ev.reason });
			});

			barews.addEventListener("error", (ev: Event) => {
				openRejector(ev);
			});

			socketstreammap.set(fakeWebSocket, state);
			ctx.return(fakeWebSocket);
		},
	});

	client.Trap("WebSocketStream.prototype.closed", {
		get(ctx) {
			const ws = socketstreammap.get(ctx.this);

			return ws.closed;
		},
	});

	client.Trap("WebSocketStream.prototype.opened", {
		get(ctx) {
			const ws = socketstreammap.get(ctx.this);

			return ws.opened;
		},
	});

	client.Trap("WebSocketStream.prototype.url", {
		get(ctx) {
			const ws = socketstreammap.get(ctx.this);

			return ws.url;
		},
	});

	client.Proxy("WebSocketStream.prototype.close", {
		apply(ctx) {
			const ws = socketstreammap.get(ctx.this);
			if (ctx.args[0]) {
				if (ctx.args[0].closeCode === undefined) ctx.args[0].closeCode = 1000;
				if (ctx.args[0].reason === undefined) ctx.args[0].reason = "";

				return ctx.return(
					ws.barews.close(ctx.args[0].closeCode, ctx.args[0].reason)
				);
			}

			return ctx.return(ws.barews.close(1000, ""));
		},
	});
}
