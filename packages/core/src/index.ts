// NOTE: this is the entrypoint for scramjet.bundle.js
// as such it exports everything in scramjet
// the entry point for scramjet.all.js (what most sites wil use) is entry.ts

import "./global.d";
import { atob } from "@/shared/snapshot";
import { setWasm } from "@rewriters/wasm";
import { AkVersionInfo, AkConfig } from "./types";

declare const VERSION: string;
declare const COMMITHASH: string;
declare const BUILDDATE: string;
export const versionInfo: AkVersionInfo = {
	version: VERSION,
	build: COMMITHASH,
	date: BUILDDATE,
};

export const defaultConfig: AkConfig = {
	globals: {
		wrapfn: "$ak$wrap",
		wrappropertybase: "$ak__",
		wrappropertyfn: "$ak$prop",
		cleanrestfn: "$ak$clean",
		importfn: "$ak$import",
		rewritefn: "$ak$rewrite",
		metafn: "$ak$meta",
		wrappostmessagefn: "$ak$wrappostmessage",
		pushsourcemapfn: "$ak$pushsourcemap",
		trysetfn: "$ak$tryset",
		templocid: "$ak$temploc",
		tempunusedid: "$ak$tempunused",
	},
	flags: {
		syncxhr: false,
		disableComputedWrap: false,
		rewriterLogs: false,
		captureErrors: false,
		cleanErrors: false,
		scramitize: false,
		sourcemaps: true,
		destructureRewrites: true,
		allowInvalidJs: true,
		debugTrampolines: false,
		allowFailedIntercepts: false,
		encapsulateWorkers: true,
		debugSourceURL: false,
	},
	siteFlags: {},
	maskedfiles: [],
};

export const defaultConfigDev: AkConfig = {
	...defaultConfig,
	flags: {
		...defaultConfig.flags,
		rewriterLogs: false,
		captureErrors: true,
		cleanErrors: false,
		debugTrampolines: true,
		debugSourceURL: true,
		allowInvalidJs: false,
	},
};

declare const REWRITERWASM: string | undefined;
// bundled build will have the wasm binary inlined as a base64 string
if (REWRITERWASM) {
	setWasm(Uint8Array.from(atob(REWRITERWASM), (c) => c.charCodeAt(0)));
}

export * from "./symbols";
export * from "./types";
export * from "./Tap";
export * from "./shared";
export * from "./fetch";
export { BareResponse } from "@mercuryworkshop/proxy-transports";
export * from "./client";
