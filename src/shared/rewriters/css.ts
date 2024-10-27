import { URLMeta, rewriteUrl, unrewriteUrl } from "./url";

export function rewriteCss(css: string, meta: URLMeta) {
	return handleCss("unrewrite", css, meta);
}

export function unrewriteCss(css: string) {
	return handleCss("rewrite", css);
}

function handleCss(type: "rewrite" | "unrewrite", css: string, meta?: URLMeta) {
	const urlRegex = /url\(['"]?(.+?)['"]?\)/gm;
	const Atruleregex =
		/@import\s+(url\s*?\(.{0,9999}?\)|['"].{0,9999}?['"]|.{0,9999}?)($|\s|;)/gm;
	css = new String(css).toString();
	css = css.replace(urlRegex, (match, url) => {
		const encodedUrl =
			type === "rewrite"
				? rewriteUrl(url.trim(), meta)
				: unrewriteUrl(url.trim());

		return match.replace(url, encodedUrl);
	});
	css = css.replace(Atruleregex, (_, importStatement) => {
		return importStatement.replace(
			/^(url\(['"]?|['"]|)(.+?)(['"]|['"]?\)|)$/gm,
			(match, firstQuote, url, endQuote) => {
				if (firstQuote.startsWith("url")) {
					return match;
				}
				const encodedUrl =
					type === "rewrite"
						? rewriteUrl(url.trim(), meta)
						: unrewriteUrl(url.trim());

				return `${firstQuote}${encodedUrl}${endQuote}`;
			}
		);
	});

	return css;
}
