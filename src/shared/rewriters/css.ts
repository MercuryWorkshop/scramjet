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
	css = css.replace(Atruleregex, (match, importStatement) => {
		return match.replace(
			importStatement,
			importStatement.replace(
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
			)
		);
	});

	return css;
}
