// entrypoint for scramjet.client.js

import { ScramjetContext, ScramjetInterface } from "@/shared/index";
import { SCRAMJETCLIENT } from "@/symbols";
import { ScramjetClient } from "@client/index";
import { ScramjetContextEvent, UrlChangeEvent } from "@client/events";
import { ScramjetConfig } from "@/types";
import { BareTransport } from "@mercuryworkshop/bare-mux-custom";

export const iswindow = "window" in globalThis && window instanceof Window;
export const isworker = "WorkerGlobalScope" in globalThis;
export const issw = "ServiceWorkerGlobalScope" in globalThis;
export const isdedicated = "DedicatedWorkerGlobalScope" in globalThis;
export const isshared = "SharedWorkerGlobalScope" in globalThis;

function createFrameId() {
	return `${Array(8)
		.fill(0)
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")}`;
}

export type ScramjetClientInit = {
	context: ScramjetContext;
	transport: BareTransport;
	sendSetCookie: (url: URL, cookie: string) => Promise<void>;
	shouldPassthroughWebsocket?: (url: string | URL) => boolean;
	shouldBlockMessageEvent?: (ev: MessageEvent) => boolean;
};

export function loadAndHook(init: ScramjetClientInit) {
	dbg.log("initializing scramjet client");
	// if it already exists, that means the handlers have probably already been setup by the parent document
	if (!(SCRAMJETCLIENT in <Partial<typeof self>>globalThis)) {
		const client = new ScramjetClient(globalThis, init);

		const frame: HTMLIFrameElement =
			globalThis.frameElement as HTMLIFrameElement;
		if (frame && !frame.name) {
			// all frames need to be named for our logic to work
			frame.name = createFrameId();
		}

		client.hook();

		const contextev = new ScramjetContextEvent(client.global.window, client);
		client.frame?.dispatchEvent(contextev);
		const urlchangeev = new UrlChangeEvent(client.url.href);
		if (!client.isSubframe) client.frame?.dispatchEvent(urlchangeev);
	}
}
