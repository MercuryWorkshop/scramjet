import "./style.css";

// temp fix for vite not working
import.meta.hot?.accept(() => location.reload());

import { Browser } from "./Browser";
import { createMenu } from "./components/Menu";
let app = document.getElementById("app")!;
import { Shell } from "./components/Shell";
import { App } from "./App";
import { startCDP } from "./CDP";

const { ScramjetController } = $scramjetLoadController();
export const scramjet = new ScramjetController({
	wisp: "ws://localhost:1337/",
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		captureErrors: false,
		naiiveRewriter: false,
	},
	siteFlags: {
		"https://www.google.com/(search|sorry).*": {
			naiiveRewriter: true,
		},
		"https://worker-playground.glitch.me/.*": {
			serviceworkers: true,
		},
	},
});

export let browser: Browser;

function mount() {
	try {
		let shell = <Shell></Shell>;
		browser = new Browser();
		let de = localStorage["browserstate"];
		if (de) {
			browser.deserialize(JSON.parse(de));
		} else {
			let tab = browser.newTab();
			browser.activetab = tab;
		}

		(self as any).browser = browser;
		let built = <App>{shell}</App>;
		app.replaceWith(built);
		built.addEventListener("contextmenu", (e) => {
			e.preventDefault();
		});

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

function waitForStateChange(worker: ServiceWorker, targetState: string) {
	return new Promise<void>((resolve) => {
		if (worker.state === targetState) {
			resolve();
			return;
		}

		worker.addEventListener("statechange", function listener() {
			if (worker.state === targetState) {
				worker.removeEventListener("statechange", listener);
				resolve();
			}
		});
	});
}
async function init() {
	try {
		scramjet.init();
		let registration = await navigator.serviceWorker.register("./sw.js");

		if (registration.installing) {
			app.innerText = "Installing service worker...";
			await waitForStateChange(registration.installing, "installed");
		}

		if (registration.waiting) {
			app.innerText = "Service worker installed, activating...";
			await waitForStateChange(registration.waiting, "activated");
		}

		if (registration.active) {
			app.innerText = "Service worker activated, mounting app...";
			mount();
		}
	} catch (e) {
		console.error("Error during service worker registration:", e);
		app.innerText =
			"Failed to register service worker. Check console for details.";
	}
}
init();
