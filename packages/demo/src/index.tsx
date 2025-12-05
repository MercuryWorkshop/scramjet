import { css } from "dreamland/core";
import { App } from "./App";
import LibcurlClient from "@mercuryworkshop/libcurl-transport";

const transport = new LibcurlClient({
	wisp: import.meta.env.VITE_WISP_URL,
});

let app = document.getElementById("app")!;

export function LoadInterstitial() {
	return (
		<dialog class="signin">
			<h1>Loading</h1>
			<p>{use(this.status)}</p>
		</dialog>
	);
}
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

const { Controller } = $scramjetController;
export let controller;

async function init() {
	const interstitial: any = (
		<LoadInterstitial status={"Loading"}></LoadInterstitial>
	);
	document.body.append(interstitial);
	interstitial.showModal();

	try {
		const registration = await navigator.serviceWorker.register("./sw.js");

		// If already controlled or active, don't block the UI.
		if (navigator.serviceWorker.controller || registration.active) {
			interstitial.$.state.status = "Service worker active";
			controller = new Controller({
				serviceworker: registration.active,
				transport,
			});
			await controller.ready;
			console.log(controller);
			interstitial.close();
			return;
		}

		// Non-blocking progress updates on state transitions.
		const updateStatus = (sw: ServiceWorker | null) => {
			if (!sw) return;
			const set = (msg: string) => (interstitial.$.state.status = msg);
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
		interstitial.$.state.status =
			"Waiting for service worker to take control...";
		await waitForControllerOrReady(10000);
		interstitial.$.state.status =
			"Service worker ready, waiting for controller init";
		controller = new Controller({
			serviceworker: registration.active,
			transport,
		});
		await controller.ready;
		console.log(controller);
		interstitial.$.state.status = "Controller initialized";
		interstitial.close();
	} catch (e) {
		console.error("Error during service worker registration:", e);
		// Always close the modal on error to prevent hanging UI.
		try {
			interstitial.close();
		} catch {}
		app.innerText =
			"Failed to register service worker. Check console for details.";
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

async function mount() {
	try {
		const root = <App></App>;
		app.replaceWith(root);
	} catch (e) {
		let err = e as any;
		app.replaceWith(
			document.createTextNode(
				`Error mounting: ${"message" in err ? err.message : err}`
			)
		);
		console.error(err);
		throw e;
	}
}

init().then(() => mount());
