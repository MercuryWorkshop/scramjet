import { config, ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";

export type URLMeta = {
	origin: URL;
	base: URL;
	topFrameName?: string;
	parentFrameName?: string;
};

function tryCanParseURL(url: string, origin?: string | URL): URL | null {
	try {
		return new URL(url, origin);
	} catch {
		return null;
	}
}

export function rewriteBlob(
	url: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const blob = new URL(url.substring("blob:".length));

	return "blob:" + meta.origin.origin + blob.pathname;
}

export function unrewriteBlob(
	url: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const blob = new URL(url.substring("blob:".length));

	return "blob:" + context.prefix.origin + blob.pathname;
}

export function rewriteUrl(
	url: string | URL,
	context: ScramjetContext,
	meta: URLMeta
) {
	if (url instanceof URL) url = url.toString();

	if (url.startsWith("javascript:")) {
		return (
			"javascript:" +
			rewriteJs(
				url.slice("javascript:".length),
				"(javascript: url)",
				context,
				meta
			)
		);
	} else if (url.startsWith("blob:")) {
		return context.prefix.href + url;
	} else if (url.startsWith("data:")) {
		return context.prefix.href + url;
	} else if (url.startsWith("mailto:") || url.startsWith("about:")) {
		return url;
	} else {
		let base = meta.base.href;

		if (base.startsWith("about:"))
			base = unrewriteUrl(self.location.href, context); // jank!!!!! weird jank!!!
		const realUrl = tryCanParseURL(url, base);
		if (!realUrl) return url;
		const encodedHash = context.interface.codecEncode(realUrl.hash.slice(1));
		const realHash = encodedHash ? "#" + encodedHash : "";
		realUrl.hash = "";

		return (
			context.prefix.href +
			context.interface.codecEncode(realUrl.href) +
			realHash
		);
	}
}

export function unrewriteUrl(url: string | URL, context: ScramjetContext) {
	if (url instanceof URL) url = url.toString();
	// remove query string
	// if (url.includes("?")) {
	// 	url = url.split("?")[0];
	// }

	if (url.startsWith("javascript:")) {
		//TODO
		return url;
	} else if (url.startsWith("blob:")) {
		// realistically this shouldn't happen
		return url;
	} else if (url.startsWith(context.prefix.href + "blob:")) {
		return url.substring(context.prefix.href.length);
	} else if (url.startsWith(context.prefix.href + "data:")) {
		return url.substring(context.prefix.href.length);
	} else if (url.startsWith("mailto:") || url.startsWith("about:")) {
		return url;
	} else {
		const realUrl = tryCanParseURL(url);
		if (!realUrl) return url;
		const decodedHash = context.interface.codecDecode(realUrl.hash.slice(1));
		const realHash = decodedHash ? "#" + decodedHash : "";
		realUrl.hash = "";

		return context.interface.codecDecode(
			realUrl.href.slice(context.prefix.href.length) + realHash
		);
	}
}
