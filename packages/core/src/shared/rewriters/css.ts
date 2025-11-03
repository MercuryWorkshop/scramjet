import { URLMeta, rewriteUrl, unrewriteUrl } from "@rewriters/url";
import { ScramjetContext } from "@/shared";

export function rewriteCss(
	css: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	return handleCss("rewrite", css, context, meta);
}

export function unrewriteCss(css: string) {
	return handleCss("unrewrite", css);
}

function handleCss(
	type: "rewrite" | "unrewrite",
	css: string,
	context?: ScramjetContext,
	meta?: URLMeta
) {
	// regex from vk6 (https://github.com/ading2210)
	const urlRegex = /url\(['"]?(.+?)['"]?\)/gm;
	const Atruleregex =
		/@import\s+(url\s*?\(.{0,9999}?\)|['"].{0,9999}?['"]|.{0,9999}?)($|\s|;)/gm;
	css = new String(css).toString();
	css = css.replace(urlRegex, (match, url) => {
		const encodedUrl =
			type === "rewrite"
				? rewriteUrl(url.trim(), context, meta)
				: unrewriteUrl(url.trim(), context);

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
							? rewriteUrl(url.trim(), context, meta)
							: unrewriteUrl(url.trim(), context);

					return `${firstQuote}${encodedUrl}${endQuote}`;
				}
			)
		);
	});

	return css;
}
