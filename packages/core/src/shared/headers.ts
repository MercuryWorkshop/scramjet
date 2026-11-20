import { RawHeaders } from "@mercuryworkshop/proxy-transports";
import {
	String_startsWith,
	String_substring,
	String_toLowerCase,
	_Headers,
} from "./snapshot";

/**
 * The prefix under which a response's original, unmodified headers ride along
 * beside the ones the browser is actually given.
 *
 * The two consumers of a proxied response disagree, and for around twenty
 * headers there is no single value that satisfies both. The browser must not
 * see the origin's real CSP, COOP or X-Frame-Options or the proxy cannot
 * function, and it must see `Location` and `Link` pointing at the proxy so it
 * resolves them correctly - while the page is entitled to read exactly what the
 * origin sent. So `rewriteResponseHeaders` copies every original under this
 * prefix before it strips and rewrites, and the client-side `Headers`,
 * `XMLHttpRequest` and cache views restore from those copies.
 *
 * Always go through {@link carriedHeaderName} and {@link uncarriedHeaderName}
 * rather than concatenating this. Header names come back lowercased from
 * `Headers` iteration and from `getAllResponseHeaders`, but are written with
 * the origin's own casing, so every comparison against the prefix has to be
 * case-insensitive - which is exactly the sort of thing that gets missed when
 * the literal is spelled out at each site.
 */
export const CARRIED_HEADER_PREFIX = "x-scramjet-";

/** The carrier name for an original header: `Link` -> `x-scramjet-Link`. */
export function carriedHeaderName(name: string): string {
	return CARRIED_HEADER_PREFIX + name;
}

/** Whether `name` is a carrier, and so must never be shown to the page. */
export function isCarriedHeaderName(name: string): boolean {
	return String_startsWith(String_toLowerCase(name), CARRIED_HEADER_PREFIX);
}

/**
 * The original header name a carrier stands for, or null when `name` is not a
 * carrier at all.
 */
export function uncarriedHeaderName(name: string): string | null {
	if (!isCarriedHeaderName(name)) return null;

	return String_substring(name, CARRIED_HEADER_PREFIX.length);
}

/**
 * Chrome's request header order, measured rather than taken from a document.
 *
 * Taken by asking a server to report the order it actually received -- the raw
 * header list, not the lowercased and sorted view a request object exposes --
 * for a GET and for a POST, direct and proxied, against the same endpoint.
 * Comparing a proxied fetch against a direct navigation does not work: those
 * differ in a browser too. Chromium's order is identical across runs.
 */
const CHROME_REQUEST_ORDER = [
	"sec-ch-ua-platform",
	"accept-language",
	"sec-ch-ua",
	"content-type",
	"sec-ch-ua-mobile",
	"user-agent",
	"accept",
	"origin",
	"sec-fetch-site",
	"sec-fetch-mode",
	"sec-fetch-user",
	"sec-fetch-dest",
	"referer",
	"accept-encoding",
	"cookie",
	// Last on everything Chrome sends it on -- navigation and subresource,
	// GET and POST, after `accept-encoding` and after `cookie`.
	"priority",
];

/**
 * The same order for a request with no `content-type`.
 *
 * Chrome's order is not one sequence. It depends on WHICH headers are present:
 * with a `content-type` the order runs `sec-ch-ua content-type sec-ch-ua-mobile
 * User-Agent`, and without one the last two swap to `User-Agent
 * sec-ch-ua-mobile`. Measured both ways, three runs each, identical every time
 * -- so it is a shape and not noise, and one table cannot hold it.
 */
const CHROME_REQUEST_ORDER_NO_BODY = CHROME_REQUEST_ORDER.map((h) => h)
	.filter((h) => h !== "user-agent")
	.flatMap((h) => (h === "sec-ch-ua-mobile" ? ["user-agent", h] : [h]));

/**
 * Chrome's order on a NAVIGATION, which is a third sequence again.
 *
 * The two tables above were both measured from a fetch, and the comment that
 * used to sit here said a request carrying `upgrade-insecure-requests`,
 * `sec-fetch-user` or `priority` -- all three ride on a navigation and on
 * nothing else -- might well order differently, and that the way to find out
 * was to measure it rather than reason about it.
 *
 * Measured on a real navigation: it does. The three
 * client hints lead, grouped, where a fetch splits them around
 * `accept-language`; `upgrade-insecure-requests` sits between
 * `accept-language` and `content-type`; and `origin` moves up to just after
 * `user-agent` instead of following `accept`.
 *
 *   fetch       sec-ch-ua-platform accept-language sec-ch-ua content-type
 *               sec-ch-ua-mobile user-agent accept origin sec-fetch-*
 *               referer accept-encoding cookie
 *   navigation  sec-ch-ua sec-ch-ua-mobile sec-ch-ua-platform accept-language
 *               upgrade-insecure-requests content-type user-agent origin accept
 *               sec-fetch-* referer accept-encoding cookie
 *
 * Unlike the fetch case ONE table covers both methods here: the GET and the
 * form POST of the same page, taken in the same run, put every header they
 * share in the same place, and `content-type` and `origin` simply appear at
 * fixed points in that sequence when the POST adds them. Taken with a fetch in
 * the same run as a control, which reproduced the table above header for
 * header -- so this is the navigation differing and not the old measurement
 * having drifted.
 *
 * `host`, `connection`, `content-length` and `cache-control` are in the
 * capture and not in the table: they are framing the transport adds, and over
 * HTTP/2 -- which is what the target speaks -- the first three are
 * pseudo-headers that do not sit in this list at all.
 */
const CHROME_NAVIGATION_ORDER = [
	"sec-ch-ua",
	"sec-ch-ua-mobile",
	"sec-ch-ua-platform",
	"accept-language",
	"upgrade-insecure-requests",
	"content-type",
	"user-agent",
	"origin",
	"accept",
	"sec-fetch-site",
	"sec-fetch-mode",
	"sec-fetch-user",
	"sec-fetch-dest",
	"referer",
	"accept-encoding",
	"cookie",
	// Last on everything Chrome sends it on -- navigation and subresource,
	// GET and POST, after `accept-encoding` and after `cookie`.
	"priority",
];

export class ScramjetHeaders {
	headers = {};

	set(key: string, v: string) {
		this.headers[key.toLowerCase()] = v;
	}

	append(key: string, v: string) {
		const lk = key.toLowerCase();
		this.headers[lk] = lk in this.headers ? `${this.headers[lk]}, ${v}` : v;
	}

	get(key: string): string | null {
		const lk = key.toLowerCase();
		if (lk in this.headers) {
			return this.headers[lk];
		}

		return null;
	}

	delete(key: string) {
		delete this.headers[key.toLowerCase()];
	}

	has(key: string): boolean {
		return key.toLowerCase() in this.headers;
	}

	/**
	 * The request headers, in the order a browser sends them.
	 *
	 * Header order is a fingerprint, and Cloudflare reads it. Insertion order
	 * is whatever the rewriting happened to do and is not Chrome's -- measured
	 * against Chromium 155, same request, same server:
	 *
	 *   Chromium  sec-ch-ua-platform Accept-Language sec-ch-ua User-Agent
	 *             sec-ch-ua-mobile Accept Sec-Fetch-* Referer Accept-Encoding
	 *   before    accept accept-language sec-ch-ua sec-ch-ua-mobile
	 *             sec-ch-ua-platform user-agent origin referer Sec-Fetch-*
	 *             accept-encoding
	 *
	 * Stable across runs on both sides, so it is a shape and not noise. One
	 * order covers GET and POST: the headers only a POST has -- `content-type`,
	 * `origin`, `cookie` -- sit at fixed points in the same sequence, which is
	 * what makes a single rank table right rather than a coincidence.
	 *
	 * Anything not listed keeps its insertion order, after everything listed.
	 * The list is what was measured; inventing positions for the rest would be
	 * guessing at a fingerprint, which is how you get a third order that
	 * matches nothing.
	 *
	 * Only requests: this is the single place an outgoing header list is made
	 * (`fetch.ts`), and a response's order belongs to the server.
	 */
	toRawHeaders(): RawHeaders {
		// `upgrade-insecure-requests` is the discriminator because Chrome puts
		// it on navigations and on nothing else, which is exactly the split the
		// tables disagree over. Reading it off the headers keeps the ordering
		// decided by the same thing everywhere `toRawHeaders` is called,
		// rather than by whether a caller remembered to say which kind of
		// request it had.
		const order =
			"upgrade-insecure-requests" in this.headers
				? CHROME_NAVIGATION_ORDER
				: "content-type" in this.headers
					? CHROME_REQUEST_ORDER
					: CHROME_REQUEST_ORDER_NO_BODY;
		const known: RawHeaders = [];
		const rest: RawHeaders = [];
		for (const k in this.headers) {
			(order.indexOf(k) === -1 ? rest : known).push([k, this.headers[k]]);
		}
		known.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));

		return [...known, ...rest];
	}

	toNativeHeaders(): Headers {
		const native = new _Headers();
		for (const k in this.headers) {
			native.set(k, this.headers[k]);
		}

		return native;
	}

	static fromRawHeaders(raw: RawHeaders): ScramjetHeaders {
		const h = new ScramjetHeaders();
		for (const [k, v] of raw) {
			// two Content-Security-Policy fields are two policies, and two
			// Accept-CH fields one list: each is read from the joined value.
			// Any other repeat is left to the last, as it always was
			const lk = k.toLowerCase();
			if (
				lk === "content-security-policy" ||
				lk === "content-security-policy-report-only" ||
				lk === "accept-ch" ||
				lk === "critical-ch"
			) {
				h.append(k, v);
			} else {
				h.set(k, v);
			}
		}

		return h;
	}

	static fromNativeHeaders(native: Headers): ScramjetHeaders {
		const h = new ScramjetHeaders();
		for (const [k, v] of native.entries()) {
			h.set(k, v);
		}

		return h;
	}

	clone(): ScramjetHeaders {
		const newh = new ScramjetHeaders();
		for (const k in this.headers) {
			newh.set(k, this.headers[k]);
		}

		return newh;
	}
}
