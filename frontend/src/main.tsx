import "./style.css";

// temp fix for vite not working
import.meta.hot?.accept(() => location.reload());

import { Browser } from "./Browser";
import { createMenu } from "./components/Menu";
let app = document.getElementById("app")!;
import { BareMuxConnection, BareClient } from "@mercuryworkshop/bare-mux";
import { Shell } from "./components/Shell";
import { App } from "./App";

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

export let browser: Browser;

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
} catch (e) {
	let err = e as any;
	app.replaceWith(
		document.createTextNode(
			`Error mounting: ${"message" in err ? err.message : err}`
		)
	);
	console.error(err);
}
