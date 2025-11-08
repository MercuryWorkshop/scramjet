import { MethodsDefinition, RpcHelper } from "@mercuryworkshop/rpc";
import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";

declare const $scramjet: typeof ScramjetGlobal;
const {
	setWasm,
	setConfig,
	setInterface,
	rewriteUrl,
	ScramjetFetchHandler,
	ScramjetHeaders,
	CookieJar,
} = $scramjet;

import { Controllerbound, SWbound } from "./types";
import LibcurlClient from "@mercuryworkshop/libcurl-transport";
import { BareClient } from "@mercuryworkshop/bare-mux-custom";

let lc = new LibcurlClient({
	wisp: "wss://anura.pro/",
});
const client = new BareClient(lc);

const cookieJar = new CookieJar();

type Config = {
	wasmPath: string;
	scramjetPath: string;
	virtualWasmPath: string;
	prefix: string;
};

fetch("/scramjet/scramjet.wasm.wasm").then(async (resp) => {
	setWasm(await resp.arrayBuffer());
});

export const config: Config = {
	prefix: "/~/sj",
	virtualWasmPath: "/scramjet.wasm.js",
	scramjetPath: "/scramjet/scramjet.js",
};

const cfg = {
	prefix: "/scramjet/",
	globals: {
		wrapfn: "$scramjet$wrap",
		wrappropertybase: "$scramjet__",
		wrappropertyfn: "$scramjet$prop",
		cleanrestfn: "$scramjet$clean",
		importfn: "$scramjet$import",
		rewritefn: "$scramjet$rewrite",
		metafn: "$scramjet$meta",
		wrappostmessagefn: "$scramjet$wrappostmessage",
		pushsourcemapfn: "$scramjet$pushsourcemap",
		trysetfn: "$scramjet$tryset",
		templocid: "$scramjet$temploc",
		tempunusedid: "$scramjet$tempunused",
	},
	flags: {
		syncxhr: false,
		strictRewrites: true,
		rewriterLogs: false,
		captureErrors: true,
		cleanErrors: false,
		scramitize: false,
		sourcemaps: true,
		destructureRewrites: false,
		allowInvalidJs: false,
		allowFailedIntercepts: false,
		antiAntiDebugger: false,
	},
	siteFlags: {},
	codec: {
		encode: `(url) => {
						if (!url) return url;

						return encodeURIComponent(url);
					}`,
		decode: `(url) => {
						if (!url) return url;

						return decodeURIComponent(url);
					}`,
	},
	maskedfiles: ["inject.js", "scramjet.wasm.js"],
};

setConfig(cfg);

const getInjectScripts = (meta, handler, cfg, cookiejar, script) => {
	return [
		script(config.scramjetPath),
		script(
			meta.prefix.href.substring(0, meta.prefix.href.length - 1) +
				config.virtualWasmPath
		),
		script(
			"data:text/javascript;base64," +
				btoa(`
					console.log("execute me twin");
				$scramjet.setWasm(Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0)));
				delete self.WASM;

				$scramjet.loadAndHook({
					interface: {
						getInjectScripts: ${getInjectScripts.toString()},
						onClientbound: async (type, msg) => {
						},
						sendServerbound: async (type, msg) => {
						},
					},
					config: ${JSON.stringify(cfg)},
					cookies: ${cookiejar.dump()},
					transport: null,
				})

				document.currentScript.remove();
			`)
		),
	];
};
setInterface({
	getInjectScripts,
	onClientbound() {},
	sendServerbound(type, data) {},
	async fetchDataUrl(dataUrl: string) {
		return await fetch(dataUrl);
	},
});

const frames: Record<string, Frame> = {};

let wasmPayload: string | null = null;

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

export class Controller {
	id: string;
	prefix: string;
	frames: Frame[] = [];
	cookieJar = new CookieJar();

	private rpc: RpcHelper<Controllerbound, SWbound>;
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

				console.log(path, frame.prefix + config.virtualWasmPath);
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

				let sjheaders = new ScramjetHeaders();
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
					forceCrossOriginIsolated: data.forceCrossOriginIsolated,
					body: data.body,
					cache: data.cache,
					cookieStore: this.cookieJar,
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

class Frame {
	fetchHandler: ScramjetFetchHandler;
	id: string;
	prefix: string;

	constructor(
		public controller: Controller,
		public element: HTMLIFrameElement
	) {
		this.id = makeId();
		this.prefix = this.controller.prefix + "/" + this.id + "/";

		this.fetchHandler = new ScramjetFetchHandler({
			client,
			cookieJar: this.controller.cookieJar,
			prefix: new URL(this.prefix, location.href),
			sendClientbound: (type, msg) => {},
			onServerbound: (type, listener) => {},
		});
	}

	go(url: string) {
		const encoded = rewriteUrl(url, {
			prefix: new URL(this.prefix, location.href),
			origin: new URL(location.href),
			base: new URL(location.href),
		});
		console.log(encoded);
		this.element.src = encoded;
	}
}
