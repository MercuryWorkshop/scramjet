import { $scramjet } from "./scramjet";

export const {
	util: { BareClient, ScramjetHeaders, BareMuxConnection },
	url: { rewriteUrl, unrewriteUrl, rewriteBlob, unrewriteBlob },
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
} = $scramjet.shared;

export const config = $scramjet.config;
