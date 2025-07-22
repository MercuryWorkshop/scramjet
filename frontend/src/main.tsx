import "./style.css";

// temp fix for vite not working
import.meta.hot?.accept(() => location.reload());

import { createBrowser } from "./browser";
import { createMenu } from "./components/Menu";
let app = document.getElementById("app")!;
import { BareMuxConnection, BareClient } from "@mercuryworkshop/bare-mux";

let connection = new BareMuxConnection("/baremux/worker.js");
connection.setTransport("/epoxy/index.mjs", [{ wisp: "wss://anura.pro" }]);
export let client = new BareClient();

const { ScramjetController } = $scramjetLoadController();
export const scramjet = new ScramjetController({
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

scramjet.init();
navigator.serviceWorker.register("./sw.js");

export let browser = createBrowser();
(self as any).browser = browser;

try {
	let built = browser.build();
	built.id = "app";

	app.replaceWith(built);
	built.addEventListener("contextmenu", (e) => {
		e.preventDefault();
	});
} catch (e) {
	let err = e as any;
	app.replaceWith(
		document.createTextNode(
			`Error mounting: ${"message" in err ? err.message : err}`
		)
	);
	console.error(err);
}
