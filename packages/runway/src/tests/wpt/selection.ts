function normalize(relPath: string) {
	return relPath.replaceAll("\\", "/");
}

export const REFERRER_GENERATED_ROOTS = [
	"referrer-policy/gen/iframe.http-rp/",
	"referrer-policy/gen/iframe.meta/",
	"referrer-policy/gen/top.http-rp/",
	"referrer-policy/gen/top.meta/",
];

export const REFERRER_INHERITANCE_PAGES = [
	"referrer-policy/generic/inheritance/iframe-inheritance-about-blank.html",
	"referrer-policy/generic/inheritance/iframe-inheritance-srcdoc.html",
];

export function includeReferrerGeneratedFile(relPath: string) {
	const normalized = normalize(relPath);
	return (
		REFERRER_GENERATED_ROOTS.some((root) => normalized.startsWith(root)) &&
		(normalized.endsWith(".html") || normalized.endsWith(".headers"))
	);
}

export function includeFetchMetadataGeneratedFile(relPath: string) {
	const normalized = normalize(relPath);
	return (
		normalized.startsWith("fetch/metadata/generated/") &&
		normalized.includes(".sub.html")
	);
}

export const COOKIE_WPT_FILES = [
	"cookies/attributes/expires.html",
	"cookies/attributes/invalid.html",
	"cookies/attributes/max-age.html",
	"cookies/domain/domain-attribute-missing.sub.html",
	"cookies/domain/domain-attribute-missing.sub.html.headers",
	"cookies/encoding/charset.html",
	"cookies/name/name-ctl.html",
	"cookies/name/name.html",
	"cookies/path/default.html",
	"cookies/path/match.html",
	"cookies/resources/cookie-helper.sub.js",
	"cookies/resources/cookie-test.js",
	"cookies/resources/cookie.py",
	"cookies/resources/drop.py",
	"cookies/resources/echo-cookie.html",
	"cookies/resources/echo-json.py",
	"cookies/resources/list.py",
	"cookies/resources/set-cookie.py",
	"cookies/resources/set.py",
	"cookies/resources/testharness-helpers.js",
	"cookies/value/value-ctl.html",
	"cookies/value/value.html",
	// Prefix tests — HTTPS variants only (non-HTTPS variants test rejection on HTTP, which we skip)
	"cookies/prefix/__host.document-cookie.https.html",
	"cookies/prefix/__host.header.https.html",
	"cookies/prefix/__secure.document-cookie.https.html",
	"cookies/prefix/__secure.header.https.html",
	// Size tests
	"cookies/size/name-and-value.html",
	// SameSite test pages (all .https.html — run over HTTP since Scramjet treats all as HTTPS)
	"cookies/samesite/fetch.https.html",
	"cookies/samesite/iframe.https.html",
	"cookies/samesite/iframe.document.https.html",
	"cookies/samesite/iframe-reload.https.html",
	"cookies/samesite/img.https.html",
	"cookies/samesite/form-get-blank.https.html",
	"cookies/samesite/form-post-blank.https.html",
	"cookies/samesite/form-get-blank-reload.https.html",
	"cookies/samesite/form-post-blank-reload.https.html",
	"cookies/samesite/window-open.https.html",
	"cookies/samesite/window-open-reload.https.html",
	"cookies/samesite/about-blank-toplevel.https.html",
	"cookies/samesite/about-blank-nested.https.html",
	"cookies/samesite/about-blank-subresource.https.html",
	"cookies/samesite/sandbox-iframe-nested.https.html",
	"cookies/samesite/sandbox-iframe-subresource.https.html",
	"cookies/samesite/setcookie-lax.https.html",
	"cookies/samesite/setcookie-navigation.https.html",
	"cookies/samesite/multiple-samesite-attributes.https.html",
	// SameSite resources (loaded by the test pages above, not run directly)
	"cookies/samesite/resources/puppet.html",
	"cookies/samesite/resources/echo-cookies.html",
	"cookies/samesite/resources/navigate.html",
	"cookies/samesite/resources/navigate-iframe.html",
	"cookies/samesite/resources/iframe.document.html",
	"cookies/samesite/resources/iframe-navigate-report.html",
	"cookies/samesite/resources/iframe-subresource-report.html",
] as const;

const COOKIE_WPT_FILE_SET = new Set(COOKIE_WPT_FILES);

export const COOKIE_WPT_PAGES = COOKIE_WPT_FILES.filter(
	(file) =>
		file.endsWith(".html") &&
		!file.includes("/resources/") &&
		!file.endsWith(".headers")
);

export function includeCookieFile(relPath: string) {
	return COOKIE_WPT_FILE_SET.has(
		normalize(relPath) as (typeof COOKIE_WPT_FILES)[number]
	);
}
