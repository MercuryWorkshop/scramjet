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

// export function setWispUrl(wispurl: string) {
// 	scramjetcfg.wisp = wispurl;
// 	scramjet.modifyConfig(scramjetcfg);
// }
// export const LoadInterstitial: Component<{ status: string }, {}> = function () {
// 	return (
// 		<dialog class="signin">
// 			<h1>Loading</h1>
// 			<p>{use(this.status)}</p>
// 		</dialog>
// 	);
// };
// LoadInterstitial.style = css`
// 	:scope {
// 		transition: opacity 0.4s ease;
// 		width: 50%;
// 		height: 20%;
// 		border: none;
// 		border-radius: 1em;
// 		text-align: center;
// 	}
// 	h1 {
// 		text-align: center;
// 		font-weight: bold;
// 		font-size: 2em;
// 	}
// 	:modal[open] {
// 		animation: fade 0.4s ease normal;
// 	}

// 	:modal::backdrop {
// 		backdrop-filter: blur(3px);
// 	}
// `;

// async function mount() {
// 	try {
// 		let shell = <Shell></Shell>;
// 		await initBrowser();

// 		let built = <App>{shell}</App>;
// 		app.replaceWith(built);
// 		built.addEventListener("contextmenu", (e) => {
// 			e.preventDefault();
// 		});

// 		if (!import.meta.env.VITE_LOCAL) {
// 			if (!puter.auth.isSignedIn()) {
// 				await puter.auth.signIn();
// 				return;
// 			}

// 			let wisp = await puter.net.generateWispV1URL();
// 			setWispUrl(wisp);
// 			console.log(wisp);
// 		}

// 		// let playwrightWindow = window.open(
// 		// 	"http://localhost:5013",
// 		// 	"playwright",
// 		// 	"width=400,height=300,left=100,top=100,resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no"
// 		// )!;
// 		// let server = startCDP((message: string) => {
// 		// 	playwrightWindow.postMessage(
// 		// 		{
// 		// 			type: "scramjet$playwrightcdp",
// 		// 			message: message,
// 		// 		},
// 		// 		"*"
// 		// 	);
// 		// });
// 		// window.addEventListener("message", (event: MessageEvent) => {
// 		// 	if (!event.data || !event.data.type) return;
// 		// 	if (event.data.type != "scramjet$playwrightcdp") return;

// 		// 	server.message(event.data.message);
// 		// });
// 		// window.addEventListener("beforeunload", () => {
// 		// 	playwrightWindow.close();
// 		// });
// 	} catch (e) {
// 		let err = e as any;
// 		app.replaceWith(
// 			document.createTextNode(
// 				`Error mounting: ${"message" in err ? err.message : err}`
// 			)
// 		);
// 		console.error(err);
// 	}
// }

// async function waitForControllerOrReady(timeoutMs = 10000): Promise<void> {
// 	if (navigator.serviceWorker.controller) return;

// 	const ready = navigator.serviceWorker.ready.then(() => {});
// 	const controllerChanged = new Promise<void>((resolve) => {
// 		const onChange = () => {
// 			navigator.serviceWorker.removeEventListener("controllerchange", onChange);
// 			resolve();
// 		};
// 		navigator.serviceWorker.addEventListener("controllerchange", onChange, {
// 			once: true,
// 		} as any);
// 	});
// 	const timeout = new Promise<void>((resolve) =>
// 		setTimeout(resolve, timeoutMs)
// 	);

// 	// Wait for whichever happens first; on timeout we continue to avoid blocking the UI.
// 	await Promise.race([ready, controllerChanged, timeout]);
// }

// mount();

// init();
// async function init() {
// 	const signin: any = <LoadInterstitial status={"Loading"}></LoadInterstitial>;
// 	document.body.append(signin);
// 	signin.showModal();

// 	try {
// 		scramjet.init();
// 		const registration = await navigator.serviceWorker.register("./sw.js");

// 		// If already controlled or active, don't block the UI.
// 		if (navigator.serviceWorker.controller || registration.active) {
// 			signin.$.state.status = "Service worker active";
// 			signin.close();
// 			return;
// 		}

// 		// Non-blocking progress updates on state transitions.
// 		const updateStatus = (sw: ServiceWorker | null) => {
// 			if (!sw) return;
// 			const set = (msg: string) => (signin.$.state.status = msg);
// 			const apply = () => {
// 				switch (sw.state) {
// 					case "installing":
// 						set("Installing service worker...");
// 						break;
// 					case "installed":
// 						set("Service worker installed, waiting to activate...");
// 						break;
// 					case "activating":
// 						set("Activating service worker...");
// 						break;
// 					case "activated":
// 						set("Service worker activated");
// 						break;
// 					case "redundant":
// 						set("Service worker became redundant");
// 						break;
// 				}
// 			};
// 			apply();
// 			sw.addEventListener("statechange", apply);
// 		};

// 		updateStatus(registration.installing ?? registration.waiting ?? null);

// 		// Wait for control or readiness with a timeout; don't hang the UI on updates.
// 		signin.$.state.status = "Waiting for service worker to take control...";
// 		await waitForControllerOrReady(10000);
// 		signin.$.state.status = "Service worker ready";
// 		signin.close();
// 	} catch (e) {
// 		console.error("Error during service worker registration:", e);
// 		// Always close the modal on error to prevent hanging UI.
// 		try {
// 			signin.close();
// 		} catch {}
// 		app.innerText =
// 			"Failed to register service worker. Check console for details.";
// 	}
// }

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

		return handleFetch.call(tgt as any, data, cfg, client.bare);
	},
};
console.log(
	rewriteUrl("https://example.com", { base: new URL("https://google.com") })
);
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
