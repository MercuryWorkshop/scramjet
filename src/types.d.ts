import { ScramjetController } from "./controller/index";
import { encodeUrl, decodeUrl } from "./shared/rewriters/url";
import { rewriteCss } from "./shared/rewriters/css";
import {
	htmlRules,
	rewriteHtml,
	rewriteSrcset,
	unrewriteHtml,
} from "./shared/rewriters/html";
import { rewriteJs } from "./shared/rewriters/js";
import { rewriteHeaders } from "./shared/rewriters/headers";
import { rewriteWorkers } from "./shared/rewriters/worker";
import type { Codec } from "./codecs";
import { BareClient } from "@mercuryworkshop/bare-mux";
import { parseDomain } from "parse-domain";
import { ScramjetHeaders } from "./shared/headers";
import { CookieStore } from "./shared/cookie";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "./symbols";
import { ScramjetClient } from "./client/client";
import { ScramjetFrame } from "./controller/frame";

type ScramjetFlags = {
	serviceworkers: boolean;
	naiiverewriter: boolean;
};

interface ScramjetConfig {
	prefix: string;
	codec: string;
	wrapfn: string;
	trysetfn: string;
	importfn: string;
	rewritefn: string;
	metafn: string;
	setrealmfn: string;
	wasm: string;
	shared: string;
	worker: string;
	thread: string;
	client: string;
	codecs: string;
	flags: ScramjetFlags;
	siteflags?: Record<string, ScramjetFlags>;
}

declare global {
	interface Window {
		$scramjet: {
			shared: {
				url: {
					encodeUrl: typeof encodeUrl;
					decodeUrl: typeof decodeUrl;
				};
				rewrite: {
					rewriteCss: typeof rewriteCss;
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
					ScramjetHeaders: typeof ScramjetHeaders;
					parseDomain: typeof parseDomain;
				};
				CookieStore: typeof CookieStore;
			};
			config: ScramjetConfig;
			codecs: {
				none: Codec;
				plain: Codec;
				base64: Codec;
				xor: Codec;
			};
			codec: Codec;
		};
		COOKIE: string;
		WASM: string;
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
