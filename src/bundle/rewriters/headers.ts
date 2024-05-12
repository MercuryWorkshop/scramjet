import { encodeUrl } from "./url";
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
];

const urlHeaders = [
    "location",
    "content-location",
    "referer"
];

export function rewriteHeaders(rawHeaders: BareHeaders, origin?: string) {
    const headers = {};
    for (const key in rawHeaders) {
        headers[key.toLowerCase()] = rawHeaders[key];
    }
    cspHeaders.forEach((header) => {
        delete headers[header];
    });

    urlHeaders.forEach((header) => {
        if (headers[header])
            headers[header] = encodeUrl(headers[header] as string, origin);
    })

    return headers;
}