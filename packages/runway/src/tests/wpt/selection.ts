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

/**
 * Tests in this set assert behaviour that fundamentally requires real
 * transient user activation (clicked anchor, form submit triggered from a
 * gesture, popped window from `window.open`, etc.). The runway harness can
 * only fake activation through CDP-level clicks which Chromium doesn't fully
 * honour for cross-frame nav requests, so these subtest assertions never
 * pass. The whole file is excluded rather than partially skipped, so the
 * `runway-bless` plumbing can stay deleted.
 */
const FETCH_METADATA_USER_ACTIVATION_GENERATED = new Set<string>([
	"fetch/metadata/generated/element-a.sub.html",
	"fetch/metadata/generated/element-a.https.sub.html",
	"fetch/metadata/generated/element-area.sub.html",
	"fetch/metadata/generated/element-area.https.sub.html",
	"fetch/metadata/generated/element-frame.sub.html",
	"fetch/metadata/generated/element-frame.https.sub.html",
	"fetch/metadata/generated/element-iframe.sub.html",
	"fetch/metadata/generated/element-iframe.https.sub.html",
	"fetch/metadata/generated/form-submission.sub.html",
	"fetch/metadata/generated/form-submission.https.sub.html",
	"fetch/metadata/generated/window-location.sub.html",
	"fetch/metadata/generated/window-location.https.sub.html",
]);

/**
 * Worklet-related fetch-metadata tests. Scramjet doesn't currently proxy
 * AudioWorklet / PaintWorklet module loads, so these can never pass; we
 * exclude them rather than vendor dead weight.
 */
const FETCH_METADATA_WORKLET_FILES = new Set<string>([
	"fetch/metadata/generated/audioworklet.https.sub.html",
	"fetch/metadata/audio-worklet.https.html",
	"fetch/metadata/paint-worklet.https.html",
]);

/**
 * Top-level (non-generated) `fetch/metadata/*.https.sub.html` and
 * `*.https.html` tests we vendor alongside the generated suite. These cover
 * scenarios the procedurally-generated tests don't (e.g. the page's own
 * navigation request, preload, style, track, etc.). Files known to require
 * real user activation (notably `window-open.https.sub.html`) and worklet
 * tests (audio/paint worklet — scramjet doesn't proxy worklets) are excluded.
 */
const FETCH_METADATA_PAGE_FILES = new Set<string>([
	"fetch/metadata/embed.https.sub.tentative.html",
	"fetch/metadata/navigation.https.sub.html",
	"fetch/metadata/object.https.sub.html",
	"fetch/metadata/preload.https.sub.html",
	"fetch/metadata/report.https.sub.html",
	"fetch/metadata/report.https.sub.html.sub.headers",
	"fetch/metadata/serviceworker-accessors.https.sub.html",
	"fetch/metadata/sharedworker.https.sub.html",
	"fetch/metadata/style.https.sub.html",
	"fetch/metadata/text.https.html",
	"fetch/metadata/track.https.sub.html",
	"fetch/metadata/unload.https.sub.html",
	"fetch/metadata/worker.https.sub.html",
]);

export function includeFetchMetadataGeneratedFile(relPath: string) {
	const normalized = normalize(relPath);
	if (FETCH_METADATA_USER_ACTIVATION_GENERATED.has(normalized)) return false;
	if (FETCH_METADATA_WORKLET_FILES.has(normalized)) return false;
	return (
		normalized.startsWith("fetch/metadata/generated/") &&
		normalized.includes(".sub.html")
	);
}

export function includeFetchMetadataPageFile(relPath: string) {
	const normalized = normalize(relPath);
	if (FETCH_METADATA_WORKLET_FILES.has(normalized)) return false;
	return FETCH_METADATA_PAGE_FILES.has(normalized);
}

export const FETCH_METADATA_PAGE_FILES_LIST = [
	...FETCH_METADATA_PAGE_FILES,
] as const;

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
