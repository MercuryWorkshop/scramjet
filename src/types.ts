import { ScramjetClient } from "@client/index";
import { ScramjetFrame } from "@/controller/frame";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "@/symbols";
import * as controller from "@/controller/index";
import * as client from "@/client/entry";
import * as worker from "@/worker/index";
import { ScramjetVersionInfo } from "./entry";

/**
 * Scramjet Feature Flags, configured at build time
 */
export type ScramjetFlags = {
	serviceworkers: boolean;
	syncxhr: boolean;
	strictRewrites: boolean;
	rewriterLogs: boolean;
	captureErrors: boolean;
	cleanErrors: boolean;
	scramitize: boolean;
	sourcemaps: boolean;
	destructureRewrites: boolean;
	interceptDownloads: boolean;
	allowInvalidJs: boolean;
	allowFailedIntercepts: boolean;
};

export interface ScramjetConfig {
	prefix: string;
	globals: {
		wrapfn: string;
		wrappropertybase: string;
		wrappropertyfn: string;
		cleanrestfn: string;
		importfn: string;
		rewritefn: string;
		metafn: string;
		setrealmfn: string;
		pushsourcemapfn: string;
		trysetfn: string;
		templocid: string;
		tempunusedid: string;
	};
	files: {
		wasm: string;
		all: string;
		sync: string;
	};
	flags: ScramjetFlags;
	siteFlags: Record<string, Partial<ScramjetFlags>>;
	codec: {
		encode: string;
		decode: string;
	};
}

/**
 * The config for Scramjet initialization.
 */
export interface ScramjetInitConfig
	extends Omit<ScramjetConfig, "codec" | "flags"> {
	flags: Partial<ScramjetFlags>;
	codec: {
		encode: (url: string) => string;
		decode: (url: string) => string;
	};
}
declare global {
	var $scramjetLoadController: () => typeof controller;
	var $scramjetLoadClient: () => typeof client;
	var $scramjetLoadWorker: () => typeof worker;
	var $scramjetVersion: ScramjetVersionInfo;
	interface Window {
		COOKIE: string;
		WASM: string;
		REAL_WASM: Uint8Array;

		/**
		 * The scramjet client belonging to a window.
		 */
		[SCRAMJETCLIENT]: ScramjetClient;
	}

	interface HTMLDocument {
		/**
		 * Should be the same as window.
		 */
		[SCRAMJETCLIENT]: ScramjetClient;
	}

	interface HTMLIFrameElement {
		/**
		 * The event target belonging to an iframe element holding an encoded URL.
		 */
		[SCRAMJETFRAME]: ScramjetFrame;
	}
}
