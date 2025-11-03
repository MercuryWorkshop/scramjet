// entrypoint for scramjet.client.js

import {
	ClientRPCDefs,
	ScramjetContext,
	ScramjetInterface,
	setBareTransport,
	setConfig,
} from "@/shared/index";
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

export type ScramjetClientEntryInit = {
	config: ScramjetConfig;
	context: ScramjetContext;
	rpc: ClientRPCDefs;
	transport: BareTransport;
	cookies: string;
};

export function loadAndHook(init: ScramjetClientEntryInit) {
	setConfig(init.config);
	setBareTransport(init.transport);

	dbg.log("initializing scramjet client");
	// if it already exists, that means the handlers have probably already been setup by the parent document
	if (!(SCRAMJETCLIENT in <Partial<typeof self>>globalThis)) {
		const client = new ScramjetClient(globalThis);
		client.context = init.context;
		client.rpc = init.rpc;

		const frame: HTMLIFrameElement =
			globalThis.frameElement as HTMLIFrameElement;
		if (frame && !frame.name) {
			// all frames need to be named for our logic to work
			frame.name = createFrameId();
		}

		client.loadcookies(init.cookies);

		client.hook();

		const contextev = new ScramjetContextEvent(client.global.window, client);
		client.frame?.dispatchEvent(contextev);
		const urlchangeev = new UrlChangeEvent(client.url.href);
		if (!client.isSubframe) client.frame?.dispatchEvent(urlchangeev);
	}
}
