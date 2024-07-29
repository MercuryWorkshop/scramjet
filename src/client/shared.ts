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
} = self.$scramjet.shared;

export const config = self.$scramjet.config;
