import { ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { QP } from "@/fetch/parse";

import {
	TextEncoder_encode,
	_URL,
	_URLSearchParams,
	_Uint8Array,
	_Blob,
	atob,
	selfLocation,
	String,
	String_charCodeAt,
	String_indexOf,
	String_startsWith,
	String_substring,
	URL_createObjectURL,
} from "../snapshot";

// user: manually triggered navigation
// link: the href of a hyperlink, followed when it is activated
// location: location = ..., and everything else a script navigates with
//
// Any of them marks the URL as one a document navigates to, which is what
// lets a fragment navigation stay in the document - see `rewriteUrl`.
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
	/**
	 * The URL the browser has for the document `origin` is the URL of: the
	 * proxy URL it was loaded from, or the one a history entry has since moved
	 * it to. Only a document has one.
	 *
	 * It is what a navigation to that same document has to go to, rather than
	 * to a freshly rewritten URL - see `rewriteUrl`.
	 */
	rawUrl?: string;
	topFrameName?: string;
	parentFrameName?: string;
	referrerPolicy?: string;
};

/**
 * A serialized URL split at its fragment: everything before the `#`, and the
 * fragment with its `#` - or null when there is none.
 *
 * Null and empty are different fragments: `page#` has one, and navigating to
 * it scrolls to the top without leaving the document, where `page` reloads.
 * `URL.hash` answers "" for both, so the serialization is read instead. The
 * serializer percent-encodes a `#` anywhere else, so the first one is the
 * delimiter.
 */
export function splitFragment(href: string): [string, string | null] {
	const index = String_indexOf(href, "#");
	if (index === -1) return [href, null];

	return [String_substring(href, 0, index), String_substring(href, index)];
}

/**
 * Whether `url`, as written, is a fragment-only URL like `#top`: one that
 * names a part of the document it appears in, whatever that document's URL.
 *
 * The URL parser strips leading C0 controls and spaces, and tabs and newlines
 * anywhere, so `" #top"` is one too.
 */
export function isFragmentOnly(url: string): boolean {
	for (let i = 0; i < url.length; i++) {
		const c = String_charCodeAt(url, i);
		if (c <= 0x20) continue;

		return c === 0x23;
	}

	return false;
}

/**
 * The real URL of the document `meta` describes, with `fragment`, when the
 * rest of the URL is that document's - or null.
 *
 * https://html.spec.whatwg.org/multipage/browsing-the-web.html#navigate -
 * a navigation is to a fragment, and stays in the document, when the target
 * URL has a fragment and *equals the document's URL* without it. The browser
 * makes that comparison on the real URLs, and a freshly rewritten one almost
 * never equals the document's: it carries the query parameters of whoever is
 * navigating now (`$io`, `$rfp`, ...), and the document's carries those of
 * whoever loaded it. So `#x` would reload the page instead of scrolling.
 *
 * Built on the document's own URL instead, the two compare exactly as the
 * site's URLs do, and the browser applies its own rules to them.
 */
export function sameDocumentUrl(
	withoutFragment: string,
	fragment: string | null,
	meta: URLMeta
): string | null {
	if (meta.rawUrl === undefined) return null;
	if (splitFragment(meta.origin.href)[0] !== withoutFragment) return null;

	return splitFragment(meta.rawUrl)[0] + (fragment ?? "");
}

/**
 * https://html.spec.whatwg.org/multipage/semantics.html#set-the-frozen-base-url -
 * a base element's href parsed against the document's fallback base URL, or
 * null when it does not set a base URL at all: it does not parse, or it is a
 * `data:` or `javascript:` URL, which the browser ignores.
 */
export function frozenBaseUrl(
	href: string,
	fallback: string | URL
): _URL | null {
	const url = tryCanParseURL(href, fallback);
	if (!url || url.protocol === "data:" || url.protocol === "javascript:")
		return null;

	return url;
}

function tryCanParseURL(url: string, origin?: string | URL): _URL | null {
	try {
		return new _URL(url, origin);
	} catch {
		return null;
	}
}

/**
 * Everything in a blob URL after its origin. The fragment is not part of the
 * blob's identity, but it is part of the URL: a media fragment (`#t=10`) seeks
 * the video, and `#page=2` opens a PDF on its second page.
 */
function blobTail(blob: _URL): string {
	return String_substring(blob.href, blob.origin.length);
}

export function rewriteBlob(
	url: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const blob = new _URL(url.substring("blob:".length));

	return "blob:" + meta.origin.origin + blobTail(blob);
}

export function unrewriteBlob(
	url: string,
	context: ScramjetContext,
	_meta: URLMeta
) {
	const blob = new _URL(url.substring("blob:".length));

	return "blob:" + context.prefix.origin + blobTail(blob);
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
			String_startsWith(part.toLowerCase(), "charset=")
		);
		if (!hasCharset) {
			params.push("charset=US-ASCII");
		}
	}
	if (params.length) type += ";" + params.join(";");

	let bytes: Uint8Array<ArrayBuffer>;
	if (isBase64) {
		let base64 = data.replace(/\s/g, "");
		base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
		const binString = atob(base64);
		bytes = new _Uint8Array(binString.length) as Uint8Array<ArrayBuffer>;
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

	const blob = new _Blob([bytes], { type });
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

	if (String_startsWith(url, "javascript:")) {
		return (
			"javascript:" +
			rewriteJs(
				url.slice("javascript:".length),
				"(javascript: url)",
				context,
				meta
			)
		);
	} else if (String_startsWith(url, "blob:")) {
		return context.prefix.href + url;
	} else if (String_startsWith(url, "data:")) {
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
	} else if (
		String_startsWith(url, "mailto:") ||
		String_startsWith(url, "about:")
	) {
		return url;
	} else {
		let base = meta.base.href;

		if (String_startsWith(base, "about:"))
			base = unrewriteUrl(selfLocation!.href, context); // jank!!!!! weird jank!!!
		const realUrl = tryCanParseURL(url, base);
		if (!realUrl) return url;

		if (realUrl.protocol != "http:" && realUrl.protocol != "https:") {
			// custom protocol. best thing to do is pass it through so it can open an app etc
			// there's also extension:// pages we might need to worry about later
			return url;
		}

		// the fragment is never sent anywhere, so it stays as it is rather than
		// going through the codec: the browser reads it off the real URL to
		// scroll to an element, match `:target`, find a text fragment, and
		// answer `location.hash` - all of which need the site's own fragment
		const [withoutFragment, fragment] = splitFragment(realUrl.href);

		// only with a fragment: without one, a navigation to the document's
		// own URL loads a new document, which is requested by whoever is
		// navigating now - and the document's real URL names whoever loaded it
		// (`$io`), so its `Sec-Fetch-Site` would be stale
		if (options?.navigateType && fragment !== null) {
			const same = sameDocumentUrl(withoutFragment, fragment, meta);
			if (same !== null) return same;
		}

		realUrl.hash = "";

		const paramsInit = new _URLSearchParams();

		const referrerPolicy =
			!options?.isModule && (options?.referrerPolicy ?? meta.referrerPolicy);
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
			(fragment ?? "")
		);
	}
}

/**
 * The real URL a document moves to when its URL changes without anything
 * being loaded - `history.pushState` and `replaceState` - given a `url` that
 * the document can have its URL rewritten to.
 *
 * A URL that differs from the document's only in its fragment is the
 * document's real URL with that fragment, for the same reason a fragment
 * navigation is (see `sameDocumentUrl`): the entries it makes then compare
 * with it, and with each other, exactly as the site's do.
 *
 * Any other URL keeps the query parameters of the real one. They describe how
 * the document was requested - as a frame, by whom, under which referrer
 * policy - and a reload of the new entry is a request for the same document
 * in the same place. A freshly rewritten URL would describe a navigation made
 * by the page itself, so a frame that called `pushState` would reload as a
 * top-level document.
 */
export function rewriteHistoryUrl(
	url: URL,
	context: ScramjetContext,
	meta: URLMeta
): string {
	const [withoutFragment, fragment] = splitFragment(url.href);
	if (meta.rawUrl === undefined) return rewriteUrl(url, context, meta);

	const same = sameDocumentUrl(withoutFragment, fragment, meta);
	if (same !== null) return same;

	// a scheme with no proxy URL, which only ever differs in its fragment
	if (url.protocol !== "http:" && url.protocol !== "https:") return url.href;

	return (
		context.prefix.href +
		context.interface.codecEncode(withoutFragment) +
		new _URL(meta.rawUrl).search +
		(fragment ?? "")
	);
}

/**
 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
 *
 * A test on the two URLs alone. It says nothing about origins: an
 * about:blank or srcdoc document can take a new fragment, and nothing else,
 * whoever created it - which a comparison of origins gets wrong both ways,
 * since `about:blank#x` has an opaque origin that equals no creator's.
 */
export function canHaveItsURLRewritten(document: URL, target: URL): boolean {
	// `host` is the host and the port, so this is steps 1's five parts
	if (
		target.protocol !== document.protocol ||
		target.username !== document.username ||
		target.password !== document.password ||
		target.host !== document.host
	) {
		return false;
	}

	// the path, the query and the fragment may all change
	if (target.protocol === "http:" || target.protocol === "https:") {
		return true;
	}

	// the query and the fragment may change, but not the path
	if (target.protocol === "file:") {
		return target.pathname === document.pathname;
	}

	// anything else may only change its fragment
	return splitFragment(target.href)[0] === splitFragment(document.href)[0];
}

export function unrewriteUrl(url: string | URL, context: ScramjetContext) {
	url = String(url);
	if (String_startsWith(url, "javascript:")) {
		//TODO
		return url;
	} else if (String_startsWith(url, "blob:")) {
		// realistically this shouldn't happen
		return url;
	} else if (String_startsWith(url, context.prefix.href + "blob:")) {
		return url.substring(context.prefix.href.length);
	} else if (String_startsWith(url, context.prefix.href + "data:")) {
		return url.substring(context.prefix.href.length);
	} else if (
		String_startsWith(url, "mailto:") ||
		String_startsWith(url, "about:")
	) {
		return url;
	} else if (
		String_startsWith(url, "http:") ||
		String_startsWith(url, "https:")
	) {
		const realUrl = tryCanParseURL(url);
		if (!realUrl) return url;
		if (realUrl.protocol != "http:" && realUrl.protocol != "https:") {
			// custom protocol
			return url;
		}
		if (!String_startsWith(realUrl.href, context.prefix.href)) {
			dbg.error("unrewriteurl: unexpected url", url);
			return url;
		}
		// as it was written - see `rewriteUrl`
		const fragment = splitFragment(realUrl.href)[1];
		realUrl.hash = "";
		realUrl.search = "";

		return (
			context.interface.codecDecode(
				realUrl.href.slice(context.prefix.href.length)
			) + (fragment ?? "")
		);
	} else if (url == "") {
		return url;
	} else {
		dbg.error("unrewriteurl: unexpected url", url);
		return url;
	}
}
