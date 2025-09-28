import "./reset.css";
import "./style.css";

// temp fix for vite not working
import.meta.hot?.accept(() => location.reload());

import { initBrowser } from "./Browser";
let app = document.getElementById("app")!;
import { Shell } from "./components/Shell";
import { App } from "./App";
import { css, type Component } from "dreamland/core";

const { ScramjetController } = $scramjetLoadController();
import { type ScramjetInitConfig } from "@mercuryworkshop/scramjet";

export const isPuter = !import.meta.env.VITE_LOCAL && puter.env == "app";

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

export function setWispUrl(wispurl: string) {
	scramjetcfg.wisp = wispurl;
	scramjet.modifyConfig(scramjetcfg);
}
export const LoadInterstitial: Component<{ status: string }, {}> = function () {
	return (
		<dialog class="signin">
			<h1>Loading</h1>
			<p>{use(this.status)}</p>
		</dialog>
	);
};
LoadInterstitial.style = css`
	:scope {
		transition: opacity 0.4s ease;
		width: 50%;
		height: 20%;
		border: none;
		border-radius: 1em;
		text-align: center;
	}
	h1 {
		text-align: center;
		font-weight: bold;
		font-size: 2em;
	}
	:modal[open] {
		animation: fade 0.4s ease normal;
	}

	:modal::backdrop {
		backdrop-filter: blur(3px);
	}
`;

let swReadyResolve: () => void;
export const serviceWorkerReady = new Promise<void>(
	(resolve) => (swReadyResolve = resolve)
);

async function mount() {
	try {
		let shell = <Shell></Shell>;
		await initBrowser();

		let built = <App>{shell}</App>;
		app.replaceWith(built);
		built.addEventListener("contextmenu", (e) => {
			e.preventDefault();
		});

		if (!import.meta.env.VITE_LOCAL) {
			if (!puter.auth.isSignedIn()) {
				await puter.auth.signIn();
				return;
			}

			let wisp = await puter.net.generateWispV1URL();
			setWispUrl(wisp);
			console.log(wisp);
		}

		// let playwrightWindow = window.open(
		// 	"http://localhost:5013",
		// 	"playwright",
		// 	"width=400,height=300,left=100,top=100,resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no"
		// )!;
		// let server = startCDP((message: string) => {
		// 	playwrightWindow.postMessage(
		// 		{
		// 			type: "scramjet$playwrightcdp",
		// 			message: message,
		// 		},
		// 		"*"
		// 	);
		// });
		// window.addEventListener("message", (event: MessageEvent) => {
		// 	if (!event.data || !event.data.type) return;
		// 	if (event.data.type != "scramjet$playwrightcdp") return;

		// 	server.message(event.data.message);
		// });
		// window.addEventListener("beforeunload", () => {
		// 	playwrightWindow.close();
		// });
	} catch (e) {
		let err = e as any;
		app.replaceWith(
			document.createTextNode(
				`Error mounting: ${"message" in err ? err.message : err}`
			)
		);
		console.error(err);
	}
}

async function waitForControllerOrReady(timeoutMs = 10000): Promise<void> {
	if (navigator.serviceWorker.controller) return;

	const ready = navigator.serviceWorker.ready.then(() => {});
	const controllerChanged = new Promise<void>((resolve) => {
		const onChange = () => {
			navigator.serviceWorker.removeEventListener("controllerchange", onChange);
			resolve();
		};
		navigator.serviceWorker.addEventListener("controllerchange", onChange, {
			once: true,
		} as any);
	});
	const timeout = new Promise<void>((resolve) =>
		setTimeout(resolve, timeoutMs)
	);

	// Wait for whichever happens first; on timeout we continue to avoid blocking the UI.
	await Promise.race([ready, controllerChanged, timeout]);
}

mount();

init();
async function init() {
	const signin: any = <LoadInterstitial status={"Loading"}></LoadInterstitial>;
	document.body.append(signin);
	signin.showModal();

	try {
		scramjet.init();
		const registration = await navigator.serviceWorker.register("./sw.js");

		// If already controlled or active, don't block the UI.
		if (navigator.serviceWorker.controller || registration.active) {
			signin.$.state.status = "Service worker active";
			signin.close();
			return;
		}

		// Non-blocking progress updates on state transitions.
		const updateStatus = (sw: ServiceWorker | null) => {
			if (!sw) return;
			const set = (msg: string) => (signin.$.state.status = msg);
			const apply = () => {
				switch (sw.state) {
					case "installing":
						set("Installing service worker...");
						break;
					case "installed":
						set("Service worker installed, waiting to activate...");
						break;
					case "activating":
						set("Activating service worker...");
						break;
					case "activated":
						set("Service worker activated");
						break;
					case "redundant":
						set("Service worker became redundant");
						break;
				}
			};
			apply();
			sw.addEventListener("statechange", apply);
		};

		updateStatus(registration.installing ?? registration.waiting ?? null);

		// Wait for control or readiness with a timeout; don't hang the UI on updates.
		signin.$.state.status = "Waiting for service worker to take control...";
		await waitForControllerOrReady(10000);
		signin.$.state.status = "Service worker ready";
		signin.close();
		swReadyResolve();
	} catch (e) {
		console.error("Error during service worker registration:", e);
		// Always close the modal on error to prevent hanging UI.
		try {
			signin.close();
		} catch {}
		app.innerText =
			"Failed to register service worker. Check console for details.";
	}
}
