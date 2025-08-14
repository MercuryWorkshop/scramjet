import { ScramjetClient } from "@client/index";
import { ScramjetController } from "@/controller";
import { ScramjetFrame } from "@/controller/frame";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "@/symbols";

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

export interface ScramjetInitConfig
	extends Omit<ScramjetConfig, "codec" | "flags"> {
	flags: Partial<ScramjetFlags>;
	codec: {
		encode: (url: string) => string;
		decode: (url: string) => string;
	};
}
declare global {
	interface Window {
		COOKIE: string;
		WASM: string;
		REAL_WASM: Uint8Array;

		// the scramjet client belonging to a window
		[SCRAMJETCLIENT]: ScramjetClient;
	}

	interface HTMLDocument {
		// should be the same as window
		[SCRAMJETCLIENT]: ScramjetClient;
	}

	interface HTMLIFrameElement {
		// the event target belonging to an <iframe> holding a /prefix/blah url
		[SCRAMJETFRAME]: ScramjetFrame;
	}
}
