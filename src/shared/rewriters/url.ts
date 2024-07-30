import { rewriteJs } from "./js";

function canParseUrl(url: string, origin?: URL) {
	try {
		new URL(url, origin);

		return true;
	} catch {
		return false;
	}
}

// something is broken with this but i didn't debug it
export function encodeUrl(url: string | URL, origin?: URL) {
	if (url instanceof URL) {
		url = url.href;
	}

	if (!origin) {
		if (location.pathname.startsWith(self.$scramjet.config.prefix + "worker")) {
			origin = new URL(new URL(location.href).searchParams.get("origin"));
		} else
			origin = new URL(
				self.$scramjet.config.codec.decode(
					location.href.slice(
						(location.origin + self.$scramjet.config.prefix).length
					)
				)
			);
	}

	// is this the correct behavior?
	if (!url) url = origin.href;

	if (url.startsWith("javascript:")) {
		return "javascript:" + rewriteJs(url.slice("javascript:".length), origin);
	} else if (/^(#|mailto|about|data|blob)/.test(url)) {
		return url;
	} else if (canParseUrl(url, origin)) {
		return (
			location.origin +
			self.$scramjet.config.prefix +
			self.$scramjet.config.codec.encode(new URL(url, origin).href)
		);
	}
}

// something is also broken with this but i didn't debug it
export function decodeUrl(url: string | URL) {
	if (url instanceof URL) {
		url = url.href;
	}

	if (
		URL.canParse(url) &&
		new URL(url).pathname.startsWith(self.$scramjet.config.prefix + "worker")
	) {
		return new URL(new URL(url).searchParams.get("origin"));
	}

	if (/^(#|about|data|mailto|javascript)/.test(url)) {
		return url;
	} else if (canParseUrl(url)) {
		return self.$scramjet.config.codec.decode(
			url.slice((location.origin + self.$scramjet.config.prefix).length)
		);
	} else {
		return url;
	}
}
