import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";
declare const $scramjet: typeof ScramjetGlobal;
import type {
	RawHeaders,
	ProxyTransport,
	TransferrableResponse,
} from "@mercuryworkshop/proxy-transports";

import { RpcHelper } from "@mercuryworkshop/rpc";
import type { Config } from ".";
import { CONTROLLERFRAME } from "./symbols";
import type {
	SerializedCookieSyncEntry,
	ControllerToTransport,
	TransportToController,
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
		const port = channel.port1;
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
		_signal: AbortSignal | undefined
	): Promise<TransferrableResponse> {
		return await this.rpc.call("request", {
			remote: remote.href,
			method,
			body,
			headers,
		});
	}

	async sendSetCookie(
		cookies: Array<{ url: URL; cookie: string }>,
		options: ScramjetGlobal.CookieSyncOptions = {}
	): Promise<void> {
		await this.rpc.call("sendSetCookie", {
			cookies: cookies.map(({ url, cookie }) => ({
				url: url.href,
				cookie,
			})),
			options,
		});
	}
}

const sw = navigator.serviceWorker.controller;
const { SCRAMJETCLIENT, ScramjetClient, CookieJar, setWasm } = $scramjet;

type Init = {
	config: Config;
	sjconfig: ScramjetGlobal.ScramjetConfig;
	prefix: URL;
	cookies: string;
	yieldGetInjectScripts: (
		config: Config,
		sjconfig: ScramjetGlobal.ScramjetConfig,
		prefix: URL,
		cookieJar: ScramjetGlobal.CookieJar,
		codecEncode: (input: string) => string,
		codecDecode: (input: string) => string
	) => any;
	codecEncode: (input: string) => string;
	codecDecode: (input: string) => string;
	initHeaders: RawHeaders;
	history: ScramjetGlobal.TrackedHistoryState[];
};

export function load(init: Init) {
	if (SCRAMJETCLIENT in globalThis) {
		(
			(globalThis as any)[SCRAMJETCLIENT] as ScramjetGlobal.ScramjetClient
		).syncDocumentInit({
			initHeaders: init.initHeaders,
			history: init.history,
			cookies: init.cookies,
		});
		return;
	}
	if (!("WASM" in self)) {
		throw new Error("WASM not found in global scope!");
	}
	const wasm = Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0));
	delete (self as any).WASM;
	setWasm(wasm);

	new ExecutionContextWrapper(globalThis, init);
}

function createFrameId() {
	return `${Array(8)
		.fill(0)
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")}`;
}

class ExecutionContextWrapper {
	client!: ScramjetGlobal.ScramjetClient;
	cookieJar: ScramjetGlobal.CookieJar;
	transport: RemoteTransport;
	private handleServiceWorkerCookieMessage: (event: MessageEvent) => void;

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

		this.handleServiceWorkerCookieMessage = (event: MessageEvent) => {
			if (
				!event.data?.$controller$setCookie ||
				typeof event.data.$controller$setCookie !== "object"
			) {
				return;
			}

			const payload = event.data.$controller$setCookie as {
				cookies?: SerializedCookieSyncEntry[];
				options?: ScramjetGlobal.CookieSyncOptions;
				id?: string;
			};

			if (payload.options?.clear) {
				this.cookieJar.clear();
			}

			if (Array.isArray(payload.cookies)) {
				for (const cookie of payload.cookies) {
					if (
						typeof cookie?.url !== "string" ||
						typeof cookie.cookie !== "string"
					) {
						continue;
					}

					try {
						this.cookieJar.setCookies(cookie.cookie, new URL(cookie.url));
					} catch {
						console.error("Failed to set cookie", cookie);
					}
				}
			}

			if (typeof payload.id === "string") {
				const targetSw = navigator.serviceWorker?.controller ?? sw;
				targetSw?.postMessage({
					$sw$setCookieDone: {
						id: payload.id,
					},
				});
			}
		};

		navigator.serviceWorker?.addEventListener(
			"message",
			this.handleServiceWorkerCookieMessage
		);

		this.injectScramjet();
	}

	injectScramjet() {
		const frame = this.global.frameElement as HTMLIFrameElement | null;
		if (frame && !frame.name) {
			frame.name = createFrameId();
		}
		let controllerFrame = frame?.[CONTROLLERFRAME];
		let isTopLevel = true;
		if (!controllerFrame) {
			isTopLevel = false;
			let currentwin = this.global.window;
			while (currentwin.parent !== currentwin) {
				const currentclient = currentwin[$scramjet.SCRAMJETCLIENT];
				if (!currentclient) {
					currentwin = currentwin.parent.window;
					continue;
				}
				const currentFrame = currentclient.descriptors.get(
					"window.frameElement",
					currentwin
				);
				if (currentFrame && currentFrame[CONTROLLERFRAME]) {
					controllerFrame = currentFrame[CONTROLLERFRAME];
					break;
				}
				currentwin = currentwin.parent.window;
			}
		}
		const context: ScramjetGlobal.ScramjetContext = {
			config: this.init.sjconfig,
			prefix: this.init.prefix,
			cookieJar: this.cookieJar,
			interface: {
				getInjectScripts: this.init.yieldGetInjectScripts(
					this.init.config,
					this.init.sjconfig,
					this.init.prefix,
					this.cookieJar,
					this.init.codecEncode,
					this.init.codecDecode
				),
				codecEncode: this.init.codecEncode,
				codecDecode: this.init.codecDecode,
			},
		};
		this.client = new ScramjetClient(this.global, {
			context,
			transport: this.transport,
			sendSetCookie: async (cookies, options) => {
				await this.transport.sendSetCookie(cookies, options);
			},
			shouldPassthroughWebsocket: () => {
				return false;
			},
			shouldBlockMessageEvent: () => {
				return false;
			},
			hookSubcontext: (frameself) => {
				const context = new ExecutionContextWrapper(frameself, {
					...this.init,
					cookies: this.cookieJar.dump(),
				});
				return context.client;
			},
			initHeaders: this.init.initHeaders,
			history: this.init.history,
		});
		const frameInitContext = {
			window: this.global.window,
			client: this.client,
			isTopLevel,
		};
		if (controllerFrame)
			$scramjet.Tap.dispatch(
				controllerFrame.hooks.frameInit.pre,
				frameInitContext,
				{}
			);
		this.client.hook();
		if (controllerFrame)
			$scramjet.Tap.dispatch(
				controllerFrame.hooks.frameInit.post,
				frameInitContext,
				{}
			);
	}
}
