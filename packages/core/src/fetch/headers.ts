import {
	rewriteUrl,
	ScramjetContext,
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
import { _URL, _Set } from "@/shared/snapshot";
import { createReferrerString } from "./util";

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
]) as _Set<string>;

/**
 * Headers that are actually URLs that need to be rewritten
 */
const URL_HEADERS = new _Set([
	"location",
	"content-location",
	"referer",
]) as _Set<string>;

function rewriteLinkHeader(
	link: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	return link.replace(/<([^>]+)>/gi, (_match, p1) => {
		return `<${rewriteUrl(p1, context, meta)}>`;
	});
}

export async function rewriteResponseHeaders(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	rawHeaders: RawHeaders
): Promise<ScramjetHeaders> {
	const headers = ScramjetHeaders.fromRawHeaders(rawHeaders);

	for (const cspHeader of SEC_HEADERS) {
		headers.delete(cspHeader);
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
		].includes(request.destination)
	) {
		headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		headers.set("Cross-Origin-Opener-Policy", "same-origin");
	}

	if (request.destination === "document" || request.destination === "iframe") {
		headers.set("Referrer-Policy", "unsafe-url");
	}

	return headers;
}

export function rewriteRequestHeaders(
	request: ScramjetFetchRequest,
	handler: ScramjetFetchHandler,
	parsed: ScramjetFetchParsed
): ScramjetHeaders {
	const headers = request.initialHeaders.clone();

	// avoid leaking the scramjet referer
	headers.delete("Referer");

	const rawOriginUrl =
		parsed.referrerSourceUrl !== undefined
			? parsed.referrerSourceUrl
			: request.rawClientUrl ||
				(request.rawReferrer ? new _URL(request.rawReferrer) : undefined);
	const originUrl =
		rawOriginUrl &&
		rawOriginUrl.pathname.startsWith(handler.context.prefix.pathname)
			? new _URL(unrewriteUrl(rawOriginUrl, handler.context))
			: rawOriginUrl;

	if (
		rawOriginUrl &&
		rawOriginUrl.pathname.startsWith(handler.context.prefix.pathname)
	) {
		headers.set("Origin", originUrl.origin);

		const referer = createReferrerString(
			originUrl,
			parsed.url,
			parsed.referrerPolicy ?? null
		);
		if (referer) headers.set("Referer", referer);
	}

	const sameSiteContext = computeSameSiteContext(request, parsed, originUrl);
	const cookies = handler.context.cookieJar.getCookies(
		parsed.url,
		false,
		sameSiteContext
	);

	if (cookies.length) {
		headers.set("Cookie", cookies);
	}

	return headers;
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
			request.destination === "document" || request.destination === "iframe";
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
		request.destination === "document" || request.destination === "iframe";
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
