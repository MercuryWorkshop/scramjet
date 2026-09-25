// NOTE: this is the entrypoint for scramjet.bundle.js
// as such it exports everything in scramjet
// the entry point for scramjet.all.js (what most sites wil use) is entry.ts

import "./global.d";
import { atob, _Uint8Array } from "@/shared/snapshot";
import { setWasm } from "@rewriters/wasm";
import { pstAvailable } from "@/shared/incumbency";
import { ScramjetVersionInfo, ScramjetConfig } from "./types";

declare const VERSION: string;
declare const COMMITHASH: string;
declare const BUILDDATE: string;
export const versionInfo: ScramjetVersionInfo = {
	version: VERSION,
	build: COMMITHASH,
	date: BUILDDATE,
};

export const defaultConfig: ScramjetConfig = {
	globals: {
		wrapfn: "$scramjet$wrap",
		wrappropertybase: "$scramjet__",
		wrappropertyfn: "$scramjet$prop",
		callfn: "$scramjet$call",
		cleanrestfn: "$scramjet$clean",
		importfn: "$scramjet$import",
		rewritefn: "$scramjet$rewrite",
		metafn: "$scramjet$meta",
		pushsourcemapfn: "$scramjet$pushsourcemap",
		registerrealmfn: "$scramjet$registerrealm",
		trysetfn: "$scramjet$tryset",
		templocid: "$scramjet$temploc",
		tempreceiverid: "$scramjet$tempreceiver",
		tempcalleeid: "$scramjet$tempcallee",
		tempunusedid: "$scramjet$tempunused",
	},
	flags: {
		syncxhr: false,
		disableComputedWrap: false,
		rewriterLogs: false,
		captureErrors: false,
		cleanErrors: true,
		sourcemaps: true,
		destructureRewrites: true,
		allowInvalidJs: true,
		debugTrampolines: false,
		encapsulateWorkers: true,
		debugSourceURL: false,
		incumbency: pstAvailable ? "pst" : "lazystamp",
	},
	maskedfiles: [],
};

export const defaultConfigDev: ScramjetConfig = {
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
	setWasm(_Uint8Array.from(atob(REWRITERWASM), (c) => c.charCodeAt(0)));
}

export * from "./symbols";
export * from "./types";
export * from "./Tap";
export * from "./shared";
export * from "./fetch";
export * from "./client";
