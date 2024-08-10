// entrypoint for scramjet.client.js

import { ScramjetClient } from "./client";
import { ScramjetServiceWorkerRuntime } from "./swruntime";

export const iswindow = "window" in self;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;
export const isemulatedsw =
	new URL(self.location.href).searchParams.get("dest") === "serviceworker";

dbg.log("scrammin");
// if it already exists, that means the handlers have probably already been setup by the parent document
if (!(ScramjetClient.SCRAMJET in self)) {
	const client = new ScramjetClient(self);

	client.loadcookies(self.COOKIE);
	delete self.COOKIE;

	client.hook();

	if (isemulatedsw) {
		const runtime = new ScramjetServiceWorkerRuntime(client);
		runtime.hook();
	}
}

if ("document" in self && document.currentScript) {
	document.currentScript.remove();
}
