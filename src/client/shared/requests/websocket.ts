import { type BareWebSocket } from "@mercuryworkshop/bare-mux";
import { ScramjetClient } from "../../client";

type FakeWebSocketState = {
	extensions: string;
	protocol: string;
	url: string;
	binaryType: string;
	barews: BareWebSocket;

	captureListeners: Record<string, EventListener[]>;
	listeners: Record<string, EventListener[]>;

	onclose?: (ev: CloseEvent) => any;
	onerror?: (ev: Event) => any;
	onmessage?: (ev: MessageEvent) => any;
	onopen?: (ev: Event) => any;
};
export default function (client: ScramjetClient, self: typeof globalThis) {
	const socketmap: WeakMap<WebSocket, FakeWebSocketState> = new WeakMap();
	client.Proxy("WebSocket", {
		construct(ctx) {
			const fakeWebSocket = new EventTarget() as WebSocket;
			Object.setPrototypeOf(fakeWebSocket, self.WebSocket.prototype);
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

				captureListeners: {},
				listeners: {},
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
					if (state.binaryType === "blob") {
						payload = new Blob([payload]);
					} else {
						Object.setPrototypeOf(payload, ArrayBuffer.prototype);
					}
				} else if ("arrayBuffer" in payload) {
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

	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			const ws = socketmap.get(ctx.this);
			if (!ws) return; // it's not a websocket ignore it

			const [type, listener, opts] = ctx.args;

			if (
				(typeof opts === "object" && opts.capture) ||
				(typeof opts === "boolean" && opts)
			) {
				const listeners = (ws.captureListeners[type] ??= []);
				listeners.push(listener);
				ws.captureListeners[type] = listeners;
			} else {
				const listeners = (ws.listeners[type] ??= []);
				listeners.push(listener);
				ws.listeners[type] = listeners;
			}

			ctx.return(undefined);
		},
	});

	client.Proxy("EventTarget.prototype.removeEventListener", {
		apply(ctx) {
			const ws = socketmap.get(ctx.this);
			if (!ws) return;

			const [type, listener, opts] = ctx.args;

			if (
				(typeof opts === "object" && opts.capture) ||
				(typeof opts === "boolean" && opts)
			) {
				const listeners = (ws.captureListeners[type] ??= []);
				const idx = listeners.indexOf(listener);
				if (idx !== -1) listeners.splice(idx, 1);
				ws.captureListeners[type] = listeners;
			} else {
				const listeners = (ws.listeners[type] ??= []);
				const idx = listeners.indexOf(listener);
				if (idx !== -1) listeners.splice(idx, 1);
				ws.listeners[type] = listeners;
			}

			ctx.return(undefined);
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
}
