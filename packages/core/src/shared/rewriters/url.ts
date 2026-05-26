import { ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { QP } from "@/fetch/parse";

import {
	TextEncoder_encode,
	_URL,
	_URLSearchParams,
	atob,
	String,
	URL_createObjectURL,
} from "../snapshot";

// user: manually triggered navigation
// link: link clicked by the user. still user initiated, but doesn't wipe
// location: location = ...
export type NavigationType = "user" | "link" | "location";

export type RewriteUrlOptions = {
	referrerPolicy?: string;
	isModule?: boolean;
	navigateType?: NavigationType;
	topFrame?: string;
	parentFrame?: string;
	isIframe?: string;
	mode?: string;
	credentials?: string;
	destination?: RequestDestination;
};

export type URLMeta = {
	origin: _URL;
	base: _URL;
	topFrameName?: string;
	parentFrameName?: string;
	referrerPolicy?: string;
};

function tryCanParseURL(url: string, origin?: string | URL): _URL | null {
	try {
		return new _URL(url, origin);
	} catch {
		return null;
	}
}

export function rewriteBlob(
	url: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const blob = new _URL(url.substring("blob:".length));

	return "blob:" + meta.origin.origin + blob.pathname;
}

export function unrewriteBlob(
	url: string,
	context: ScramjetContext,
	_meta: URLMeta
) {
	const blob = new _URL(url.substring("blob:".length));

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
		bytes = TextEncoder_encode(decoded);
	}

	const blob = new Blob([bytes], { type });
	const objectUrl = URL_createObjectURL(blob);
	return { blob, objectUrl };
}

export function rewriteUrl(
	url: string | URL,
	context: ScramjetContext,
	meta: URLMeta,
	options?: RewriteUrlOptions
) {
	url = String(url);

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
		if (url.length + context.prefix.href.length + BUFFER > URL_MAX_LENGTH) {
			const { objectUrl } = dataToBlob(url);
			return (
				context.prefix.href +
				rewriteBlob(objectUrl, context, meta) +
				"?" +
				QP.fakeDataURL +
				"=1"
			);
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

		const paramsInit = new _URLSearchParams();

		const referrerPolicy = !options?.isModule && (options?.referrerPolicy ?? meta.referrerPolicy);
		if (referrerPolicy) paramsInit.set(QP.referrerPolicy, referrerPolicy);
		if (options?.isModule) paramsInit.set(QP.isModule, "module");
		if (options?.topFrame) paramsInit.set(QP.topFrame, options.topFrame);
		if (options?.parentFrame)
			paramsInit.set(QP.parentFrame, options.parentFrame);
		if (options?.isIframe) paramsInit.set(QP.isIframe, options.isIframe);
		if (options?.mode) paramsInit.set(QP.mode, options.mode);
		if (options?.credentials)
			paramsInit.set(QP.credentials, options.credentials);
		if (options?.destination)
			paramsInit.set(QP.destination, options.destination);

		// specific tracking for sec-fetch-site
		// don't send for the top level controller calling it in go()
		if (meta.origin.origin !== context.prefix.origin) {
			paramsInit.set(QP.initiatorOrigin, meta.origin.origin);
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
	url = String(url);
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

		return (
			context.interface.codecDecode(
				realUrl.href.slice(context.prefix.href.length)
			) + realHash
		);
	} else if (url == "") {
		return url;
	} else {
		dbg.error("unrewriteurl: unexpected url", url);
		return url;
	}
}
