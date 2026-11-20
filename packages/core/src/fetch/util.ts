import { isHtmlMimeType, ScramjetHeaders } from "@/shared";
import { BareResponse } from "@mercuryworkshop/proxy-transports";
import { ScramjetFetchParsed } from ".";
import { _Set, _URL } from "@/shared/snapshot";
import { MAX_REFERRER_LENGTH } from "@rewriters/url";

export function normalizeContentType(
	parsed: ScramjetFetchParsed,
	headers: ScramjetHeaders
) {
	if (!isDocument(parsed)) return;

	const ct = headers.get("content-type");
	if (!ct) return;
	if (!isHtmlMimeType(ct)) return;

	headers.set("content-type", "text/html; charset=utf-8");
}

export function isRedirect(response: BareResponse) {
	return response.status >= 300 && response.status < 400;
}

export function isDocument(parsed: ScramjetFetchParsed) {
	return parsed.destination === "document" || parsed.destination === "iframe";
}

const REFERRER_POLICIES = new _Set([
	"no-referrer",
	"no-referrer-when-downgrade",
	"same-origin",
	"origin",
	"strict-origin",
	"origin-when-cross-origin",
	"strict-origin-when-cross-origin",
	"unsafe-url",
]);

/** The policy a request falls back to when nothing sets one. */
export const DEFAULT_REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * The Referer a request for `resource` sends when it comes from `source`
 * under `policy`, or "" for none.
 *
 * https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer
 * with Chrome's reading of it: a downgrade is going from https to anything
 * that is not https, rather than to something not potentially trustworthy.
 */
export function createReferrerString(
	source: URL,
	resource: URL,
	policy: string | null | undefined
): string {
	// only http(s) URLs are ever sent: about:, blob: and data: are dropped
	if (source.protocol !== "http:" && source.protocol !== "https:") return "";
	if (!policy || !REFERRER_POLICIES.has(policy)) {
		policy = DEFAULT_REFERRER_POLICY;
	}

	const stripped = new _URL(source.href);
	stripped.username = "";
	stripped.password = "";
	stripped.hash = "";

	const origin = stripped.origin + "/";
	let full = stripped.href;
	if (full.length > MAX_REFERRER_LENGTH) full = origin;

	const isDowngrade =
		stripped.protocol === "https:" &&
		resource.protocol !== "https:" &&
		resource.protocol !== "wss:";
	// blob: URLs carry the origin they were made in, data: URLs an opaque one
	const isSameOrigin = stripped.origin === resource.origin;

	switch (policy) {
		case "no-referrer":
			return "";
		case "no-referrer-when-downgrade":
			return isDowngrade ? "" : full;
		case "same-origin":
			return isSameOrigin ? full : "";
		case "origin":
			return origin;
		case "strict-origin":
			return isDowngrade ? "" : origin;
		case "origin-when-cross-origin":
			return isSameOrigin ? full : origin;
		case "strict-origin-when-cross-origin":
			if (isSameOrigin) return full;
			return isDowngrade ? "" : origin;
		case "unsafe-url":
			return full;
	}

	return "";
}
