import { type MethodsDefinition, RpcHelper } from "@mercuryworkshop/rpc";
import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";

declare const $scramjet: typeof ScramjetGlobal;

export let Plugin = $scramjet.Plugin;

import {
	type TransportToController,
	type Controllerbound,
	type ControllerToTransport,
	type SWbound,
	type WebSocketMessage,
} from "./types";
import {
	BareCompatibleClient,
	BareResponse,
	type ProxyTransport,
} from "@mercuryworkshop/proxy-transports";

const cookieJar = new $scramjet.CookieJar();

type Config = {
	wasmPath: string;
	injectPath: string;
	scramjetPath: string;
	virtualWasmPath: string;
	prefix: string;
};

export const config: Config = {
	prefix: "/~/sj/",
	virtualWasmPath: "scramjet.wasm.js",
	injectPath: "/controller/controller.inject.js",
	scramjetPath: "/scramjet/scramjet.js",
	wasmPath: "/scramjet/scramjet.wasm",
};

const defaultCfg = {
	flags: {
		...$scramjet.defaultConfig.flags,
		allowFailedIntercepts: true,
	},
	maskedfiles: ["inject.js", "scramjet.wasm.js"],
};

const frames: Record<string, Frame> = {};

let wasmPayload: string | null = null;

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

const codecEncode = (url: string) => {
	if (!url) return url;

	return encodeURIComponent(url);
};

const codecDecode = (url: string) => {
	if (!url) return url;

	return decodeURIComponent(url);
};

type ControllerInit = {
	serviceworker: ServiceWorker;
	transport: ProxyTransport;
};

let wasmAlreadyFetched = false;

async function loadScramjetWasm() {
	if (wasmAlreadyFetched) {
		return;
	}

	let resp = await fetch(config.wasmPath);
	$scramjet.setWasm(await resp.arrayBuffer());
	wasmAlreadyFetched = true;
}

export class Controller {
	id: string;
	prefix: string;
	frames: Frame[] = [];
	cookieJar = new $scramjet.CookieJar();
	flags: typeof defaultCfg.flags = { ...defaultCfg.flags };

	rpc: RpcHelper<Controllerbound, SWbound>;
	private ready: Promise<[void, void]>;
	private readyResolve!: () => void;
	public isReady: boolean = false;

	transport: ProxyTransport;

	private methods: MethodsDefinition<Controllerbound> = {
		ready: async () => {
			this.readyResolve();
		},
		request: async (data) => {
			try {
				let path = new URL(data.rawUrl).pathname;
				const frame = this.frames.find((f) => path.startsWith(f.prefix));
				if (!frame) throw new Error("No frame found for request");

				if (path === frame.prefix + config.virtualWasmPath) {
					if (!wasmPayload) {
						const resp = await fetch(config.wasmPath);
						const buf = await resp.arrayBuffer();
						const b64 = btoa(
							new Uint8Array(buf)
								.reduce(
									(data, byte) => (data.push(String.fromCharCode(byte)), data),
									[] as any
								)
								.join("")
						);

						let payload = "";
						payload +=
							"if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
						payload += `self.WASM = '${b64}';`;
						wasmPayload = payload;
					}

					return [
						{
							body: wasmPayload,
							status: 200,
							statusText: "OK",
							headers: [["Content-Type", "application/javascript"]],
						},
						[],
					];
				}

				let sjheaders = $scramjet.ScramjetHeaders.fromRawHeaders(
					data.initialHeaders
				);

				const fetchresponse = await frame.fetchHandler.handleFetch({
					initialHeaders: sjheaders,
					rawClientUrl: data.rawClientUrl
						? new URL(data.rawClientUrl)
						: undefined,
					rawUrl: new URL(data.rawUrl),
					destination: data.destination,
					method: data.method,
					mode: data.mode,
					referrer: data.referrer,
					body: data.body,
					cache: data.cache,
				});

				return [
					{
						body: fetchresponse.body,
						status: fetchresponse.status,
						statusText: fetchresponse.statusText,
						headers: fetchresponse.headers.toRawHeaders(),
					},
					fetchresponse.body instanceof ReadableStream ||
					fetchresponse.body instanceof ArrayBuffer
						? [fetchresponse.body]
						: [],
				];
			} catch (e) {
				console.error("Error in controller request handler:", e);
				throw e;
			}
		},
		initRemoteTransport: async (port) => {
			const rpc = new RpcHelper<TransportToController, ControllerToTransport>(
				{
					request: async ({ remote, method, body, headers }) => {
						let response = await this.transport.request(
							new URL(remote),
							method,
							body,
							headers,
							undefined
						);
						return [response, [response.body]];
					},
					connect: async ({ url, protocols, requestHeaders, port }) => {
						let resolve: (arg: TransportToController["connect"][1]) => void;
						let promise = new Promise<TransportToController["connect"][1]>(
							(res) => (resolve = res)
						);
						const [send, close] = this.transport.connect(
							new URL(url),
							protocols,
							requestHeaders,
							(protocol, extensions) => {
								resolve({
									result: "success",
									protocol: protocol,
									extensions: extensions,
								});
							},
							(data) => {
								port.postMessage(
									{
										type: "data",
										data: data,
									} as WebSocketMessage,
									data instanceof ArrayBuffer ? [data] : []
								);
							},
							(close, reason) => {
								port.postMessage({
									type: "close",
									code: close,
									reason: reason,
								} as WebSocketMessage);
							},
							(error) => {
								resolve({
									result: "failure",
									error: error,
								});
							}
						);
						port.onmessageerror = (ev) => {
							console.error(
								"Transport port messageerror (this should never happen!)",
								ev
							);
						};
						port.onmessage = ({ data }: { data: WebSocketMessage }) => {
							if (data.type === "data") {
								send(data.data);
							} else if (data.type === "close") {
								close(data.code, data.reason);
							}
						};

						return [await promise, []];
					},
				},
				"transport",
				(data, transfer) => port.postMessage(data, transfer)
			);
			port.onmessageerror = (ev) => {
				console.error(
					"Transport port messageerror (this should never happen!)",
					ev
				);
			};
			port.onmessage = (e) => {
				rpc.recieve(e.data);
			};
			rpc.call("ready", undefined, []);
		},
		sendSetCookie: async ({ url, cookie }) => {},
	};

	constructor(public init: ControllerInit) {
		this.transport = init.transport;
		this.id = makeId();
		this.prefix = config.prefix + this.id + "/";

		this.ready = Promise.all([
			new Promise<void>((resolve) => {
				this.readyResolve = resolve;
			}),
			loadScramjetWasm(),
		]);

		let channel = new MessageChannel();
		this.rpc = new RpcHelper<Controllerbound, SWbound>(
			this.methods,
			"tabchannel-" + this.id,
			(data, transfer) => {
				channel.port1.postMessage(data, transfer);
			}
		);
		channel.port1.addEventListener("message", (e) => {
			this.rpc.recieve(e.data);
		});
		channel.port1.start();

		init.serviceworker.postMessage(
			{
				$controller$init: {
					prefix: config.prefix + this.id,
					id: this.id,
				},
			},
			[channel.port2]
		);
	}

	createFrame(element?: HTMLIFrameElement): Frame {
		if (!this.ready) {
			throw new Error(
				"Controller is not ready! Try awaiting controller.wait()"
			);
		}
		element ??= document.createElement("iframe");
		const frame = new Frame(this, element);
		this.frames.push(frame);
		return frame;
	}

	async wait(): Promise<void> {
		await this.ready;
	}
}

function base64Encode(text: string) {
	return btoa(
		new TextEncoder()
			.encode(text)
			.reduce(
				(data, byte) => (data.push(String.fromCharCode(byte)), data),
				[] as any
			)
			.join("")
	);
}

function yieldGetInjectScripts(
	cookieJar: ScramjetGlobal.CookieJar,
	config: Config,
	sjconfig: ScramjetGlobal.ScramjetConfig,
	prefix: URL,
	codecEncode: (input: string) => string,
	codecDecode: (input: string) => string
) {
	let getInjectScripts: ScramjetGlobal.ScramjetInterface["getInjectScripts"] = (
		meta,
		handler,
		script
	) => {
		return [
			script(config.scramjetPath),
			script(config.injectPath),
			script(prefix.href + config.virtualWasmPath),
			script(
				"data:text/javascript;charset=utf-8;base64," +
					base64Encode(`
					document.currentScript.remove();
					$scramjetController.load({
						config: ${JSON.stringify(config)},
						sjconfig: ${JSON.stringify(sjconfig)},
						cookies: ${cookieJar.dump()},
						prefix: new URL("${prefix.href}"),
						yieldGetInjectScripts: ${yieldGetInjectScripts.toString()},
						codecEncode: ${codecEncode.toString()},
						codecDecode: ${codecDecode.toString()},
					})
				`)
			),
		];
	};
	return getInjectScripts;
}

export class Frame {
	fetchHandler: ScramjetGlobal.ScramjetFetchHandler;
	id: string;
	prefix: string;

	hooks: {
		fetch: ScramjetGlobal.FetchTap;
	};

	get context(): ScramjetGlobal.ScramjetContext {
		let sjcfg = {
			...$scramjet.defaultConfig,
			flags: this.controller.flags,
			maskedfiles: defaultCfg.maskedfiles,
		};

		return {
			cookieJar,
			prefix: new URL(this.prefix, location.href),
			config: sjcfg,
			interface: {
				getInjectScripts: yieldGetInjectScripts(
					this.controller.cookieJar,
					config,
					sjcfg,
					new URL(this.prefix, location.href),
					codecEncode,
					codecDecode
				),
				getWorkerInjectScripts: (meta, type, script) => {
					let str = "";

					str += script(config.scramjetPath);
					str += script(this.prefix + config.virtualWasmPath);
					str += script(
						"data:text/javascript;charset=utf-8;base64," +
							base64Encode(`
					(()=>{
						const { ScramjetClient, CookieJar, setWasm } = $scramjet;

						setWasm(Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0)));
						delete self.WASM;

						const sjconfig = ${JSON.stringify(sjcfg)};
						const prefix = new URL("${this.prefix}", location.href);

						const context = {
							interface: {
								codecEncode: ${codecEncode.toString()},
								codecDecode: ${codecDecode.toString()},
							},
							prefix,
							config: sjconfig
						};

						const client = new ScramjetClient(globalThis, {
							context,
							transport: null,
							shouldPassthroughWebsocket: (url) => {
								return url === "wss://anura.pro/";
							}
						});

						client.hook();
					})();
					`)
					);

					return str;
				},
				codecEncode,
				codecDecode,
			},
		};
	}

	constructor(
		public controller: Controller,
		public element: HTMLIFrameElement
	) {
		this.id = makeId();
		this.prefix = this.controller.prefix + this.id + "/";

		this.fetchHandler = new $scramjet.ScramjetFetchHandler({
			crossOriginIsolated: self.crossOriginIsolated,
			context: this.context,
			transport: controller.transport,
			async sendSetCookie(url, cookie) {},
			async fetchBlobUrl(url) {
				return BareResponse.fromNativeResponse(await fetch(url));
			},
			async fetchDataUrl(url) {
				return BareResponse.fromNativeResponse(await fetch(url));
			},
		});

		this.hooks = {
			fetch: this.fetchHandler.hooks.fetch,
		};
	}

	go(url: string) {
		const encoded = $scramjet.rewriteUrl(url, this.context, {
			origin: new URL(location.href),
			base: new URL(location.href),
		});
		this.element.src = encoded;
	}
}
