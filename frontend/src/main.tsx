import "./style.css";

import { createBrowser } from "./browser";
import { createMenu } from "./Menu";
let app = document.getElementById("app")!;
import { BareMuxConnection, BareClient } from "@mercuryworkshop/bare-mux";

let connection = new BareMuxConnection("/baremux/worker.js");
connection.setTransport("/epoxy/index.mjs", [{ wisp: "wss://anura.pro" }]);
export let client = new BareClient();

export const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		worker: "/scram/scramjet.worker.js",
		client: "/scram/scramjet.client.js",
		shared: "/scram/scramjet.shared.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		naiiveRewriter: false,
	},
	siteFlags: {
		"https://www.google.com/.*": {
			naiiveRewriter: true,
		},
		"https://worker-playground.glitch.me/.*": {
			serviceworkers: true,
		},
	},
});

scramjet.init();
navigator.serviceWorker.register("./sw.js");

let browser = createBrowser();
(self as any).browser = browser;

try {
	let built = browser.build();
	built.id = "app";
	built.addEventListener("contextmenu", (e) => {
		createMenu(e.x, e.y, [
			{
				label: "Reload",
			},
		]);
		e.preventDefault();
	});

	app.replaceWith(built);
} catch (e) {
	let err = e as any;
	app.replaceWith(
		document.createTextNode(
			`Error mounting: ${"message" in err ? err.message : err}`
		)
	);
}
