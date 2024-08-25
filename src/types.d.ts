import { ScramjetController } from "./bootsrapper/index";
import { encodeUrl, decodeUrl } from "./shared/rewriters/url";
import { rewriteCss } from "./shared/rewriters/css";
import { htmlRules, rewriteHtml, rewriteSrcset } from "./shared/rewriters/html";
import { rewriteJs } from "./shared/rewriters/js";
import { rewriteHeaders } from "./shared/rewriters/headers";
import { rewriteWorkers } from "./shared/rewriters/worker";
import type { Codec } from "./codecs";
import { BareClient } from "@mercuryworkshop/bare-mux";
import { parseDomain } from "parse-domain";
import { ScramjetHeaders } from "./shared/headers";
import { CookieStore } from "./shared/cookie";

type ScramjetFlags = {
	serviceworkers: boolean;
};

interface ScramjetConfig {
	prefix: string;
	codec: string;
	wrapfn: string;
	trysetfn: string;
	importfn: string;
	rewritefn: string;
	metafn: string;
	wasm: string;
	shared: string;
	worker: string;
	thread: string;
	client: string;
	codecs: string;
	flags: ScramjetFlags;
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
	}
}
