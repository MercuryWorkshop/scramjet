import type { CookieJar, ScramjetConfig } from "@mercuryworkshop/scramjet";
import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";
declare const $scramjet: typeof ScramjetGlobal;

import type {
	BareHeaders,
	BareTransport,
	TransferrableResponse,
} from "@mercuryworkshop/bare-mux-custom";

import { RpcHelper } from "@mercuryworkshop/rpc";
import type {
	ControllerToTransport,
	TransportToController,
	WebSocketData,
	WebSocketMessage,
} from "./types";

class RemoteTransport implements BareTransport {
	private readyResolve!: () => void;
	private readyPromise: Promise<void> = new Promise((resolve) => {
		this.readyResolve = resolve;
	});

	public ready = false;
	async init() {
		await this.readyPromise;
		this.ready = true;
	}

	private rpc: RpcHelper<ControllerToTransport, TransportToController>;
	constructor(public port: MessagePort) {
		this.rpc = new RpcHelper<ControllerToTransport, TransportToController>(
			{
				ready: async () => {
					this.readyResolve();
				},
			},
			"transport",
			(data, transfer) => {
				port.postMessage(data, transfer);
			}
		);
		port.onmessageerror = (ev) => {
			console.error("onmessageerror (this should never happen!)", ev);
		};
		port.onmessage = (ev) => {
			this.rpc.recieve(ev.data);
		};
		port.start();
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
		const channel = new MessageChannel();
		let port = channel.port1;
		this.rpc
			.call(
				"connect",
				{
					url: url.href,
					protocols,
					requestHeaders,
					port: channel.port2,
				},
				[channel.port2]
			)
			.then((response) => {
				if (response.result === "success") {
					onopen(response.protocol);
				} else {
					onerror(response.error);
				}
			});
		port.onmessage = (ev) => {
			const message = ev.data as WebSocketMessage;
			if (message.type === "data") {
				onmessage(message.data);
			} else if (message.type === "close") {
				onclose(message.code, message.reason);
			}
		};
		port.onmessageerror = (ev) => {
			console.error("onmessageerror (this should never happen!)", ev);
			onerror("Message error in transport port");
		};

		return [
			(data) => {
				port.postMessage(
					{
						type: "data",
						data: data,
					},
					data instanceof ArrayBuffer ? [data] : []
				);
			},
			(code) => {
				port.postMessage({
					type: "close",
					code: code,
				});
			},
		];
	}

	async request(
		remote: URL,
		method: string,
		body: BodyInit | null,
		headers: BareHeaders,
		signal: AbortSignal | undefined
	): Promise<TransferrableResponse> {
		return await this.rpc.call("request", {
			remote: remote.href,
			method,
			body,
			headers,
		});
	}

	meta() {
		return {};
	}
}

const sw = navigator.serviceWorker.controller;
const { SCRAMJETCLIENT, ScramjetClient, CookieJar, setWasm } = $scramjet;

type Config = any;
type Init = {
	config: Config;
	sjconfig: ScramjetConfig;
	cookies: string;
	prefix: URL;
	yieldGetInjectScripts: (
		cookieJar: CookieJar,
		config: Config,
		sjconfig: ScramjetConfig,
		prefix: URL
	) => any;
	codecEncode: (input: string) => string;
	codecDecode: (input: string) => string;
};

export function load({
	config,
	sjconfig,
	cookies,
	prefix,
	yieldGetInjectScripts,
	codecEncode,
	codecDecode,
}: Init) {
	let client;
	if (SCRAMJETCLIENT in globalThis) {
		client = globalThis[SCRAMJETCLIENT];
	} else {
		setWasm(Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0)));
		delete self.WASM;

		const channel = new MessageChannel();
		const transport = new RemoteTransport(channel.port1);
		sw?.postMessage(
			{
				$sw$initRemoteTransport: {
					port: channel.port2,
					prefix: prefix.href,
				},
			},
			[channel.port2]
		);

		const cookieJar = new CookieJar();
		cookieJar.load(cookies);

		const context = {
			interface: {
				getInjectScripts: yieldGetInjectScripts(
					cookieJar,
					config,
					sjconfig,
					prefix
				),
				codecEncode,
				codecDecode,
			},
			prefix,
			cookieJar,
			config: sjconfig,
		};
		function createFrameId() {
			return `${Array(8)
				.fill(0)
				.map(() => Math.floor(Math.random() * 36).toString(36))
				.join("")}`;
		}

		const frame = globalThis.frameElement;
		if (frame && !frame.name) {
			frame.name = createFrameId();
		}

		client = new ScramjetClient(globalThis, {
			context,
			transport,
			sendSetCookie: async (url, cookie) => {
				// sw.postMessage({
				// 	$controller$setCookie: {
				// 		url,
				// 		cookie
				// 	}
				// });
			},
			shouldPassthroughWebsocket: (url) => {
				return url === "wss://anura.pro/";
			},
			shouldBlockMessageEvent(i) {
				console.log(i);
				return false;
			},
		});

		client.hook();
	}
}
