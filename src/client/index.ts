// entrypoint for scramjet.client.js

import { ScramjetClient } from "./client";

export const iswindow = "window" in self;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;

export const wrapfn = "$scramjet$wrap";
export const trysetfn = "$scramjet$tryset";
export const importfn = "$scramjet$import";

dbg.log("scrammin");
// if it already exists, that means the handlers have probably already been setup by the parent document
if (!(ScramjetClient.SCRAMJET in self)) {
	const client = new ScramjetClient(self);
	client.hook();
}
