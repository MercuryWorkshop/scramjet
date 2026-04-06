import { ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";

export type URLMeta = {
	origin: URL;
	base: URL;
	topFrameName?: string;
	parentFrameName?: string;
	clientId: string;
	referrerPolicy?: string;
};

let url_ctor = URL;
let url_createObjectURL = URL.createObjectURL;

function tryCanParseURL(url: string, origin?: string | URL): URL | null {
	try {
		return new url_ctor(url, origin);
	} catch {
		return null;
	}
}

export function rewriteBlob(
	url: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const blob = new url_ctor(url.substring("blob:".length));

	return "blob:" + meta.origin.origin + blob.pathname;
}

export function unrewriteBlob(
	url: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const blob = new url_ctor(url.substring("blob:".length));

	return "blob:" + context.prefix.origin + blob.pathname;
}

function dataToBlob(url: string) {
	const commaIndex = url.indexOf(",");
	if (commaIndex === -1) return null;

	const meta = url.slice("data:".length, commaIndex);
	const data = url.slice(commaIndex + 1);

	const metaParts = meta.split(";");
	const mediaType = metaParts.shift() || "";
	const isBase64 = metaParts.some((part) => part.toLowerCase() === "base64");
	const params = metaParts.filter(
		(part) => part && part.toLowerCase() !== "base64"
	);

	let type = mediaType || "text/plain";
	if (!mediaType) {
		const hasCharset = params.some((part) =>
			part.toLowerCase().startsWith("charset=")
		);
		if (!hasCharset) {
			params.push("charset=US-ASCII");
		}
	}
	if (params.length) type += ";" + params.join(";");

	let bytes: Uint8Array;
	if (isBase64) {
		let base64 = data.replace(/\s/g, "");
		base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
		const binString = atob(base64);
		bytes = new Uint8Array(binString.length);
		for (let i = 0; i < binString.length; i++) {
			bytes[i] = binString.charCodeAt(i);
		}
	} else {
		let decoded = data;
		try {
			decoded = decodeURIComponent(data);
		} catch {
			// If decode fails, fall back to raw data.
		}
		bytes = new TextEncoder().encode(decoded);
	}

	const blob = new Blob([bytes], { type });
	const objectUrl = url_createObjectURL(blob);
	return { blob, objectUrl };
}

// user: manually triggered navigation
// link: link clicked by the user. still user initiated, but doesn't wipe
// location: location = ...
export type NavigationType = "user" | "link" | "location";
export type RewriteUrlOptions = {
	referrerPolicyOverride?: string;
	moduleType?: string;
	navigateType?: NavigationType;
	// is this an iframe, where we would want to create a new client
	newClient?: boolean;
	topFrame?: string;
	parentFrame?: string;
};

export function rewriteUrl(
	url: string | URL,
	context: ScramjetContext,
	meta: URLMeta,
	options?: RewriteUrlOptions
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
		const URL_MAX_LENGTH = 1024 * 1024 * 2;
		const BUFFER = 1024;
		// chrome will explode if you make a request to a service worker with a 2MB+ URL
		// there's an okayish workaround which is just Pretending It's a Blob
		// TODO: this leaks memory
		if (url.length + context.prefix.href.length + BUFFER > URL_MAX_LENGTH) {
			let { objectUrl } = dataToBlob(url);
			return context.prefix.href + rewriteBlob(objectUrl, context, meta);
		}

		return context.prefix.href + url;
	} else if (url.startsWith("mailto:") || url.startsWith("about:")) {
		return url;
	} else {
		let base = meta.base.href;

		if (base.startsWith("about:"))
			base = unrewriteUrl(self.location.href, context); // jank!!!!! weird jank!!!
		const realUrl = tryCanParseURL(url, base);
		if (!realUrl) return url;

		if (realUrl.protocol != "http:" && realUrl.protocol != "https:") {
			// custom protocol. best thing to do is pass it through so it can open an app etc
			// there's also extension:// pages we might need to worry about later
			return url;
		}

		const encodedHash = context.interface.codecEncode(realUrl.hash.slice(1));
		const realHash = encodedHash ? "#" + encodedHash : "";
		realUrl.hash = "";

		const paramsInit = new URLSearchParams();
		if (meta.clientId && !options?.newClient) {
			paramsInit.append("cid", meta.clientId);
		}

		if (options?.referrerPolicyOverride) {
			paramsInit.append("rfp", options.referrerPolicyOverride);
		} else if (meta.referrerPolicy) {
			paramsInit.append("rfp", meta.referrerPolicy);
		}

		if (options?.moduleType) {
			paramsInit.append("type", options.moduleType);
		}

		if (options?.topFrame) {
			paramsInit.append("topFrame", options.topFrame);
		}
		if (options?.parentFrame) {
			paramsInit.append("parentFrame", options.parentFrame);
		}

		let paramstring = "";
		if (paramsInit.toString()) paramstring = "?" + paramsInit.toString();

		return (
			context.prefix.href +
			context.interface.codecEncode(realUrl.href) +
			paramstring +
			realHash
		);
	}
}

export function unrewriteUrl(url: string | URL, context: ScramjetContext) {
	if (url instanceof URL) url = url.toString();
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
	} else if (url.startsWith("http:") || url.startsWith("https:")) {
		const realUrl = tryCanParseURL(url);
		if (!realUrl) return url;
		if (realUrl.protocol != "http:" && realUrl.protocol != "https:") {
			// custom protocol
			return url;
		}
		if (!realUrl.href.startsWith(context.prefix.href)) {
			dbg.error("unrewriteurl: unexpected url", url);
			return url;
		}
		const decodedHash = context.interface.codecDecode(realUrl.hash.slice(1));
		const realHash = decodedHash ? "#" + decodedHash : "";
		realUrl.hash = "";
		realUrl.search = "";

		return context.interface.codecDecode(
			realUrl.href.slice(context.prefix.href.length) + realHash
		);
	} else if (url == "") {
		return url;
	} else {
		dbg.error("unrewriteurl: unexpected url", url);
		return url;
	}
}
