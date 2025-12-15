import {
	FetchBodyType,
	RawHeaders,
	ProxyTransport,
	TransferrableResponse,
} from "./types";
import { BareCompatibleWebSocket } from "./websocket";

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

function headersObjectToEntries(headers: Headers): RawHeaders {
	return [...(headers as any)];
}

/**
 * A Response with additional properties.
 */
export class BareResponse extends Response {
	url: string;
	rawHeaders: RawHeaders;
	redirected: boolean = false;

	static fromTransferrableResponse(
		resp: TransferrableResponse,
		url: string
	): BareResponse {
		const response = new BareResponse(
			statusEmpty.includes(resp.status) ? undefined : resp.body,
			{
				headers: new Headers(resp.headers as HeadersInit),
				status: resp.status,
				statusText: resp.statusText,
			}
		);

		response.url = url;
		response.redirected =
			resp.status >= 300 &&
			resp.status < 400 &&
			resp.headers["location"] !== undefined;
		response.rawHeaders = resp.headers;

		return response;
	}

	static fromNativeResponse(resp: Response): BareResponse {
		let body = statusEmpty.includes(resp.status) ? undefined : resp.body;
		const response = new BareResponse(body, {
			headers: resp.headers,
			status: resp.status,
			statusText: resp.statusText,
		});

		response.url = resp.url;
		response.rawHeaders = headersObjectToEntries(resp.headers);
		response.redirected = resp.redirected;

		return response;
	}
}

const defaultMaxRedirects = 20;
export type BareRequestInit = {
	body?: FetchBodyType | null;
	headers?: RawHeaders;
	method?: string;
	redirect?: RequestRedirect;
	maxRedirects?: number;
};

export class BareCompatibleClient {
	/**
	 * Create a BareCompatibleClient using the provided transport. Calls to fetch and connect will wait for an implementation to be ready.
	 */
	constructor(public transport: ProxyTransport) {}

	createWebSocket(
		remote: string | URL,
		protocols: string | string[] | undefined = [],
		requestHeaders?: RawHeaders
	): BareCompatibleWebSocket {
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

		requestHeaders = requestHeaders || [];

		const socket = new BareCompatibleWebSocket(
			remote,
			protocols,
			this.transport,
			requestHeaders
		);

		return socket;
	}

	async fetch(
		url: string | URL,
		init?: BareRequestInit
	): Promise<BareResponse> {
		if (!this.transport.ready) {
			await this.transport.init();
		}

		let maxRedirects = init?.maxRedirects || defaultMaxRedirects;
		const body = init?.body;
		const headers: RawHeaders = init?.headers || [];
		const method = init?.method || "GET";
		const redirect = init?.redirect || "follow";

		let urlO = new URL(url);

		if (urlO.protocol.startsWith("blob:")) {
			const response = await nativeFetch(urlO);
			return BareResponse.fromNativeResponse(response);
		}

		for (let i = 0; ; i++) {
			const resp = await this.transport.request(
				urlO,
				method,
				body,
				headers,
				undefined
			);

			const bareresponse = BareResponse.fromTransferrableResponse(
				resp,
				urlO.toString()
			);

			if (statusRedirect.includes(bareresponse.status)) {
				switch (redirect) {
					case "follow": {
						const location = bareresponse.headers.get("location");
						if (maxRedirects > i && location !== null) {
							urlO = new URL(location, urlO);
							continue;
						} else throw new TypeError("Failed to fetch");
					}
					case "error":
						throw new TypeError("Failed to fetch");
					case "manual":
						return bareresponse;
				}
			} else {
				return bareresponse;
			}
		}
	}
}
