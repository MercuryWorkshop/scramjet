import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteHtml, rewriteSrcset } from "./rewriters/html";
import { rewriteJs } from "./rewriters/js";
import { rewriteHeaders } from "./rewriters/headers";
import { rewriteWorkers } from "./rewriters/worker";
import { isScramjetFile } from "./rewriters/html";
import { BareClient } from "@mercuryworkshop/bare-mux";
import { parseDomain } from "parse-domain";

self.$scramjet.shared = {
	util: {
		isScramjetFile,
		parseDomain,
		BareClient,
	},
	url: {
		encodeUrl,
		decodeUrl,
	},
	rewrite: {
		rewriteCss,
		rewriteHtml,
		rewriteSrcset,
		rewriteJs,
		rewriteHeaders,
		rewriteWorkers,
	},
};
