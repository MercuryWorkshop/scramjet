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
    "Location",
    "content-location",
    "referer"
];

export function rewriteHeaders(headers: BareHeaders, origin?: string) {
    cspHeaders.forEach((header) => {
        delete headers[header];
        delete headers[header.toLowerCase()];
    });

    urlHeaders.forEach((header) => {
        if (headers[header]) {
            headers[header] = encodeUrl(headers[header] as string, origin);
        } else if (headers[header.toLowerCase()]) {
            headers[header.toLowerCase()] = encodeUrl(headers[header.toLowerCase()] as string, origin);
        }
    })

    return headers;
}