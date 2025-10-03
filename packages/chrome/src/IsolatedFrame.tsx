import {
	ScramjetHeaders,
	type ScramjetFetchContext,
	type ScramjetFetchResponse,
	CookieStore,
	handleFetch,
	rewriteUrl,
	setConfig,
	unrewriteUrl,
	type URLMeta,
	BareClient,
	ScramjetServiceWorker,
} from "@mercuryworkshop/scramjet/bundled";
import { ElementType, type Handler, Parser } from "htmlparser2";
import { type ChildNode, DomHandler, Element, Comment, Node } from "domhandler";
import * as tldts from "tldts";

import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconBookmark from "@ktibow/iconset-ion/bookmark-outline";
import iconCode from "@ktibow/iconset-ion/code-outline";
import iconLink from "@ktibow/iconset-ion/link-outline";
import iconAdd from "@ktibow/iconset-ion/duplicate-outline";
import iconCopy from "@ktibow/iconset-ion/copy-outline";
import iconSave from "@ktibow/iconset-ion/save-outline";

import type { Chromebound, Framebound } from "../../inject/src/types";
import type { Tab } from "./Tab";
import { browser } from "./Browser";
import { createMenu } from "./components/Menu";

const ISOLATION_ORIGIN = import.meta.env.VITE_ISOLATION_ORIGIN;

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
export const bare = new BareClient();

type Controller = {
	controllerframe: HTMLIFrameElement;
	cookiestore: CookieStore;
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
	const cookiestore = new CookieStore();

	const controller = {
		controllerframe: frame,
		window: frame.contentWindow!,
		rootdomain,
		baseurl,
		prefix,
		ready,
		readyResolve: readyResolve!,
		cookiestore,
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

const inject_script = "/inject.js";

const methods = {
	async fetch(
		data: ScramjetFetchContext,
		controller: Controller
	): Promise<[ScramjetFetchResponse, Transferable[] | undefined]> {
		// repopulate fetchcontext fields with the items that weren't cloned over postMessage
		data.cookieStore = controller.cookiestore;
		data.rawUrl = new URL(data.rawUrl);
		if (data.rawClientUrl) data.rawClientUrl = new URL(data.rawClientUrl);
		let headers = new ScramjetHeaders();
		for (let [k, v] of Object.entries(data.initialHeaders)) {
			headers.set(k, v);
		}
		data.initialHeaders = headers;

		// handle scramjet.all.js and scramjet.wasm.js requests
		if (data.rawUrl.pathname === cfg.files.wasm) {
			return [await makeWasmResponse(), undefined];
		} else if (data.rawUrl.pathname === cfg.files.all) {
			return [await makeAllResponse(), undefined];
		} else if (data.rawUrl.pathname === inject_script) {
			return [
				await fetch(inject_script).then(async (x) => {
					const text = await x.text();
					return {
						body: text,
						headers: { "Content-Type": "application/javascript" },
						status: 200,
						statusText: "OK",
					};
				}),
				undefined,
			];
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

		// TODO fix eventtarget jank
		const tgt = new EventTarget();
		tgt.addEventListener("htmlPostRewrite", (e: any) => {
			const handler = e.handler as DomHandler;
			function findhead(node: Element): Element | null {
				if (node.type === ElementType.Tag && node.name === "head") {
					return node as Element;
				} else if (node.childNodes) {
					for (const child of node.childNodes) {
						const head = findhead(child as Element);
						if (head) return head;
					}
				}

				return null;
			}

			const head = findhead(handler.root as Node as Element)!;
			head.children.unshift(new Element("script", { src: inject_script }));
		});

		const fetchresponse = await handleFetch.call(
			tgt as any,
			data,
			cfg,
			bare,
			controller.prefix
		);

		let transfer: any[] | undefined = undefined;
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

let synctoken = 0;
let syncPool: { [token: number]: (val: any) => void } = {};
export function sendFrame<T extends keyof Framebound>(
	controller: Controller,
	type: T,
	message: Framebound[T][0]
): Promise<Framebound[T][1]> {
	let token = synctoken++;

	controller.window.postMessage(
		{
			$ipc$type: "request",
			$ipc$token: token,
			$ipc$message: {
				type,
				message,
			},
		},
		"*"
	);

	return new Promise((res) => {
		syncPool[token] = res;
	});
}

window.addEventListener("message", (event) => {
	let data = event.data;
	if (!(data && data.$ipc$type)) return;

	if (data.$ipc$type === "response") {
		let token = data.$ipc$token;
		if (typeof token !== "number") return;
		let cb = syncPool[token];
		if (cb) {
			cb(data.$ipc$message);
			delete syncPool[token];
		}
	} else if (data.$ipc$type === "request") {
		const { type, message } = data.$ipc$message;
		const token = data.$ipc$token;

		const tab =
			browser.tabs.find((t) => t.frame.frame.contentWindow === event.source) ||
			null;

		chromemethods[type as keyof ChromeboundMethods](tab, message).then(
			(response: any) => {
				(event.source as Window).postMessage(
					{
						$ipc$type: "response",
						$ipc$token: token,
						$ipc$message: response,
					},
					"*"
				);
			}
		);
	}
});

type ChromeboundMethods = {
	[K in keyof Chromebound]: (
		tab: Tab | null,
		arg: Chromebound[K][0]
	) => Promise<Chromebound[K][1]>;
};

function pageContextItems(
	tab: Tab,
	{ selection, image, anchor }: Chromebound["contextmenu"][0]
) {
	if (selection && selection.toString().length > 0) {
		return [
			{
				label: "Search",
				action: () => {
					const query = selection.toString();
					if (query) {
						tab.pushNavigate(
							new URL(
								`https://www.google.com/search?q=${encodeURIComponent(query)}`
							)
						);
					}
				},
			},
			{
				label: "Copy",
				action: () => {
					navigator.clipboard.writeText(selection.toString());
				},
			},
		];
	}

	if (image) {
		return [
			{
				label: "Open Image in New Tab",
				action: () => {
					// TODO: this is broken lol
					if (image.src) {
						let newTab = browser.newTab();
						newTab.pushNavigate(new URL(image.src));
					}
				},
			},
			{
				label: "Copy Image URL",
				action: () => {
					navigator.clipboard.writeText(image.src);
				},
			},
			{
				label: "Copy Image",
				action: () => {
					// copyImageToClipboard(target);
				},
			},
			{
				label: "Save Image As...",
				action: () => {
					// TODO
				},
			},
		];
	} else if (anchor) {
		return [
			{
				label: "Open Link",
				action: () => {
					if (anchor.href) {
						browser.activetab.pushNavigate(new URL(anchor.href));
					}
				},
				icon: iconLink,
			},
			{
				label: "Open Link in New Tab",
				action: () => {
					if (anchor.href) {
						browser.newTab(new URL(anchor.href));
					}
				},
				icon: iconAdd,
			},
			{
				label: "Copy Link Address",
				action: () => {
					navigator.clipboard.writeText(anchor.href);
				},
				icon: iconCopy,
			},
			{
				label: "Save Link As...",
				action: () => {
					// TODO
				},
				icon: iconSave,
			},
		];
	}

	return [
		{
			label: "Back",
			action: () => {
				tab.back();
			},
			icon: iconBack,
		},
		{
			label: "Forward",
			action: () => {
				tab.forward();
			},
			icon: iconForwards,
		},
		{
			label: "Reload",
			action: () => {
				tab.reload();
			},
			icon: iconRefresh,
		},
		{
			label: "Bookmark",
			action: () => {
				// TODO:
				console.log("Bookmarking", tab.title, tab.url);
			},
			icon: iconBookmark,
		},
		{
			label: "Inspect",
			action: () => {
				tab.devtoolsOpen = true;
				// if (e.target) requestInspectElement([e.target as HTMLElement, tab]);
			},
			icon: iconCode,
		},
	];
}
const chromemethods: ChromeboundMethods = {
	titlechange: async (tab, { title, icon }) => {
		console.log("title changed...", tab, title, icon);
		if (tab) {
			if (title) {
				tab.title = title;
				tab.history.current().title = title;
			}
			if (icon) {
				tab.icon = icon;
				tab.history.current().favicon = icon;
			}
		}
	},
	contextmenu: async (tab, msg) => {
		let offX = 0;
		let offY = 0;
		let { x, y } = tab!.frame.frame.getBoundingClientRect();
		offX += x;
		offY += y;
		createMenu(
			{ left: msg.x + offX, top: msg.y + offY },
			pageContextItems(tab!, msg)
		);
	},
};
