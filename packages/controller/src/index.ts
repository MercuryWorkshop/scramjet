import { type MethodsDefinition, RpcHelper } from "@mercuryworkshop/rpc";
import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";

declare const $scramjet: typeof ScramjetGlobal;
// const {
// 	setWasm,
// 	setConfig,
// 	rewriteUrl,
// 	ScramjetFetchHandler,
// 	ScramjetHeaders,
// 	CookieJar,
// } = $scramjet;

import type { Controllerbound, SWbound } from "./types";
import LibcurlClient from "@mercuryworkshop/libcurl-transport";
import {
	BareClient,
	type BareResponseFetch,
} from "@mercuryworkshop/bare-mux-custom";

let lc = new LibcurlClient({
	wisp: "wss://anura.pro/",
});
const client = new BareClient(lc);

const cookieJar = new $scramjet.CookieJar();

type Config = {
	wasmPath: string;
	scramjetPath: string;
	virtualWasmPath: string;
	prefix: string;
};

fetch("/scramjet/scramjet.wasm.wasm").then(async (resp) => {
	$scramjet.setWasm(await resp.arrayBuffer());
});

export const config: Config = {
	prefix: "/~/sj",
	virtualWasmPath: "/scramjet.wasm.js",
	scramjetPath: "/scramjet/scramjet.js",
	wasmPath: "/scramjet/scramjet.wasm.wasm",
};

const cfg = {
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

export class Controller {
	id: string;
	prefix: string;
	frames: Frame[] = [];
	cookieJar = new $scramjet.CookieJar();

	rpc: RpcHelper<Controllerbound, SWbound>;
	private ready: Promise<void>;
	private readyResolve: () => void;

	private methods: MethodsDefinition<Controllerbound> = {
		ready: async () => {
			this.readyResolve();
		},
		request: async (data) => {
			try {
				let path = new URL(data.rawUrl).pathname;
				const frame = this.frames.find((f) => path.startsWith(f.prefix));
				if (!frame) throw new Error("No frame found for request");

				if (
					path.startsWith(
						frame.prefix.substring(0, frame.prefix.length - 1) +
							config.virtualWasmPath
					)
				) {
					console.log("???");
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
							"console.warn('WTF'); if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
						payload += `self.WASM = '${b64}';`;
						wasmPayload = payload;
					}

					return [
						{
							body: wasmPayload,
							status: 200,
							statusText: "OK",
							headers: {
								"Content-Type": ["application/javascript"],
							},
						},
						[],
					];
				}

				let sjheaders = new $scramjet.ScramjetHeaders();
				for (let [k, v] of Object.entries(data.initialHeaders)) {
					for (let vv of v) {
						sjheaders.set(k, vv);
					}
				}

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
						headers: fetchresponse.headers,
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
	};

	constructor(serviceworker: ServiceWorker) {
		this.id = makeId();
		this.prefix = config.prefix + "/" + this.id;

		this.ready = new Promise<void>((resolve) => {
			this.readyResolve = resolve;
		});

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
		console.log(channel.port2);
		channel.port1.start();

		serviceworker.postMessage(
			{
				$controller$init: {
					prefix: config.prefix + "/" + this.id,
					id: this.id,
				},
			},
			[channel.port2]
		);
	}

	createFrame(element?: HTMLIFrameElement): Frame {
		element ??= document.createElement("iframe");
		const frame = new Frame(this, element);
		this.frames.push(frame);
		return frame;
	}

	wait(): Promise<void> {
		return this.ready;
	}
}

function yieldGetInjectScripts(
	cookieJar: ScramjetGlobal.CookieJar,
	config: Config,
	sjconfig: ScramjetGlobal.ScramjetConfig,
	prefix: URL
) {
	return function getInjectScripts(meta, handler, script) {
		return [
			script(config.scramjetPath),
			script(
				prefix.href.substring(0, prefix.href.length - 1) +
					config.virtualWasmPath
			),
			script(
				"data:text/javascript;base64," +
					btoa(`
					(()=>{
						const { ScramjetClient, CookieJar, setWasm } = $scramjet;

						setWasm(Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0)));
						delete self.WASM;

						const cookieJar = new CookieJar();
						const config = ${JSON.stringify(config)};
						const sjconfig = ${JSON.stringify(sjconfig)};
					 	cookieJar.load(${cookieJar.dump()});

						const prefix = new URL("${prefix.href}");
						const sw = navigator.serviceWorker.controller;

						const context = {
							interface: {
								getInjectScripts: (${yieldGetInjectScripts.toString()})(cookieJar, config, sjconfig, prefix),
								codecEncode: ${codecEncode.toString()},
								codecDecode: ${codecDecode.toString()},
							},
							prefix,
							cookieJar,
							config: sjconfig
						};
						function createFrameId() {
							return \`\${Array(8)
								.fill(0)
								.map(() => Math.floor(Math.random() * 36).toString(36))
								.join("")}\`;
						}

						const frame = globalThis.frameElement;
						if (frame && !frame.name) {
							frame.name = createFrameId();
						}

						const client = new ScramjetClient(globalThis, {
							context,
							transport: null,
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
							}
						});

						client.hook();
						document.currentScript.remove();
					})();
				`)
			),
		];
	};
}

class Frame {
	fetchHandler: ScramjetGlobal.ScramjetFetchHandler;
	id: string;
	prefix: string;

	get context() {
		let sjcfg = {
			...$scramjet.defaultConfig,
			...cfg,
		};
		return {
			cookieJar,
			prefix: new URL(this.prefix, location.href),
			config: sjcfg,
			interface: {
				getInjectScripts: yieldGetInjectScripts(
					this.controller.cookieJar,
					config,
					{ ...$scramjet.defaultConfig, ...cfg },
					new URL(this.prefix, location.href)
				),
				getWorkerInjectScripts: (meta, js, type, url) => {
					const module = type === "module";
					let str = "";
					const script = (script: string) => {
						if (module) {
							str += `import "${script}"\n`;
						} else {
							str += `importScripts("${script}");\n`;
						}
					};

					script(config.scramjetPath);
					script(
						this.prefix.substring(0, this.prefix.length - 1) +
							config.virtualWasmPath
					);
					str += `
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
					`;

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
		this.prefix = this.controller.prefix + "/" + this.id + "/";

		this.fetchHandler = new $scramjet.ScramjetFetchHandler({
			crossOriginIsolated: self.crossOriginIsolated,
			context: this.context,
			transport: lc,
			async sendSetCookie(url, cookie) {},
			async fetchBlobUrl(url) {
				return (await fetch(url)) as BareResponseFetch;
			},
			async fetchDataUrl(url) {
				return (await fetch(url)) as BareResponseFetch;
			},
		});
	}

	go(url: string) {
		const encoded = $scramjet.rewriteUrl(url, this.context, {
			origin: new URL(location.href),
			base: new URL(location.href),
		});
		console.log(encoded);
		this.element.src = encoded;
	}
}
