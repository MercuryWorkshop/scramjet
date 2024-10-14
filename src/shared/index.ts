import {
	rewriteUrl,
	unrewriteUrl,
	rewriteBlob,
	unrewriteBlob,
} from "./rewriters/url";
import { rewriteCss, unrewriteCss } from "./rewriters/css";
import { rewriteHtml, rewriteSrcset } from "./rewriters/html";
import { rewriteJs } from "./rewriters/js";
import { rewriteHeaders } from "./rewriters/headers";
import { rewriteWorkers } from "./rewriters/worker";
import { BareClient, BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { parseDomain } from "parse-domain";
import { ScramjetHeaders } from "./headers";
import { CookieStore } from "./cookie";
import { htmlRules, unrewriteHtml } from "./rewriters/html";
import { $scramjet } from "../scramjet";

$scramjet.shared = {
	util: {
		parseDomain,
		BareClient,
		BareMuxConnection,
		ScramjetHeaders,
	},
	url: {
		rewriteUrl,
		unrewriteUrl,
		rewriteBlob,
		unrewriteBlob,
	},
	rewrite: {
		rewriteCss,
		unrewriteCss,
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

if ("document" in self && document?.currentScript) {
	document.currentScript.remove();
}
