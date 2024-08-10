export const {
	util: { isScramjetFile, BareClient },
	url: { encodeUrl, decodeUrl },
	rewrite: {
		rewriteCss,
		rewriteHtml,
		rewriteSrcset,
		rewriteJs,
		rewriteHeaders,
		rewriteWorkers,
	},
	CookieStore,
} = self.$scramjet.shared;

export const config = self.$scramjet.config;
