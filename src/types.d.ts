import { ScramjetController } from "./controller/index";
import {
	rewriteBlob,
	rewriteUrl,
	unrewriteBlob,
	unrewriteUrl,
} from "./shared/rewriters/url";
import { rewriteCss, unrewriteCss } from "./shared/rewriters/css";
import {
	htmlRules,
	rewriteHtml,
	rewriteSrcset,
	unrewriteHtml,
} from "./shared/rewriters/html";
import { rewriteJs } from "./shared/rewriters/js";
import { rewriteHeaders } from "./shared/rewriters/headers";
import { rewriteWorkers } from "./shared/rewriters/worker";
import { BareClient, BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { parseDomain } from "parse-domain";
import { ScramjetHeaders } from "./shared/headers";
import { CookieStore } from "./shared/cookie";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "./symbols";
import { ScramjetClient } from "./client/client";
import { ScramjetFrame } from "./controller/frame";
import { Rewriter } from "./shared/rewriters/wasm";

type ScramjetFlags = {
	serviceworkers: boolean;
	syncxhr: boolean;
	naiiveRewriter: boolean;
	strictRewrites: boolean;
	rewriterLogs: boolean;
	captureErrors: boolean;
	cleanErrors: boolean;
	scramitize: boolean;
	sourcemaps: boolean;
};

interface ScramjetConfig {
	prefix: string;
	globals: {
		wrapfn: string;
		wrapthisfn: string;
		trysetfn: string;
		importfn: string;
		rewritefn: string;
		metafn: string;
		setrealmfn: string;
		pushsourcemapfn: string;
	};
	files: {
		wasm: string;
		shared: string;
		worker: string;
		client: string;
		sync: string;
	};
	flags: ScramjetFlags;
	siteFlags: Record<string, Partial<ScramjetFlags>>;
	codec: {
		encode: string;
		decode: string;
	};
}

interface ScramjetInitConfig extends ScramjetConfig {
	codec: {
		encode: (url: string) => string;
		decode: (url: string) => string;
	};
}
declare global {
	interface Window {
		$scramjet: {
			shared: {
				url: {
					rewriteUrl: typeof rewriteUrl;
					unrewriteUrl: typeof unrewriteUrl;
					rewriteBlob: typeof rewriteBlob;
					unrewriteBlob: typeof unrewriteBlob;
				};
				rewrite: {
					rewriteCss: typeof rewriteCss;
					unrewriteCss: typeof unrewriteCss;
					rewriteHtml: typeof rewriteHtml;
					unrewriteHtml: typeof unrewriteHtml;
					rewriteSrcset: typeof rewriteSrcset;
					rewriteJs: typeof rewriteJs;
					rewriteHeaders: typeof rewriteHeaders;
					rewriteWorkers: typeof rewriteWorkers;
					htmlRules: typeof htmlRules;
				};
				util: {
					BareClient: typeof BareClient;
					BareMuxConnection: typeof BareMuxConnection;
					ScramjetHeaders: typeof ScramjetHeaders;
					parseDomain: typeof parseDomain;
				};
				CookieStore: typeof CookieStore;
				rewriter?: { rewriter: Rewriter; inUse: boolean }[];
			};
			config: ScramjetConfig;
			codec: {
				encode: (url: string) => string;
				decode: (url: string) => string;
			};
			version: {
				version: string;
				build: string;
			};
		};
		COOKIE: string;
		WASM: string;
		REAL_WASM: Uint8Array;
		ScramjetController: typeof ScramjetController;

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
