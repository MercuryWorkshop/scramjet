import { RawHeaders, ProxyTransport, WebSocketDataType } from "./types";

export const WebSocketFields = {
	prototype: {
		send: WebSocket.prototype.send,
	},
	CLOSED: WebSocket.CLOSED,
	CLOSING: WebSocket.CLOSING,
	CONNECTING: WebSocket.CONNECTING,
	OPEN: WebSocket.OPEN,
};

export class BareCompatibleWebSocket extends EventTarget {
	public url: string;
	public readyState: number = WebSocketFields.CONNECTING;
	public extensions: string = "";
	public protocol: string = "";

	private _data: ReturnType<ProxyTransport["connect"]>[0];
	private _close: ReturnType<ProxyTransport["connect"]>[1];

	constructor(
		remote: string | URL,
		protocols: string | string[] | undefined,
		public transport: ProxyTransport,
		requestHeaders?: RawHeaders
	) {
		super();
		this.url = remote.toString();

		if (!requestHeaders) {
			requestHeaders = [];
		}
		if (!protocols) {
			protocols = [];
		}
		if (typeof protocols === "string") {
			protocols = [protocols];
		}

		const onopen = (protocol: string, extensions: string) => {
			this.protocol = protocol;
			this.extensions = extensions;
			this.readyState = WebSocketFields.OPEN;

			const event = new Event("open");
			this.dispatchEvent(event);
		};

		const onmessage = async (payload) => {
			const event = new MessageEvent("message", { data: payload });
			this.dispatchEvent(event);
		};

		const onclose = (code: number, reason: string) => {
			this.readyState = WebSocketFields.CLOSED;
			const event = new CloseEvent("close", { code, reason });
			this.dispatchEvent(event);
		};

		const onerror = () => {
			this.readyState = WebSocketFields.CLOSED;
			const event = new Event("error");
			this.dispatchEvent(event);
		};

		(async () => {
			if (!transport.ready) {
				await transport.init();
			}
			const [_data, _close] = transport.connect(
				new URL(remote),
				protocols,
				requestHeaders,
				onopen,
				onmessage,
				onclose,
				onerror
			);

			this._data = _data;
			this._close = _close;
		})();
	}

	async send(data: WebSocketDataType) {
		if (!this.transport.ready) {
			await this.transport.init();
		}
		if (this.readyState === WebSocketFields.CONNECTING) {
			throw new DOMException(
				"Failed to execute 'send' on 'WebSocket': Still in CONNECTING state."
			);
		}

		// we can't check typeof Uint8Array here directly as it may come from another realm
		if (typeof data === "object" && "buffer" in data && data.buffer) {
			let _data: Uint8Array = data as any;
			// this is neccesary in case the buffer is a slice of a larger array
			// in which case you risk edge cases such as sending an entire wasm memory buffer over the websocket
			data = _data.buffer.slice(
				_data.byteOffset,
				_data.byteOffset + _data.byteLength
			) as ArrayBuffer;
		}

		this._data(data);
	}

	close(code: number, reason: string) {
		this._close(code, reason);
	}
}
