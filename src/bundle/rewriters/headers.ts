import { encodeUrl } from "./url";

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

export function rewriteHeaders(headers: Headers, origin?: string) {
    cspHeaders.forEach((header) => {
        if (headers.has(header)) {
            headers.delete(header);
        }
    });

    urlHeaders.forEach((header) => {
        if (headers.has(header)) {
            headers.set(header, encodeUrl(headers.get(header), origin));
        }
    });

    if (headers.has("link")) {
        let link = headers.get("link");
        
        link = link.replace(/<(.*?)>/g, (match, g1) => {
            return `<${encodeUrl(g1, origin)}>`;
        });

        headers.set("link", link);
    }
}