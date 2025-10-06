import type {
	default as BareClient,
	BareHeaders,
} from "@mercuryworkshop/bare-mux";
import { rewriteUrl, type URLMeta } from "@rewriters/url";
import { getSiteDirective } from "@/shared/security/siteTests";

interface StoredReferrerPolicies {
	get(url: string): Promise<{ policy: string; referrer: string } | null>;
	set(url: string, policy: string, referrer: string): Promise<void>;
}

/**
 * Headers for security policy features that haven't been emulated yet
 */
const SEC_HEADERS = new Set([
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
]);

/**
 * Headers that are actually URLs that need to be rewritten
 */
const URL_HEADERS = new Set(["location", "content-location", "referer"]);

function rewriteLinkHeader(link: string, meta: URLMeta) {
	return link.replace(/<(.*)>/gi, (match) => rewriteUrl(match, meta));
}

/**
 * Rewrites response headers
 * @param rawHeaders Headers before they were rewritten
 * @param meta Parsed Proxy URL
 * @param client `BareClient` instance used for fetching
 * @param isNavigationRequest Whether the request is a navigation request
 */
export async function rewriteHeaders(
	rawHeaders: BareHeaders,
	meta: URLMeta,
	client: BareClient,
	storedReferrerPolicies: StoredReferrerPolicies
) {
	const headers = {};

	for (const key in rawHeaders) {
		headers[key.toLowerCase()] = rawHeaders[key];
	}

	for (const cspHeader of SEC_HEADERS) {
		delete headers[cspHeader];
	}

	for (const urlHeader of URL_HEADERS) {
		if (headers[urlHeader])
			headers[urlHeader] = rewriteUrl(
				headers[urlHeader]?.toString() as string,
				meta
			);
	}

	if (typeof headers["link"] === "string") {
		headers["link"] = rewriteLinkHeader(headers["link"], meta);
	} else if (Array.isArray(headers["link"])) {
		headers["link"] = headers["link"].map((link) =>
			rewriteLinkHeader(link, meta)
		);
	}

	// Emulate the referrer policy to set it back to what it should've been without Force Referrer in place
	if (typeof headers["referer"] === "string") {
		const referrerUrl = new URL(headers["referer"]);
		const storedPolicyData = await storedReferrerPolicies.get(referrerUrl.href);
		if (storedPolicyData) {
			const storedReferrerPolicy = storedPolicyData.policy
				.toLowerCase()
				.split(",")
				.map((rawDir) => rawDir.trim());
			if (
				storedReferrerPolicy.includes("no-referrer") ||
				(storedReferrerPolicy.includes("no-referrer-when-downgrade") &&
					meta.origin.protocol === "http:" &&
					referrerUrl.protocol === "https:")
			) {
				delete headers["referer"];
			} else if (storedReferrerPolicy.includes("origin")) {
				headers["referer"] = referrerUrl.origin;
			} else if (storedReferrerPolicy.includes("origin-when-cross-origin")) {
				if (referrerUrl.origin !== meta.origin.origin) {
					headers["referer"] = referrerUrl.origin;
				} else {
					headers["referer"] = referrerUrl.href;
				}
			} else if (storedReferrerPolicy.includes("same-origin")) {
				if (referrerUrl.origin === meta.origin.origin) {
					headers["referer"] = referrerUrl.href;
				} else {
					delete headers["referer"];
				}
			} else if (storedReferrerPolicy.includes("strict-origin")) {
				if (
					meta.origin.protocol === "http:" &&
					referrerUrl.protocol === "https:"
				) {
					delete headers["referer"];
				} else {
					headers["referer"] = referrerUrl.origin;
				}
			}
			// `strict-origin-when-cross-origin` is the default behavior anyway
			else {
				if (referrerUrl.origin === meta.origin.origin) {
					headers["referer"] = referrerUrl.href;
				} else if (
					meta.origin.protocol === "http:" &&
					referrerUrl.protocol === "https:"
				) {
					delete headers["referer"];
				} else {
					headers["referer"] = referrerUrl.origin;
				}
			}
		}
	}
	if (
		typeof headers["sec-fetch-dest"] === "string" &&
		headers["sec-fetch-dest"] === ""
	) {
		headers["sec-fetch-dest"] = "empty";
	}

	if (
		typeof headers["sec-fetch-site"] === "string" &&
		headers["sec-fetch-site"] !== "none"
	) {
		if (typeof headers["referer"] === "string") {
			headers["sec-fetch-site"] = await getSiteDirective(
				meta,
				new URL(headers["referer"]),
				client
			);
		} else {
			console.warn(
				"Missing referrer header; can't rewrite sec-fetch-site properly. Falling back to unsafe deletion."
			);
			delete headers["sec-fetch-site"];
		}
	}

	return headers;
}
