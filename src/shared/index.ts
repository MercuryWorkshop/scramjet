import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteHtml, rewriteSrcset } from "./rewriters/html";
import { rewriteJs } from "./rewriters/js";
import { rewriteHeaders } from "./rewriters/headers";
import { rewriteWorkers } from "./rewriters/worker";
import { BareClient } from "@mercuryworkshop/bare-mux";
import { parseDomain } from "parse-domain";
import { ScramjetHeaders } from "./headers";
import { CookieStore } from "./cookie";
import { htmlRules, unrewriteHtml } from "./rewriters/html";

self.$scramjet.shared = {
	util: {
		parseDomain,
		BareClient,
		ScramjetHeaders,
	},
	url: {
		encodeUrl,
		decodeUrl,
	},
	rewrite: {
		rewriteCss,
		rewriteHtml,
		unrewriteHtml,
		rewriteSrcset,
		rewriteJs,
		rewriteHeaders,
		rewriteWorkers,
		htmlRules,
	},
	CookieStore,
};

if ("document" in self && document.currentScript) {
	document.currentScript.remove();
}
