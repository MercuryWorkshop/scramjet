import type {
	BareHeaders,
	BareResponse,
	TransferrableResponse,
	BareTransport,
} from "@mercuryworkshop/bare-mux-custom";
import { libcurl } from "libcurl.js/bundled";
export default class LibcurlClient implements BareTransport {
	wisp: string;
	proxy: string;
	transport: string;
	session: any;
	connections: Array<number>;

	constructor(options) {
		this.wisp = options.wisp ?? options.websocket;
		this.transport = options.transport;
		this.proxy = options.proxy;
		this.connections = options.connections;
		if (!this.wisp.endsWith("/")) {
			throw new TypeError(
				"The Websocket URL must end with a trailing forward slash."
			);
		}
		if (!this.wisp.startsWith("ws://") && !this.wisp.startsWith("wss://")) {
			throw new TypeError(
				"The Websocket URL must use the ws:// or wss:// protocols."
			);
		}
		if (typeof options.proxy === "string" || options.proxy instanceof String) {
			let protocol = new URL(options.proxy).protocol;
			if (!["socks5h:", "socks4a:", "http:"].includes(protocol)) {
				throw new TypeError(
					"Only socks5h, socks4a, and http proxies are supported."
				);
			}
		}
	}

	async init() {
		if (this.transport) libcurl.transport = this.transport;
		await new Promise((resolve, reject) => {
			libcurl.onload = () => {
				console.log("loaded libcurl.js v" + libcurl.version.lib);
				this.ready = true;
				resolve(null);
			};
		});

		libcurl.set_websocket(this.wisp);
		this.session = new libcurl.HTTPSession({
			proxy: this.proxy,
		});

		if (this.connections) this.session.set_connections(...this.connections);

		this.ready = libcurl.ready;
		if (this.ready) {
			console.log("running libcurl.js v" + libcurl.version.lib);
			return;
		}
	}
	ready = false;
	async meta() {}

	async request(
		remote: URL,
		method: string,
		body: BodyInit | null,
		headers: BareHeaders,
		signal: AbortSignal | undefined
	): Promise<TransferrableResponse> {
		let payload = await this.session.fetch(remote.href, {
			method,
			headers: headers,
			body,
			redirect: "manual",
			signal: signal,
		});

		let respheaders = {};
		for (let [key, value] of payload.raw_headers) {
			if (!respheaders[key]) {
				respheaders[key] = [value];
			} else {
				respheaders[key].push(value);
			}
		}

		return {
			body: payload.body!,
			headers: respheaders,
			status: payload.status,
			statusText: payload.statusText,
		};
	}

	connect(
		url: URL,
		protocols: string[],
		requestHeaders: BareHeaders,
		onopen: (protocol: string) => void,
		onmessage: (data: Blob | ArrayBuffer | string) => void,
		onclose: (code: number, reason: string) => void,
		onerror: (error: string) => void
	): [
		(data: Blob | ArrayBuffer | string) => void,
		(code: number, reason: string) => void,
	] {
		let socket = new libcurl.WebSocket(url.toString(), protocols, {
			headers: requestHeaders,
		});
		//bare client always expects an arraybuffer for some reason
		socket.binaryType = "arraybuffer";

		socket.onopen = (event: Event) => {
			onopen("");
		};
		socket.onclose = (event: CloseEvent) => {
			onclose(event.code, event.reason);
		};
		socket.onerror = (event: Event) => {
			onerror("");
		};
		socket.onmessage = (event: MessageEvent) => {
			onmessage(event.data);
		};

		return [
			(data) => {
				socket.send(data);
			},
			(code, reason) => {
				socket.close(code, reason);
			},
		];
	}
}
