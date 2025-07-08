// entrypoint for scramjet.client.js

import { loadCodecs } from "../scramjet";
import { SCRAMJETCLIENT } from "../symbols";
import { ScramjetClient } from "./client";
import { ScramjetContextEvent, UrlChangeEvent } from "./events";
import { ScramjetServiceWorkerRuntime } from "./swruntime";

export const iswindow = "window" in self && window instanceof Window;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;
export const isemulatedsw =
	new URL(self.location.href).searchParams.get("dest") === "serviceworker";

dbg.log("initializing scramjet client");
// if it already exists, that means the handlers have probably already been setup by the parent document
if (!(SCRAMJETCLIENT in <Partial<typeof self>>self)) {
	loadCodecs();

	const client = new ScramjetClient(self);

	if (self.COOKIE) client.loadcookies(self.COOKIE);

	client.hook();

	if (isemulatedsw) {
		const runtime = new ScramjetServiceWorkerRuntime(client);
		runtime.hook();
	}

	const contextev = new ScramjetContextEvent(client.global.window);
	client.frame?.dispatchEvent(contextev);
	const urlchangeev = new UrlChangeEvent(client.url.href);
	if (!client.isSubframe) client.frame?.dispatchEvent(urlchangeev);
}

Reflect.deleteProperty(self, "WASM");
Reflect.deleteProperty(self, "COOKIE");
if ("document" in self && document?.currentScript) {
	document.currentScript.remove();
}
