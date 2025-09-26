import {
	ScramjetHeaders,
	ScramjetServiceWorker,
	type ScramjetInitConfig,
	type ScramjetFetchContext,
	ScramjetController,
	type ScramjetFetchResponse,
	CookieStore,
	handleFetch,
	rewriteUrl,
	config,
	ScramjetClient,
	setConfig,
	unrewriteUrl,
	type URLMeta,
} from "@mercuryworkshop/scramjet/bundled";

import * as tldts from "tldts";

const cfg = {
	wisp: "ws://localhost:1337/",
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

setConfig(cfg);

const ISOLATION_ORIGIN = "http://localhost:5233";

type Controller = {
	controllerframe: HTMLIFrameElement;
	rootdomain: string;
	baseurl: URL;
	prefix: URL;
	window: Window;
	ready: Promise<void>;
	readyResolve: () => void;
};

function hashDomain(domain: string): string {
	// dbj2
	// TODO investigate possibility of collisions at some point
	let hash = 0;
	for (let i = 0; i < domain.length; i++) {
		const char = domain.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36).substring(0, 8);
}

const controllers: Controller[] = [];

function getRootDomain(url: URL): string {
	return tldts.getDomain(url.href) || url.hostname;
}

function makeController(url: URL): Controller {
	let originurl = new URL(ISOLATION_ORIGIN);
	let baseurl = new URL(
		`${originurl.protocol}//${hashDomain(getRootDomain(url))}.${originurl.host}`
	);
	let frame = document.createElement("iframe");
	const rootdomain = getRootDomain(url);
	frame.src = baseurl.href + "controller.html";
	frame.style.display = "none";
	document.body.appendChild(frame);

	let readyResolve;
	let ready = new Promise<void>((res) => {
		readyResolve = res;
	});

	const prefix = new URL(baseurl.protocol + baseurl.host + cfg.prefix);

	const controller = {
		controllerframe: frame,
		window: frame.contentWindow!,
		rootdomain,
		baseurl,
		prefix,
		ready,
		readyResolve: readyResolve!,
	};
	controllers.push(controller);

	return controller;
}

export class IsolatedFrame {
	frame: HTMLIFrameElement;
	constructor() {
		this.frame = document.createElement("iframe");
	}

	async go(url: URL) {
		let controller = controllers.find((c) => {
			return c.rootdomain === getRootDomain(url);
		});

		if (!controller) {
			controller = makeController(url);
		}
		await controller.ready;

		const prefix = controller.prefix;

		this.frame.src = rewriteUrl(url, {
			origin: prefix, // origin/base don't matter here because we're always sending an absolute URL
			base: prefix,
			prefix,
		});
	}
}

const methods = {
	async fetch(
		data: ScramjetFetchContext,
		controller: Controller
	): Promise<[ScramjetFetchResponse, Transferable[] | undefined]> {
		data.cookieStore = cookiestore;
		data.rawUrl = new URL(data.rawUrl);
		if (data.rawClientUrl) data.rawClientUrl = new URL(data.rawClientUrl);
		let headers = new ScramjetHeaders();
		for (let [k, v] of Object.entries(data.initialHeaders)) {
			headers.set(k, v);
		}
		data.initialHeaders = headers;
		if (data.rawUrl.pathname === cfg.files.wasm) {
			return [await makeWasmResponse(), undefined];
		} else if (data.rawUrl.pathname === cfg.files.all) {
			return [await makeAllResponse(), undefined];
		}

		if (data.destination === "document" || data.destination === "iframe") {
			const unrewritten = unrewriteUrl(data.rawUrl, {
				prefix: controller.prefix,
			} as URLMeta);

			// our controller is bound to a root domain
			// if a site under the controller tries to iframe a cross-site domain it needs to redirect to that different controller
			const reqrootdomain = getRootDomain(new URL(unrewritten));
			if (reqrootdomain !== controller.rootdomain) {
				let crosscontroller = controllers.find((c) => {
					return c.rootdomain === reqrootdomain;
				});

				if (!crosscontroller) {
					crosscontroller = makeController(new URL(unrewritten));
				}
				await crosscontroller.ready;

				// now send a redirect so the browser will load the request from the other controller's sw
				return [
					{
						body: "Redirecting Cross-Origin Frame Request...",
						status: 302,
						statusText: "Found",
						headers: {
							"Content-Type": "text/plain",
							Location: rewriteUrl(new URL(unrewritten), {
								origin: crosscontroller.prefix,
								base: crosscontroller.prefix,
								prefix: crosscontroller.prefix,
							}),
						},
					},
					undefined,
				];
			}
		}

		const fetchresponse = await handleFetch.call(
			tgt as any,
			data,
			cfg,
			client.bare,
			controller.prefix
		);

		let transfer = undefined;
		if (
			fetchresponse.body instanceof ArrayBuffer ||
			fetchresponse.body instanceof ReadableStream
		) {
			transfer = [fetchresponse.body];
		}

		return [fetchresponse, transfer];
	},
};
window.addEventListener("message", async (event) => {
	let data = event.data;
	if (!(data && "$sandboxsw$type" in data)) return;
	let controller = controllers.find(
		(c) => c.controllerframe.contentWindow == event.source
	);
	if (!controller) {
		console.error("No controller found for message", data);
		return;
	}

	try {
		if (data.$sandboxsw$type == "request") {
			let domain = data.$sandboxsw$domain;
			let message = data.$sandboxsw$message;
			let token = data.$sandboxsw$token;

			let fn = (methods as any)[domain];

			let [result, transfer] = await fn(message, controller);
			controller.window.postMessage(
				{
					$sandboxsw$type: "response",
					$sandboxsw$token: token,
					$sandboxsw$message: result,
				},
				controller.baseurl.origin,
				transfer
			);
		} else if (data.$sandboxsw$type == "confirm") {
			controller.readyResolve();
		}
	} catch (e) {
		console.log(e);
		console.error("error in response", e);
	}
});

const tgt = new EventTarget();

const cookiestore = new CookieStore();

let client = new ScramjetClient(self);

let wasmPayload: string | null = null;
let allPayload: string | null = null;

async function makeWasmResponse() {
	if (!wasmPayload) {
		const resp = await fetch(cfg.files.wasm);
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

	return {
		body: wasmPayload,
		headers: { "Content-Type": "application/javascript" },
		status: 200,
		statusText: "OK",
	};
}

async function makeAllResponse(): Promise<ScramjetFetchResponse> {
	if (!allPayload) {
		const resp = await fetch(cfg.files.all);
		allPayload = await resp.text();
	}

	return {
		body: allPayload,
		headers: { "Content-Type": "application/javascript" },
		status: 200,
		statusText: "OK",
	};
}
