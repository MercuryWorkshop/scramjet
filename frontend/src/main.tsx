import "./reset.css";
import "./style.css";

import {
	ScramjetHeaders,
	ScramjetServiceWorker,
	type ScramjetInitConfig,
	type ScramjetFetchContext,
	ScramjetController,
	CookieStore,
	handleFetch,
	rewriteUrl,
	config,
	ScramjetClient,
} from "@mercuryworkshop/scramjet/bundled";

// temp fix for vite not working
import.meta.hot?.accept(() => location.reload());

// import { initBrowser } from "./Browser";
let app = document.getElementById("app")!;
// import { Shell } from "./components/Shell";
// import { App } from "./App";
// import { css, type Component } from "dreamland/core";

// const { ScramjetController } = $scramjetLoadController();
// import { type ScramjetInitConfig } from "@mercuryworkshop/scramjet";

// export const isPuter = !import.meta.env.VITE_LOCAL && puter.env == "app";

const scramjetcfg: Partial<ScramjetInitConfig> = {
	wisp: "ws://localhost:1337/",
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		captureErrors: false,
		interceptDownloads: true,
	},
	siteFlags: {
		"https://worker-playground.glitch.me/.*": {
			serviceworkers: true,
		},
	},
};

export const scramjet = new ScramjetController(scramjetcfg);
console.log(scramjet.config);

let frame = (
	<iframe src="http://localhost:5233/controller.html"></iframe>
) as HTMLIFrameElement;
app.appendChild(frame);
let framewindow: Window = frame.contentWindow!;

class SwMessager {
	counter = 0;
	promises = new Map();

	async request(domain: string, message: any) {
		let controller = navigator.serviceWorker.controller;
		if (!controller) throw new Error("couldn't find controller");
		return new Promise((resolve, reject) => {
			this.promises.set(this.counter, { resolve, reject });
			controller.postMessage({
				$sandboxsw$type: "request",
				$sandboxsw$token: this.counter++,
				$sandboxsw$domain: domain,
				$sandboxsw$message: message,
			});
		});
	}

	handleMessage(token: number, message: any, error: any) {
		if (this.promises.has(token)) {
			let { resolve, reject } = this.promises.get(token);
			this.promises.delete(token);
			if (error) {
				reject(error);
			} else {
				resolve(message);
			}
		}
	}
}

// export interface ScramjetFetchParsed {
// 	url: URL;
// 	clientUrl?: URL;

// 	meta: URLMeta;
// 	scriptType: string;
// }

// interface ScramjetFetchResponse {
// 	body: BodyType;
// 	headers: BareHeaders;
// 	status: number;
// 	statusText: string;
// }

scramjet.init();
const tgt = new EventTarget();

const cookiestore = new CookieStore();

let client = new ScramjetClient(self);
const cfg = {
	wisp: "ws://localhost",
	prefix: "/scramjet/",
	globals: {
		wrapfn: "$scramjet$wrap",
		wrappropertybase: "$scramjet__",
		wrappropertyfn: "$scramjet$prop",
		cleanrestfn: "$scramjet$clean",
		importfn: "$scramjet$import",
		rewritefn: "$scramjet$rewrite",
		metafn: "$scramjet$meta",
		setrealmfn: "$scramjet$setrealm",
		pushsourcemapfn: "$scramjet$pushsourcemap",
		trysetfn: "$scramjet$tryset",
		templocid: "$scramjet$temploc",
		tempunusedid: "$scramjet$tempunused",
	},
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		serviceworkers: false,
		syncxhr: false,
		strictRewrites: true,
		rewriterLogs: false,
		captureErrors: true,
		cleanErrors: false,
		scramitize: false,
		sourcemaps: true,
		destructureRewrites: true,
		interceptDownloads: false,
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
};

const methods = {
	async fetch(data: ScramjetFetchContext): ScramjetFetchResponse {
		data.cookieStore = cookiestore;
		console.log(data);
		data.rawUrl = new URL(data.rawUrl);
		if (data.rawClientUrl) data.rawClientUrl = new URL(data.rawClientUrl);
		let headers = new ScramjetHeaders();
		console.log(client);
		for (let [k, v] of Object.entries(data.initialHeaders)) {
			headers.set(k, v);
		}
		data.initialHeaders = headers;
		if (data.rawUrl.pathname === cfg.files.wasm) {
			return fetch(cfg.files.wasm).then(async (x) => {
				const buf = await x.arrayBuffer();
				const b64 = btoa(
					new Uint8Array(buf)
						.reduce(
							(data, byte) => (data.push(String.fromCharCode(byte)), data),
							[]
						)
						.join("")
				);

				let payload = "";
				payload +=
					"if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
				payload += `self.WASM = '${b64}';`;

				return {
					body: payload,
					headers: { "Content-Type": "application/javascript" },
					status: 200,
					statusText: "OK",
				};
			});
		} else if (data.rawUrl.pathname === cfg.files.all) {
			return fetch(cfg.files.all).then(async (x) => {
				const text = await x.text();
				return {
					body: text,
					headers: { "Content-Type": "application/javascript" },
					status: 200,
					statusText: "OK",
				};
			});
		}

		return handleFetch.call(
			tgt as any,
			data,
			cfg,
			client.bare,
			new URL("http://localhost:5233" + cfg.prefix)
		);
	},
};
window.addEventListener("message", async (event) => {
	let data = event.data;
	if (!("$sandboxsw$type" in data)) return;
	if (data.$sandboxsw$type == "request") {
		let domain = data.$sandboxsw$domain;
		let message = data.$sandboxsw$message;
		let token = data.$sandboxsw$token;

		let fn = (methods as any)[domain];

		let result = await fn(message);
		framewindow.postMessage(
			{
				$sandboxsw$type: "response",
				$sandboxsw$token: token,
				$sandboxsw$message: result,
			},
			"*"
		);
	} else if (data.$sandboxsw$type == "confirm") {
		let ifrm = (
			<iframe src="http://localhost:5233/scramjet/https%3A%2F%2Fexample.com%2F"></iframe>
		);
		app.appendChild(ifrm);
	}
	console.log("recv'd data", data);
});
