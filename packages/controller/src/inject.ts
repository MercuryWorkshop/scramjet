import type { CookieJar, ScramjetConfig } from "@mercuryworkshop/scramjet";
import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";
declare const $scramjet: typeof ScramjetGlobal;

import type {
	RawHeaders,
	ProxyTransport,
	TransferrableResponse,
} from "@mercuryworkshop/proxy-transports";

import { RpcHelper } from "@mercuryworkshop/rpc";
import type {
	ControllerToTransport,
	TransportToController,
	WebSocketData,
	WebSocketMessage,
} from "./types";

const MessagePort_postMessage = MessagePort.prototype.postMessage;
const postMessage = (
	port: MessagePort,
	data: any,
	transfer?: Transferable[]
) => {
	MessagePort_postMessage.call(port, data, transfer as any);
};

class RemoteTransport implements ProxyTransport {
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
				postMessage(port, data, transfer);
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
		requestHeaders: RawHeaders,
		onopen: (protocol: string, extensions: string) => void,
		onmessage: (data: Blob | ArrayBuffer | string) => void,
		onclose: (code: number, reason: string) => void,
		onerror: (error: string) => void
	): [
		(data: Blob | ArrayBuffer | string) => void,
		(code: number, reason: string) => void,
	] {
		const channel = new MessageChannel();
		let port = channel.port1;
		console.warn("connecting");
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
				console.log(response);
				if (response.result === "success") {
					onopen(response.protocol, response.extensions);
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
				postMessage(
					port,
					{
						type: "data",
						data: data,
					},
					data instanceof ArrayBuffer ? [data] : []
				);
			},
			(code) => {
				postMessage(port, {
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
		headers: RawHeaders,
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
		prefix: URL,
		codecEncode: (input: string) => string,
		codecDecode: (input: string) => string
	) => any;
	codecEncode: (input: string) => string;
	codecDecode: (input: string) => string;
};

export function load(init: Init) {
	if (SCRAMJETCLIENT in globalThis) {
		return;
	}
	if (!("WASM" in self)) {
		throw new Error("WASM not found in global scope!");
	}
	const wasm = Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0));
	delete (self as any).WASM;
	setWasm(wasm);

	let context = new ExecutionContextWrapper(globalThis, init);
}

function createFrameId() {
	return `${Array(8)
		.fill(0)
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")}`;
}

class ExecutionContextWrapper {
	client!: ScramjetGlobal.ScramjetClient;
	cookieJar: CookieJar;
	transport: RemoteTransport;

	constructor(
		public global: typeof globalThis,
		public init: Init
	) {
		const channel = new MessageChannel();
		this.transport = new RemoteTransport(channel.port1);
		sw?.postMessage(
			{
				$sw$initRemoteTransport: {
					port: channel.port2,
					prefix: this.init.prefix.href,
				},
			},
			[channel.port2]
		);

		this.cookieJar = new CookieJar();
		this.cookieJar.load(this.init.cookies);

		this.injectScramjet();
	}

	injectScramjet() {
		const frame = this.global.frameElement as HTMLIFrameElement | null;
		if (frame && !frame.name) {
			frame.name = createFrameId();
		}

		const context: ScramjetGlobal.ScramjetContext = {
			interface: {
				getInjectScripts: this.init.yieldGetInjectScripts(
					this.cookieJar,
					this.init.config,
					this.init.sjconfig,
					this.init.prefix,
					this.init.codecEncode,
					this.init.codecDecode
				),
				codecEncode: this.init.codecEncode,
				codecDecode: this.init.codecDecode,
			},
			config: this.init.sjconfig,
			prefix: this.init.prefix,
			cookieJar: this.cookieJar,
		};

		this.client = new ScramjetClient(this.global, {
			context,
			transport: this.transport,
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
				return false;
			},
			hookSubcontext: (frameself, frame) => {
				const context = new ExecutionContextWrapper(frameself, this.init);
				return context.client;
			},
		});

		this.client.hook();
	}
}
