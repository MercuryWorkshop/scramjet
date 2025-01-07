import { URLMeta, rewriteUrl } from "./url";
import { BareHeaders } from "@mercuryworkshop/bare-mux";
const cspHeaders = [
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
];

const urlHeaders = ["location", "content-location", "referer"];

function rewriteLinkHeader(link: string, meta: URLMeta) {
	return link.replace(/<(.*)>/gi, (match) => rewriteUrl(match, meta));
}

export function rewriteHeaders(rawHeaders: BareHeaders, meta: URLMeta) {
	const headers = {};

	for (const key in rawHeaders) {
		headers[key.toLowerCase()] = rawHeaders[key];
	}

	cspHeaders.forEach((header) => {
		delete headers[header];
	});

	urlHeaders.forEach((header) => {
		if (headers[header])
			headers[header] = rewriteUrl(headers[header]?.toString() as string, meta);
	});

	if (typeof headers["link"] === "string") {
		headers["link"] = rewriteLinkHeader(headers["link"], meta);
	} else if (Array.isArray(headers["link"])) {
		headers["link"] = headers["link"].map((link) =>
			rewriteLinkHeader(link, meta)
		);
	}

	return headers;
}
