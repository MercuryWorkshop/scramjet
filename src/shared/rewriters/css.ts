import { URLMeta, rewriteUrl, unrewriteUrl } from "@rewriters/url";

export function rewriteCss(css: string, meta: URLMeta) {
	return handleCss("rewrite", css, meta);
}

export function unrewriteCss(css: string) {
	return handleCss("unrewrite", css);
}

function handleCss(type: "rewrite" | "unrewrite", css: string, meta?: URLMeta) {
	// regex from vk6 (https://github.com/ading2210)
	const urlRegex = /url\(['"]?(.+?)['"]?\)/gm;
	css = new String(css).toString();
	css = css.replace(urlRegex, (match, url) => {
		const encodedUrl = rewriteCssUrl(type, url, meta);

		return match.replace(url, encodedUrl);
	});
	css = css.replace(
		/@import(\s+)([^;\n]+)(;?)/gm,
		(match, whitespace, clause, semicolon) => {
			const rewrittenClause = rewriteImportClause(type, clause, meta);
			if (!rewrittenClause) return match;

			return `@import${whitespace}${rewrittenClause}${semicolon}`;
		}
	);

	return css;
}

function rewriteCssUrl(
	type: "rewrite" | "unrewrite",
	url: string,
	meta?: URLMeta
) {
	return type === "rewrite"
		? rewriteUrl(url.trim(), meta)
		: unrewriteUrl(url.trim());
}

function rewriteImportClause(
	type: "rewrite" | "unrewrite",
	clause: string,
	meta?: URLMeta
) {
	const urlImportMatch = clause.match(
		/^url\(\s*(["']?)(.+?)\1\s*\)([\s\S]*)$/i
	);
	if (urlImportMatch) {
		const quote = urlImportMatch[1] || "";
		const url = urlImportMatch[2];
		const remainder = urlImportMatch[3] || "";
		const rewritten = rewriteCssUrl(type, url, meta);

		return `url(${quote}${rewritten}${quote})${remainder}`;
	}

	const quotedImportMatch = clause.match(/^(['"])(.+?)\1([\s\S]*)$/);
	if (quotedImportMatch) {
		const quote = quotedImportMatch[1];
		const url = quotedImportMatch[2];
		const remainder = quotedImportMatch[3] || "";
		const rewritten = rewriteCssUrl(type, url, meta);

		return `${quote}${rewritten}${quote}${remainder}`;
	}

	const bareImportMatch = clause.match(/^(\S+)([\s\S]*)$/);
	if (bareImportMatch) {
		const url = bareImportMatch[1];
		const remainder = bareImportMatch[2] || "";
		const rewritten = rewriteCssUrl(type, url, meta);

		return `${rewritten}${remainder}`;
	}

	return null;
}
