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
