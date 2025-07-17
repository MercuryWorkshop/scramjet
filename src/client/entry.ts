// entrypoint for scramjet.client.js

import { loadCodecs, setConfig } from "@/shared/index";
import { SCRAMJETCLIENT } from "@/symbols";
import { ScramjetClient } from "@client/index";
import { ScramjetContextEvent, UrlChangeEvent } from "@client/events";
import { ScramjetServiceWorkerRuntime } from "@client/swruntime";

export const iswindow = "window" in self && window instanceof Window;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;
export const isemulatedsw =
	new URL(self.location.href).searchParams.get("dest") === "serviceworker";

function createFrameId() {
	return `${Array(8)
		.fill(0)
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")}`;
}

export function clientInitHook(config: ScramjetConfig) {
	setConfig(config);
	dbg.log("initializing scramjet client");
	// if it already exists, that means the handlers have probably already been setup by the parent document
	if (!(SCRAMJETCLIENT in <Partial<typeof self>>self)) {
		loadCodecs();

		const client = new ScramjetClient(self);
		const frame: HTMLIFrameElement = self.frameElement as HTMLIFrameElement;
		if (frame && !frame.name) {
			// all frames need to be named for our logic to work
			frame.name = createFrameId();
		}

		if (self.COOKIE) client.loadcookies(self.COOKIE);

		client.hook();

		if (isemulatedsw) {
			const runtime = new ScramjetServiceWorkerRuntime(client);
			runtime.hook();
		}

		const contextev = new ScramjetContextEvent(client.global.window, client);
		client.frame?.dispatchEvent(contextev);
		const urlchangeev = new UrlChangeEvent(client.url.href);
		if (!client.isSubframe) client.frame?.dispatchEvent(urlchangeev);
	}

	Reflect.deleteProperty(self, "WASM");
	Reflect.deleteProperty(self, "COOKIE");
}
