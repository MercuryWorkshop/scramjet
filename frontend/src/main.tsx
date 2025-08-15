import "./reset.css";
import "./style.css";

// temp fix for vite not working
import.meta.hot?.accept(() => location.reload());

import { Browser, initBrowser } from "./Browser";
import { createMenu } from "./components/Menu";
let app = document.getElementById("app")!;
import { Shell } from "./components/Shell";
import { App } from "./App";
import { startCDP } from "./CDP";
import { css, type Component } from "dreamland/core";

const { ScramjetController } = $scramjetLoadController();

const scramjetcfg = {
	wisp: "ws://localhost:1337/",
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		captureErrors: false,
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
let signedinr: any;
let signedin = new Promise((resolve) => (signedinr = resolve));
export const LoadInterstitial: Component<{ status: string }, {}> = function (
	cx
) {
	function handleModalClose(modal: any) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 250);
	}
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
				await signedin;
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

mount();

init();
async function init() {
	const signin: any = <LoadInterstitial status={"Loading"}></LoadInterstitial>;
	document.body.append(signin);
	signin.showModal();

	try {
		scramjet.init();
		let registration = await navigator.serviceWorker.register("./sw.js");

		if (registration.installing) {
			signin.$.state.status = "Installing service worker...";
			await waitForStateChange(registration.installing, "installed");
		}

		if (registration.waiting) {
			signin.$.state.status = "Service worker installed, activating...";
			await waitForStateChange(registration.waiting, "activated");
		}

		if (registration.active) {
			signin.$.state.status = "Service worker activated";
			signin.close();
		}
	} catch (e) {
		console.error("Error during service worker registration:", e);
		app.innerText =
			"Failed to register service worker. Check console for details.";
	}
}
