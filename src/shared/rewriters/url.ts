import { $scramjet } from "../../scramjet";
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

export function rewriteBlob(url: string, meta: URLMeta) {
	const blob = new URL(url.substring("blob:".length));

	return "blob:" + meta.origin.origin + blob.pathname;
}

export function unrewriteBlob(url: string) {
	const blob = new URL(url.substring("blob:".length));

	return "blob:" + location.origin + blob.pathname;
}

export function rewriteUrl(url: string | URL, meta: URLMeta) {
	if (url instanceof URL) url = url.toString();

	if (url.startsWith("javascript:")) {
		return (
			"javascript:" +
			rewriteJs(url.slice("javascript:".length), "(javascript: url)", meta)
		);
	} else if (url.startsWith("blob:")) {
		return location.origin + $scramjet.config.prefix + url;
	} else if (url.startsWith("data:")) {
		return location.origin + $scramjet.config.prefix + url;
	} else if (url.startsWith("mailto:") || url.startsWith("about:")) {
		return url;
	} else {
		let base = meta.base.href;

		if (base.startsWith("about:")) base = unrewriteUrl(self.location.href); // jank!!!!! weird jank!!!
		const realUrl = tryCanParseURL(url, base);
		if (!realUrl) return url;

		return (
			location.origin +
			$scramjet.config.prefix +
			$scramjet.codec.encode(realUrl.href)
		);
	}
}

export function unrewriteUrl(url: string | URL) {
	if (url instanceof URL) url = url.toString();

	const prefixed = location.origin + $scramjet.config.prefix;

	if (url.startsWith("javascript:")) {
		//TODO
		return url;
	} else if (url.startsWith("blob:")) {
		// realistically this shouldn't happen
		return url;
	} else if (url.startsWith(prefixed + "blob:")) {
		return url.substring(prefixed.length);
	} else if (url.startsWith(prefixed + "data:")) {
		return url.substring(prefixed.length);
	} else if (url.startsWith("mailto:") || url.startsWith("about:")) {
		return url;
	} else if (tryCanParseURL(url)) {
		return $scramjet.codec.decode(
			url.slice((location.origin + $scramjet.config.prefix).length)
		);
	} else {
		return url;
	}
}
