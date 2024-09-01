import { rewriteJs } from "./js";

export type URLMeta = {
	origin: URL;
	base: URL;
};

function tryCanParseURL(url: string, origin?: string | URL): URL | null {
	try {
		return new URL(url, origin);
	} catch {
		return null;
	}
}

// something is broken with this but i didn't debug it
export function encodeUrl(url: string | URL, meta: URLMeta) {
	if (url instanceof URL) {
		url = url.href;
	}

	// if (!origin) {
	// 	if (location.pathname.startsWith(self.$scramjet.config.prefix + "worker")) {
	// 		origin = new URL(new URL(location.href).searchParams.get("origin"));
	// 	} else
	// 		origin = new URL(
	// 			self.$scramjet.codec.decode(
	// 				location.href.slice(
	// 					(location.origin + self.$scramjet.config.prefix).length
	// 				)
	// 			)
	// 		);
	// }

	if (url.startsWith("javascript:")) {
		return "javascript:" + rewriteJs(url.slice("javascript:".length), meta);
	} else if (/^(#|mailto|about|data|blob)/.test(url)) {
		// TODO this regex is jank but i'm not fixing it
		return url;
	} else {
		return (
			location.origin +
			self.$scramjet.config.prefix +
			self.$scramjet.codec.encode(new URL(url, meta.base).href)
		);
	}
}

// something is also broken with this but i didn't debug it
export function decodeUrl(url: string | URL) {
	if (url instanceof URL) {
		url = url.href;
	}

	if (
		tryCanParseURL(url)?.pathname.startsWith(
			self.$scramjet.config.prefix + "worker"
		)
	) {
		return new URL(new URL(url).searchParams.get("origin")).href;
	}

	if (/^(#|about|data|mailto|javascript)/.test(url)) {
		return url;
	} else if (tryCanParseURL(url)) {
		return self.$scramjet.codec.decode(
			url.slice((location.origin + self.$scramjet.config.prefix).length)
		);
	} else {
		return url;
	}
}
