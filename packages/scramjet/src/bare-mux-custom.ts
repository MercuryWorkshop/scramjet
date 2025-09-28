import LibcurlClient from "./curltransport";
import EpoxyTransport from "./epoxytransport";
import { config } from "./shared";

export type BareHeaders = Record<string, string | string[]>;

export type BareMeta = {
	// ???
};

export type TransferrableResponse = {
	body: ReadableStream | ArrayBuffer | Blob | string;
	headers: BareHeaders;
	status: number;
	statusText: string;
};

export interface BareTransport {
	init: () => Promise<void>;
	ready: boolean;
	connect: (
		url: URL,
		protocols: string[],
		requestHeaders: BareHeaders,
		onopen: (protocol: string) => void,
		onmessage: (data: Blob | ArrayBuffer | string) => void,
		onclose: (code: number, reason: string) => void,
		onerror: (error: string) => void
	) => [
		(data: Blob | ArrayBuffer | string) => void,
		(code: number, reason: string) => void,
	];

	request: (
		remote: URL,
		method: string,
		body: BodyInit | null,
		headers: BareHeaders,
		signal: AbortSignal | undefined
	) => Promise<TransferrableResponse>;

	meta: () => BareMeta;
}

export interface BareWebSocketMeta {
	protocol: string;
	setCookies: string[];
}

export type BareHTTPProtocol = "blob:" | "http:" | "https:" | string;
export type BareWSProtocol = "ws:" | "wss:" | string;

export const maxRedirects = 20;

const validChars =
	"!#$%&'*+-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_`abcdefghijklmnopqrstuvwxyz|~";

export function validProtocol(protocol: string): boolean {
	for (let i = 0; i < protocol.length; i++) {
		const char = protocol[i];

		if (!validChars.includes(char)) {
			return false;
		}
	}

	return true;
}

const wsProtocols = ["ws:", "wss:"];
const statusEmpty = [101, 204, 205, 304];
const statusRedirect = [301, 302, 303, 307, 308];
const nativeFetch = fetch;

/**
 * A Response with additional properties.
 */
export interface BareResponse extends Response {
	rawResponse: TransferrableResponse;
	rawHeaders: BareHeaders;
}
/**
 * A BareResponse with additional properties.
 */
export interface BareResponseFetch extends BareResponse {
	finalURL: string;
}
export class BareClient {
	transport: BareTransport;
	/**
	 * Create a BareClient. Calls to fetch and connect will wait for an implementation to be ready.
	 */
	constructor() {
		this.transport = new LibcurlClient({
			wisp: config.wisp,
		});
	}

	createWebSocket(
		remote: string | URL,
		protocols: string | string[] | undefined = [],
		__deprecated_donotuse_websocket?: any,
		requestHeaders?: BareHeaders
	): BareWebSocket {
		try {
			remote = new URL(remote);
		} catch (err) {
			throw new DOMException(
				`Faiiled to construct 'WebSocket': The URL '${remote}' is invalid.`
			);
		}

		if (!wsProtocols.includes(remote.protocol))
			throw new DOMException(
				`Failed to construct 'WebSocket': The URL's scheme must be either 'ws' or 'wss'. '${remote.protocol}' is not allowed.`
			);

		if (!Array.isArray(protocols)) protocols = [protocols];

		protocols = protocols.map(String);

		for (const proto of protocols)
			if (!validProtocol(proto))
				throw new DOMException(
					`Failed to construct 'WebSocket': The subprotocol '${proto}' is invalid.`
				);

		requestHeaders = requestHeaders || {};

		const socket = new BareWebSocket(
			remote,
			protocols,
			this.transport,
			requestHeaders
		);

		return socket;
	}

	async fetch(
		url: string | URL,
		init?: RequestInit
	): Promise<BareResponseFetch> {
		if (!this.transport.ready) {
			await this.transport.init();
		}

		// Only create an instance of Request to parse certain parameters of init such as method, headers, redirect
		// But use init values whenever possible
		const req = new Request(url, init);

		// try to use init.headers because it may contain capitalized headers
		// furthermore, important headers on the Request class are blocked...
		// we should try to preserve the capitalization due to quirks with earlier servers
		const inputHeaders = init?.headers || req.headers;

		const headers: BareHeaders =
			inputHeaders instanceof Headers
				? Object.fromEntries(inputHeaders as any)
				: (inputHeaders as BareHeaders);
		const body = req.body;

		let urlO = new URL(req.url);

		if (urlO.protocol.startsWith("blob:")) {
			const response = await nativeFetch(urlO);
			const result: Response & Partial<BareResponseFetch> = new Response(
				response.body,
				response
			);

			result.rawHeaders = Object.fromEntries(response.headers as any);
			result.rawResponse = {
				body: response.body,
				headers: Object.fromEntries(response.headers as any),
				status: response.status,
				statusText: response.statusText,
			};
			result.finalURL = urlO.toString();

			return result as BareResponseFetch;
		}

		for (let i = 0; ; i++) {
			const resp = await this.transport.request(
				urlO,
				req.method,
				body,
				headers,
				null
			);

			let responseobj: BareResponse & Partial<BareResponseFetch> = new Response(
				statusEmpty.includes(resp.status) ? undefined : resp.body,
				{
					headers: new Headers(resp.headers as HeadersInit),
					status: resp.status,
					statusText: resp.statusText,
				}
			) as BareResponse;
			responseobj.rawHeaders = resp.headers;
			responseobj.rawResponse = resp;
			responseobj.finalURL = urlO.toString();

			const redirect = init?.redirect || req.redirect;

			if (statusRedirect.includes(responseobj.status)) {
				switch (redirect) {
					case "follow": {
						const location = responseobj.headers.get("location");
						if (maxRedirects > i && location !== null) {
							urlO = new URL(location, urlO);
							continue;
						} else throw new TypeError("Failed to fetch");
					}
					case "error":
						throw new TypeError("Failed to fetch");
					case "manual":
						return responseobj as BareResponseFetch;
				}
			} else {
				return responseobj as BareResponseFetch;
			}
		}
	}
}

export const WebSocketFields = {
	prototype: {
		send: WebSocket.prototype.send,
	},
	CLOSED: WebSocket.CLOSED,
	CLOSING: WebSocket.CLOSING,
	CONNECTING: WebSocket.CONNECTING,
	OPEN: WebSocket.OPEN,
};

export class BareWebSocket extends EventTarget {
	url: string;
	readyState: number = WebSocketFields.CONNECTING;

	_data: ReturnType<BareTransport["connect"]>[0];
	_close: ReturnType<BareTransport["connect"]>[1];

	constructor(
		remote: string | URL,
		public protocols: string | string[] | undefined = [],
		public transport: BareTransport,
		requestHeaders?: BareHeaders
	) {
		super();
		this.url = remote.toString();
		this.protocols = protocols;

		const onopen = (protocol: string) => {
			this.protocols = protocol;
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
				//@ts-expect-error ?
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

	async send(...args) {
		if (!this.transport.ready) {
			await this.transport.init();
		}
		if (this.readyState === WebSocketFields.CONNECTING) {
			throw new DOMException(
				"Failed to execute 'send' on 'WebSocket': Still in CONNECTING state."
			);
		}

		let data = args[0];
		if (data.buffer)
			data = data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength
			);

		this._data(data);
	}

	close(code, reason) {
		this._close(code, reason);
	}
}
