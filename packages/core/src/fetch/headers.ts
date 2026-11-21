import {
	rewriteUrl,
	ScramjetContext,
	carriedHeaderName,
	ScramjetHeaders,
	unrewriteUrl,
	URLMeta,
} from "@/shared";
import {
	ScramjetFetchHandler,
	ScramjetFetchParsed,
	ScramjetFetchRequest,
} from ".";
import { RawHeaders } from "@mercuryworkshop/proxy-transports";
import {
	_URL,
	_Set,
	Array_includes,
	String_split,
	String_startsWith,
	String_toLowerCase,
} from "@/shared/snapshot";
import {
	createReferrerString,
	DEFAULT_REFERRER_POLICY,
	isDocument,
} from "./util";
import { isFetchPreload } from "@/shared/htmlRules";
import {
	applyClientHints,
	clientHintsAllowed,
	withoutUaHints,
} from "./clienthints";

/**
 * Headers for security policy features that haven't been emulated yet
 */
const SEC_HEADERS = new _Set([
	"cross-origin-embedder-policy",
	"cross-origin-opener-policy",
	"cross-origin-resource-policy",
	"content-security-policy",
	"content-security-policy-report-only",
	"expect-ct",
	"feature-policy",
	// the proxy blanks every `integrity` it passes to the browser, so under a
	// policy that demands one nothing would load - scramjet's own scripts first
	// https://w3c.github.io/webappsec-subresource-integrity/#integrity-policy-section
	"integrity-policy",
	"integrity-policy-report-only",
	"origin-isolation",
	"strict-transport-security",
	"upgrade-insecure-requests",
	"x-content-type-options",
	"x-download-options",
	"x-frame-options",
	"x-permitted-cross-domain-policies",
	"x-powered-by",
	"x-xss-protection",
	// This needs to be emulated, but for right now it isn't that important of a feature to be worried about
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Clear-Site-Data
	"clear-site-data",
]);

/**
 * Headers that are actually URLs that need to be rewritten
 */
const URL_HEADERS = new _Set(["location", "content-location", "referer"]);

/**
 * Split `value` at each `separator` outside a `<URI-Reference>` and outside a
 * quoted-string.
 * https://www.rfc-editor.org/rfc/rfc8288#section-3
 */
function splitLinkHeader(value: string, separator: string): string[] {
	const parts: string[] = [];
	let start = 0;
	let inUri = false;
	let inQuote = false;
	for (let i = 0; i < value.length; i++) {
		const c = value[i];
		if (inQuote) {
			if (c === "\\") i++;
			else if (c === '"') inQuote = false;
		} else if (inUri) {
			if (c === ">") inUri = false;
		} else if (c === '"') {
			inQuote = true;
		} else if (c === "<") {
			inUri = true;
		} else if (c === separator) {
			parts.push(value.substring(start, i));
			start = i + 1;
		}
	}
	parts.push(value.substring(start));

	return parts;
}

function linkParamValue(value: string): string {
	value = value.trim();
	if (
		value.length >= 2 &&
		value[0] === '"' &&
		value[value.length - 1] === '"'
	) {
		return value.slice(1, -1).replace(/\\(.)/g, "$1");
	}

	return value;
}

function rewriteLinkHeader(
	link: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	return splitLinkHeader(link, ",")
		.map((linkValue) => {
			const [target, ...rawParams] = splitLinkHeader(linkValue, ";");
			const params = rawParams.map((param) => {
				const eq = param.indexOf("=");
				const name = (eq === -1 ? param : param.substring(0, eq))
					.trim()
					.toLowerCase();
				const value =
					eq === -1 ? null : linkParamValue(param.substring(eq + 1));

				return { raw: param, name, value };
			});
			const getParam = (name: string) =>
				params.find((param) => param.name === name)?.value ?? null;

			// a preload's digest is checked against the body the browser gets,
			// which is the rewritten one - so it goes, as an element's `integrity`
			// does in htmlRules, except on a `fetch` preload whose body is as-is
			const keepIntegrity = isFetchPreload(getParam);
			// a module's URL is marked as one wherever it is loaded from; an
			// unmarked preload never matches the module's own request, so the
			// module would be fetched twice
			const isModule = Array_includes(
				String_split(String_toLowerCase(getParam("rel") ?? ""), /\s+/),
				"modulepreload"
			);

			return [
				target.replace(
					/<([^>]+)>/,
					(_match, url) => `<${rewriteUrl(url, context, meta, { isModule })}>`
				),
				...params
					.filter((param) => keepIntegrity || param.name !== "integrity")
					.map((param) => param.raw),
			].join(";");
		})
		.join(",");
}

export function attachCarriedHeaders(
	headers: ScramjetHeaders,
	rawHeaders: RawHeaders
) {
	for (const [key, value] of rawHeaders) {
		if (key.toLowerCase().startsWith("set-cookie")) {
			// this is purely for browser consumption via Headers.get, and set-cookie is always hidden from js
			continue;
		}
		headers.append(carriedHeaderName(key), value);
	}
}

export async function rewriteResponseHeaders(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	rawHeaders: RawHeaders
): Promise<ScramjetHeaders> {
	const headers = ScramjetHeaders.fromRawHeaders(rawHeaders);
	attachCarriedHeaders(headers, rawHeaders);

	// the browser applies the last policy it recognizes out of every field,
	// so they go on as the one list rather than as the last field alone
	// https://w3c.github.io/webappsec-referrer-policy/#parse-referrer-policy-from-header
	const policies: string[] = [];
	for (const [name, value] of rawHeaders) {
		if (name.toLowerCase() === "referrer-policy") policies.push(value);
	}
	if (policies.length > 1) headers.set("referrer-policy", policies.join(", "));

	for (const cspHeader of SEC_HEADERS) {
		headers.delete(cspHeader);
	}

	// the UA hints are the target origin's, handled in `clienthints.ts`: the
	// browser would keep them for the proxy's origin, and restart a
	// navigation a second time over them
	for (const name of ["accept-ch", "critical-ch"]) {
		const value = headers.get(name);
		if (value === null) continue;
		const rest = withoutUaHints(value);
		if (rest) headers.set(name, rest);
		else headers.delete(name);
	}

	for (const urlHeader of URL_HEADERS) {
		if (headers.has(urlHeader)) {
			const url = headers.get(urlHeader)!;
			const rewrittenUrl = rewriteUrl(url, handler.context, parsed.meta);
			headers.set(urlHeader, rewrittenUrl);
		}
	}

	if (headers.has("link")) {
		const link = headers.get("link")!;
		const rewritten = rewriteLinkHeader(link, handler.context, parsed.meta);
		headers.set("link", rewritten);
	}

	if (headers.get("accept") === "text/event-stream") {
		headers.set("content-type", "text/event-stream");
	}

	// scramjet runtime can use features that permissions-policy blocks
	headers.delete("permissions-policy");

	// we handle this ourselves
	headers.delete("set-cookie");

	if (
		handler.crossOriginIsolated &&
		[
			"document",
			"iframe",
			"worker",
			"sharedworker",
			"style",
			"script",
		].includes(parsed.destination)
	) {
		headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		headers.set("Cross-Origin-Opener-Policy", "same-origin");
	}

	return headers;
}

/**
 * The site's URL for a URL the browser handed the service worker as a
 * referrer, or null when it has none: an http(s) URL outside the proxy is the
 * embedder's, not a site's.
 */
function unrewriteReferrer(
	url: URL,
	handler: ScramjetFetchHandler
): _URL | null {
	if (!String_startsWith(url.href, handler.context.prefix.href)) return null;
	try {
		return new _URL(unrewriteUrl(url, handler.context));
	} catch {
		return null;
	}
}

/**
 * The URL the request's referrer is taken from, before its policy is applied.
 *
 * The browser has already worked out which document, stylesheet, module or
 * worker the referrer comes from, and which policy applies, and handed both to
 * the service worker - only in the proxy's URL space. Every proxied URL is
 * same-origin with every other, so the policy it applied there left the URL
 * whole unless it asks for no referrer at all or for an origin only, or the
 * URL was too long. An origin-only referrer is the proxy's own, and the site's
 * origin has to come from elsewhere: the one the page stamped on the URL it
 * asked for, or the client that asked.
 */
function referrerSource(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed
): _URL | null {
	// a redirect hands on the referrer the hops before it cut down, which can
	// only be cut down further
	if (parsed.referrerSourceUrl !== undefined) return parsed.referrerSourceUrl;

	if (!request.rawReferrer) return null;
	let raw: _URL;
	try {
		raw = new _URL(request.rawReferrer);
	} catch {
		return null;
	}

	const whole = unrewriteReferrer(raw, handler);
	if (whole) return whole;

	// anything else from outside the proxy's origin is nothing the site knows
	const prefix = handler.context.prefix;
	if (raw.origin !== prefix.origin) return null;

	const client = request.rawClientUrl
		? unrewriteReferrer(request.rawClientUrl, handler)
		: null;
	const clientIsSite =
		client && (client.protocol === "http:" || client.protocol === "https:");

	if (raw.href === raw.origin + "/") {
		// cut down to an origin, by the policy or for being too long as the
		// proxy's URL, in which case the origin is all that is sent
		const origin = parsed.fetchReferrerOrigin ?? parsed.fetchInitiatorOrigin;
		if (origin) {
			try {
				return new _URL(origin + "/");
			} catch {
				// fall through to the client
			}
		}

		return clientIsSite ? new _URL(client.origin + "/") : null;
	}

	// the proxy's own script asked on the site's behalf, as a dynamic import()
	// does - unless the client is the embedder, whose navigations of the frame
	// are the user's and have no referrer
	return clientIsSite ? client : null;
}

/**
 * The Referer header a request is sent with, or null for none.
 *
 * https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer
 */
export function determineReferrer(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed
): string | null {
	const policy = request.rawReferrerPolicy || DEFAULT_REFERRER_POLICY;
	const source = referrerSource(handler, request, parsed);
	if (!source) return null;

	return createReferrerString(source, parsed.url, policy) || null;
}

/**
 * What document.referrer reads in a document served for this request.
 *
 * That is the Referer it was requested with - except after a redirect, where
 * Chrome puts that Referer through the policy the navigation started out with
 * rather than the one the redirects left it with.
 */
export function documentReferrer(parsed: ScramjetFetchParsed): string {
	if (!parsed.referrer) return "";
	if (parsed.initialReferrerPolicy === undefined) return parsed.referrer;

	return createReferrerString(
		new _URL(parsed.referrer),
		parsed.url,
		parsed.initialReferrerPolicy
	);
}

export function rewriteRequestHeaders(
	request: ScramjetFetchRequest,
	handler: ScramjetFetchHandler,
	parsed: ScramjetFetchParsed
): ScramjetHeaders {
	const headers = request.initialHeaders.clone();

	// avoid leaking the scramjet referer
	headers.delete("Referer");

	// Origin and the SameSite context are the initiator's: the referrer is the
	// wrong place to look for it, since its policy is free to cut it down to
	// the proxy's origin or drop it.
	const initiator = resolveFetchInitiatorUrl(request, parsed, handler);
	headers.delete("Origin");
	// https://fetch.spec.whatwg.org/#origin-header - only for a method other
	// than GET or HEAD, or a cors or websocket request: a plain GET for a
	// script, an image or a document carries none. The mode is
	// `computeFetchMode`'s, since the service worker reports it against the
	// proxy's URL space
	if (initiator) {
		const method = (request.method || "GET").toUpperCase();
		const mode = computeFetchMode(request, parsed);
		if (
			(method !== "GET" && method !== "HEAD") ||
			mode === "cors" ||
			mode === "websocket"
		) {
			headers.set("Origin", initiator.origin);
		}
	}

	if (parsed.referrer) headers.set("Referer", parsed.referrer);

	const sameSiteContext = computeSameSiteContext(request, parsed, initiator);
	const cookies = handler.context.cookieJar.getCookies(
		parsed.url,
		false,
		sameSiteContext
	);

	if (cookies.length) {
		headers.set("Cookie", cookies);
	}

	applyFetchMetadataHeaders(headers, request, parsed, handler);
	// After everything else, and keyed on the TARGET origin: the browser put
	// the low-entropy three on this request for the PROXY's origin, and the
	// high-entropy ones are owed to whoever asked for them by name.
	applyClientHints(headers, parsed.url, clientHintsAllowed(parsed));

	return headers;
}

/**
 * Compute and attach the Sec-Fetch-* request metadata headers, per
 * https://w3c.github.io/webappsec-fetch-metadata/.
 *
 * Browsers compute these based on the proxy URL space (page → service worker),
 * which is meaningless to the destination. We strip those values and recompute
 * based on the logical (unrewritten) URLs so that the destination sees
 * realistic Sec-Fetch-Site / -Mode / -Dest / -User values.
 *
 * These headers are only attached when the destination URL is a "potentially
 * trustworthy" URL — matching Chrome's behaviour of omitting them when sending
 * to plain http:// non-loopback destinations.
 */
function applyFetchMetadataHeaders(
	headers: ScramjetHeaders,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	handler: ScramjetFetchHandler
) {
	// Strip browser-attached Sec-Fetch-* (computed from the proxy URL space).
	headers.delete("sec-fetch-site");
	headers.delete("sec-fetch-mode");
	headers.delete("sec-fetch-dest");
	headers.delete("sec-fetch-user");
	headers.delete("sec-fetch-storage-access");

	if (!isPotentiallyTrustworthy(parsed.url)) {
		return;
	}

	// Determine the request initiator's origin. Unlike the Referer header,
	// this never gets stripped by referrer policy: it's the page that actually
	// initiated the chain. Prefer the propagated initiator origin for
	// post-redirect requests; otherwise fall back to rawClientUrl/rawReferrer.
	const initiatorUrl = resolveFetchInitiatorUrl(request, parsed, handler);

	// Sec-Fetch-Site: relationship between request initiator's origin and the URL.
	let site: "none" | "same-origin" | "same-site" | "cross-site";
	if (!initiatorUrl) {
		// No initiator (e.g., user typed URL, or browser-initiated request).
		site = "none";
	} else {
		const immediate = computeFetchSite(initiatorUrl, parsed.url);
		site = parsed.fetchSiteState
			? worstFetchSite(parsed.fetchSiteState, immediate)
			: immediate;
	}
	headers.set("Sec-Fetch-Site", site);

	// Sec-Fetch-Mode: the request's mode. `event.request.mode` from the SW is
	// computed against the proxy URL space (always same-origin to the page) so
	// it's not safe to trust for fetch / Request API calls; we prefer the
	// `sj$mode` value the client-side proxy stamped onto the URL when present
	// and fall back to a destination-based default for everything else.
	headers.set("Sec-Fetch-Mode", computeFetchMode(request, parsed));

	let emulatedTopLevel = false;
	if (parsed.destination === "iframe") {
		if (!parsed.isIframe) {
			// emulate a top-level navigation
			headers.set("Sec-Fetch-Dest", "document");
			emulatedTopLevel = true;
		} else {
			headers.set("Sec-Fetch-Dest", "iframe");
		}
	} else {
		headers.set("Sec-Fetch-Dest", parsed.destination || "empty");
	}

	// Sec-Fetch-User: sent as "?1" only on user-activated navigation requests
	// (top-level documents, iframes, frames, and embedded objects). The browser
	// already attaches this header to the page→SW request when the navigation
	// originates from a user gesture, so we forward that signal for any
	// navigation destination.
	const isNavigationDestination =
		parsed.destination === "document" ||
		parsed.destination === "iframe" ||
		parsed.destination === "frame" ||
		parsed.destination === "embed" ||
		parsed.destination === "object";
	if (
		isNavigationDestination &&
		request.initialHeaders.get("sec-fetch-user") === "?1"
	) {
		headers.set("Sec-Fetch-User", "?1");
	} else if (emulatedTopLevel && site === "none") {
		// The Dest emulation two blocks up is only half of the lie. Measured
		// against Chromium 155, a browser attaches `Sec-Fetch-User` to a
		// navigation if and only if
		// transient user activation is live -- the same frame, the same URL,
		// navigated from a click sends `?1` and navigated from a timer six
		// seconds later does not.
		//
		// `Sec-Fetch-Site: none` means browser-initiated: a typed URL, a
		// bookmark, a new tab. Every way of producing one is a user acting, so
		// Chrome never sends this combination without `?1`, and claiming
		// `Dest: document` + `Mode: navigate` + `Site: none` while withholding
		// it produces a request no browser makes. That is worse than either
		// lie alone, because it is the ENTRY navigation -- the request an
		// anti-bot decides on before a line of the page's JavaScript runs.
		//
		// Only here. A scripted `location.href` inside the guest computes a
		// real site of same-origin or cross-site, takes neither branch, and
		// keeps correctly saying nothing.
		headers.set("Sec-Fetch-User", "?1");
	}

	// Sec-Fetch-Storage-Access: per https://privacycg.github.io/storage-access-headers/.
	// Sent on cross-site credentialed requests so the destination knows whether
	// unpartitioned storage access has been granted. We never grant storage
	// access through the proxy, so the value is always "none" when sent.
	//
	// `event.request.credentials` inside a service worker isn't reliable, so we
	// rely on signals propagated from the page (the `sj$cred` URL param set by
	// the client-side fetch proxy) plus destination-based defaults for request
	// types that always include credentials.
	if (site === "cross-site" && requestIncludesCredentials(request, parsed)) {
		headers.set("Sec-Fetch-Storage-Access", "none");
	}

	applyPriorityHeader(headers, parsed);

	// No `accept-encoding`: it is the transport's to send, because the
	// transport is what decodes the response. Chromium offers `gzip, deflate,
	// br, zstd`, but a server takes whichever it likes best, and a transport
	// offered an encoding it cannot decode fails the request outright -
	// libcurl answers zstd with "Unrecognized or bad HTTP Content or
	// Transfer-Encoding".
}

/**
 * RFC 9218 extensible priorities, as Chrome sends them.
 *
 * Measured against Chromium 155 over HTTP/2, one page pulling one of each kind
 * against a throwaway h2 server. The numbers are recorded here because this is
 * where they are used:
 *
 *   document   u=0, i      iframe   u=0, i      style  u=0
 *   script     u=1         font     u=1         fetch  u=1, i
 *   image      u=2, i      favicon  u=1, i
 *   script defer/async     (no header at all)
 *   image from `new Image()` after parse      `i`
 *
 * The default is `u=3, i=0`, and Chrome omits whatever matches it -- which is
 * why a deferred script sends nothing and a late image sends `i` alone.
 *
 * Only the destinations whose value does not depend on something a service
 * worker cannot see. `script` and `image` are deliberately absent: the same
 * destination is `u=1` or nothing depending on `defer`/`async`, and `u=2, i`
 * or `i` depending on whether the parser or a script asked for it, and neither
 * distinction survives into `event.request`. Guessing one of the two would
 * replace "header missing" with "header wrong", which is the same size of
 * difference and harder to find later.
 *
 * Sent regardless of protocol because the protocol is not known here -- ALPN
 * settles it inside the transport, long after this. A browser sends none on
 * HTTP/1.1, so there it is one header more than Chromium's; only the transport
 * learns the protocol, so dropping it there is the transport's to do.
 */
function applyPriorityHeader(
	headers: ScramjetHeaders,
	parsed: ScramjetFetchParsed
) {
	const priority = {
		document: "u=0, i",
		iframe: "u=0, i",
		frame: "u=0, i",
		embed: "u=0, i",
		object: "u=0, i",
		style: "u=0",
		font: "u=1",
		empty: "u=1, i",
	}[parsed.destination || "empty"];

	// one the page set itself is sent as it is
	if (priority && !headers.has("priority")) headers.set("Priority", priority);
}

/**
 * Whether this request will carry credentials to the destination. Used by
 * Sec-Fetch-Storage-Access. The browser's `event.request.credentials` value
 * can't be trusted in a service worker context, so we reconstruct the answer
 * from:
 *
 * - the `sj$cred` URL parameter, set by the client-side fetch proxy when the
 *   page used `fetch(url, { credentials: "include" })`; and
 * - destination-based defaults: most resource fetches (img, script, style,
 *   link, video, audio, track, document/iframe navigations, etc.) default to
 *   credentials mode "include" unless the page explicitly opts out via a
 *   `crossorigin` attribute we can't observe from here. fetch() / XHR
 *   default to "same-origin", so we treat them as non-credentialed unless
 *   `sj$cred` says otherwise.
 */
function requestIncludesCredentials(
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed
): boolean {
	if (parsed.fetchCredentialsInclude) return true;
	const dest = parsed.destination;
	// fetch(): destination is "" (empty). XHR / report: destination is
	// "report". Both default to credentials="same-origin", so cross-site
	// requests don't include credentials unless the page explicitly opts in.
	if (dest === "" || dest === "report") return false;
	// ES modules (including module scripts and module-typed workers) default
	// to credentials="same-origin", so cross-site fetches do not carry
	// credentials.
	if (parsed.isModule) return false;
	// Other destinations (image, classic-script, style, audio, video, track,
	// font, iframe, frame, document, embed, object, manifest, classic worker,
	// sharedworker, serviceworker, ...) default to credentials="include".
	return true;
}

/**
 * Determine the Sec-Fetch-Mode value for a request.
 *
 * The browser's `event.request.mode` reported in the SW is unsafe to trust
 * for `fetch()` / `new Request()` calls — those compute mode against the
 * request URL's relationship to the page, and scramjet has rewritten the URL
 * to be same-origin to the page, so the SW always sees "same-origin"
 * regardless of the page's actual `init.mode`. For HTML resource fetches
 * (`<script crossorigin>`, `<img crossorigin>`, …) the mode is derived from
 * the element's CORS attribute rather than URL origin, so the SW's reported
 * mode IS reliable there.
 *
 * Resolution order:
 *   1. `parsed.fetchMode` — set by the client-side fetch / Request proxy from
 *      `init.mode` (or fetch's "cors" default). Authoritative for
 *      page-initiated fetch / Request / XHR-style calls.
 *   2. Top-level navigations: always "navigate".
 *   3. Workers: classic → "same-origin", module → "cors".
 *   4. Everything else: trust the SW's `request.mode` (it reflects the
 *      element's CORS attribute), falling back to "no-cors" if it's missing
 *      or implausible (e.g. "same-origin" / "navigate" leaking in from a
 *      proxy-URL computation).
 */
function computeFetchMode(
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed
): string {
	if (parsed.fetchMode) {
		// the mode was stamped on the URL when the Request was made, and a
		// fetch can override it: `fetch(new Request(url, { mode: "no-cors" }),
		// { mode: "cors" })`. A cors or no-cors the browser reports is the one
		// the fetch has
		if (request.mode === "cors" || request.mode === "no-cors") {
			return request.mode;
		}

		return parsed.fetchMode;
	}
	const dest = parsed.destination;
	if (
		dest === "document" ||
		dest === "iframe" ||
		dest === "frame" ||
		dest === "embed" ||
		dest === "object"
	) {
		return "navigate";
	}
	if (dest === "worker" || dest === "sharedworker") {
		// Classic workers default to same-origin; module workers default to cors.
		return parsed.isModule ? "cors" : "same-origin";
	}
	// HTML element fetches: the browser's `request.mode` here reflects the
	// element's CORS attribute (`<script crossorigin>` ⇒ "cors", plain
	// `<script>` ⇒ "no-cors"), so trust it. Reject "same-origin"/"navigate"
	// since those indicate the value came from URL-origin matching against
	// scramjet's proxy origin and is meaningless to the destination.
	if (request.mode === "cors" || request.mode === "no-cors") {
		return request.mode;
	}
	return "no-cors";
}

/**
 * The site URL of the page (or worker) that initiated this request, or
 * undefined for one the browser started itself. Its origin is the request's
 * Origin, SameSite context and Sec-Fetch-Site, whatever the referrer policy.
 *
 * What the browser hands over is believed first: for a subresource, the
 * client that asked for it; for a navigation, the document it came from,
 * which is its referrer where the policy left that whole - its client is the
 * frame being navigated. `$io`, stamped by the page's own code, only stands
 * in where the browser says nothing: a referrer cut down by its policy, a
 * client that is an about:srcdoc or an about:blank, a top-level navigation
 * with no client. The client of a navigation comes last, after `$io`: it is
 * a document the frame is leaving, often not the one that sent it there.
 */
export function resolveFetchInitiatorUrl(
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	handler: ScramjetFetchHandler
): URL | undefined {
	const site = (url: URL | null | undefined): URL | undefined => {
		if (!url || !String_startsWith(url.href, handler.context.prefix.href)) {
			return undefined;
		}
		try {
			const unrewritten = new _URL(unrewriteUrl(url, handler.context));
			// a data: document is an initiator too, of an opaque origin
			return unrewritten.protocol === "http:" ||
				unrewritten.protocol === "https:" ||
				unrewritten.protocol === "data:"
				? unrewritten
				: undefined;
		} catch {
			return undefined;
		}
	};
	let referrer: URL | undefined;
	if (request.rawReferrer) {
		try {
			referrer = site(new _URL(request.rawReferrer));
		} catch {
			// not a URL at all
		}
	}
	const client = site(request.rawClientUrl);
	let stamped: URL | undefined;
	if (parsed.fetchInitiatorOrigin) {
		try {
			stamped = new _URL(parsed.fetchInitiatorOrigin);
		} catch {
			// an opaque origin, which is no URL's
		}
	}

	return isDocument(parsed)
		? (referrer ?? stamped ?? client)
		: (client ?? referrer ?? stamped);
}

/**
 * Whether a URL is "potentially trustworthy" per
 * https://w3c.github.io/webappsec-secure-contexts/#is-url-trustworthy.
 *
 * This is a slimmed-down implementation: HTTPS / WSS, file:, and the common
 * loopback hostnames (localhost, *.localhost, 127.0.0.0/8, ::1) are treated as
 * trustworthy. Everything else (including plain http:// to a real hostname) is
 * not.
 */
function isPotentiallyTrustworthy(url: URL): boolean {
	const protocol = url.protocol;
	if (protocol === "https:" || protocol === "wss:" || protocol === "file:") {
		return true;
	}
	if (protocol !== "http:" && protocol !== "ws:") {
		// data:, blob:, etc. – defer to the caller; treated as not trustworthy
		// for the purpose of attaching Sec-Fetch-* network headers.
		return false;
	}
	return isLoopbackHost(url.hostname);
}

function isLoopbackHost(hostname: string): boolean {
	if (hostname === "localhost" || hostname === "localhost.") return true;
	if (hostname.endsWith(".localhost") || hostname.endsWith(".localhost.")) {
		return true;
	}
	if (hostname === "[::1]" || hostname === "::1") return true;
	// Match 127.0.0.0/8 (any 127.x.y.z address).
	if (/^127\.(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})$/.test(hostname)) {
		return true;
	}
	return false;
}

/**
 * Compute the immediate Sec-Fetch-Site relation between an initiator origin and
 * a destination URL.
 *
 * - "same-origin" if scheme + host + port match exactly.
 * - "same-site" if scheme matches and the registrable domains match.
 * - "cross-site" otherwise.
 */
export function computeFetchSite(
	originUrl: URL,
	destUrl: URL
): "same-origin" | "same-site" | "cross-site" {
	if (
		originUrl.protocol === destUrl.protocol &&
		originUrl.host === destUrl.host
	) {
		return "same-origin";
	}
	if (
		originUrl.protocol === destUrl.protocol &&
		registrableDomain(originUrl.hostname) ===
			registrableDomain(destUrl.hostname)
	) {
		return "same-site";
	}
	return "cross-site";
}

/**
 * Combine two Sec-Fetch-Site classifications, returning the "worst" (least
 * trusted) of the two. Used when propagating state through redirect chains.
 */
export function worstFetchSite(
	a: "none" | "same-origin" | "same-site" | "cross-site",
	b: "none" | "same-origin" | "same-site" | "cross-site"
): "none" | "same-origin" | "same-site" | "cross-site" {
	const order = { "cross-site": 0, "same-site": 1, "same-origin": 2, none: 3 };
	return order[a] <= order[b] ? a : b;
}

/**
 * Compute the SameSite enforcement context for a request.
 *
 * "strict"     – same-site or no known origin (allow all cookies)
 * "lax"        – cross-site top-level GET/HEAD navigation (block Strict)
 * "cross-site" – cross-site subresource or non-safe-method navigation (block Strict+Lax)
 */
function computeSameSiteContext(
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	rawOriginUrl: URL | undefined
): "strict" | "lax" | "cross-site" {
	// If a redirect chain previously passed through a cross-site origin, the
	// final request is always treated as cross-site regardless of its destination.
	if (parsed.crossSiteRedirect) {
		const isNavigation =
			parsed.destination === "document" || parsed.destination === "iframe";
		const isSafeMethod = request.method === "GET" || request.method === "HEAD";
		return isNavigation && isSafeMethod ? "lax" : "cross-site";
	}

	if (!rawOriginUrl) return "strict";

	const originSite = registrableDomain(rawOriginUrl.hostname);
	const targetSite = registrableDomain(parsed.url.hostname);

	// Same site → no SameSite restrictions
	if (originSite === targetSite) return "strict";

	// Cross-site request: check if it's a navigational GET/HEAD (lax) or subresource/POST (cross-site)
	const isNavigation =
		parsed.destination === "document" || parsed.destination === "iframe";
	const isSafeMethod = request.method === "GET" || request.method === "HEAD";

	if (isNavigation && isSafeMethod) return "lax";
	return "cross-site";
}

/**
 * Compute the "registrable domain" (eTLD+1) of a hostname for same-site comparison.
 * This is a simplified implementation that handles common test cases
 * (localhost, IPs, and typical domain structures) without a full PSL lookup.
 */
function registrableDomain(hostname: string): string {
	// IPv4 / IPv6: site = exact IP
	if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return hostname;

	const labels = hostname.split(".");
	if (labels.length <= 1) return hostname; // bare hostname like "localhost"

	// Strip a leading "www." for same-site comparison so that
	// www.example.com and example.com are treated as the same site.
	// More complex cases (e.g. s1.s2.example.co.uk) are not handled here
	// but are uncommon in test environments.
	if (labels[0] === "www") return labels.slice(1).join(".");

	// For two-label hostnames like "example.com", use as-is
	if (labels.length === 2) return hostname;

	// For longer hostnames, use the last two labels as a rough eTLD+1
	return labels.slice(-2).join(".");
}
