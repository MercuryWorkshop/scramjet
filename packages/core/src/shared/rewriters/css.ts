import {
	URLMeta,
	isFragmentOnly,
	rewriteUrl,
	unrewriteUrl,
} from "@rewriters/url";
import { ScramjetContext } from "@/shared";
import { RegExp_exec, String } from "@/shared/snapshot";

export function rewriteCss(
	css: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	return handleCss("rewrite", css, context, meta);
}

export function unrewriteCss(css: string, context: ScramjetContext) {
	return handleCss("unrewrite", css, context);
}

/**
 * Whether `css` has anything {@link handleCss} would change: a `url(` or an
 * `@import`, as its two expressions spell them. Most of what goes through here
 * - an animation's `transform`, a `--var` - has neither, and both expressions
 * cost far more than this to run over it.
 */
const mayHoldUrl = /(?i:url)\(|@import/;

export function cssMayHoldUrl(css: string): boolean {
	return RegExp_exec(mayHoldUrl, css) !== null;
}

function handleCss(
	type: "rewrite" | "unrewrite",
	css: string,
	context: ScramjetContext,
	meta?: URLMeta
) {
	// regex from vk6 (https://github.com/ading2210)
	const urlRegex =
		/(?i:url)\((?:\s*"((?:\\.|[^"])+)"\s*|\s*'((?:\\.|[^'])+)'\s*|((?!\s*['"])(?!\s*\))(?:\\.|[^)])+?))\)/gm;
	const Atruleregex =
		/@import\s+((?i:url)\s*?\(.{0,9999}?\)|['"].{0,9999}?['"]|.{0,9999}?)($|\s|;)/gm;
	css = String(css);
	if (!cssMayHoldUrl(css)) return css;
	css = css.replace(
		urlRegex,
		(
			match,
			doubleQuotedUrl: string | undefined,
			singleQuotedUrl: string | undefined,
			unquotedUrl: string | undefined
		) => {
			const url = doubleQuotedUrl ?? singleQuotedUrl ?? unquotedUrl;

			// https://drafts.csswg.org/css-values-4/#local-urls - a URL whose
			// first character is `#` is a reference to an element in the
			// document that uses the style (an SVG gradient, clip path, mask,
			// filter or marker). It is never resolved against a base, so a
			// rewritten one is an external resource that never renders
			if (isFragmentOnly(url)) return match;

			const encodedUrl =
				type === "rewrite"
					? rewriteUrl(url.trim(), context, meta!)
					: unrewriteUrl(url.trim(), context);

			// a callback - see the @import rewrite below
			return match.replace(url, () => encodedUrl);
		}
	);
	css = css.replace(Atruleregex, (match, importStatement: string) => {
		const rewritten = importStatement.replace(
			/^(url\(['"]?|['"]|)(.+?)(['"]|['"]?\)|)$/gm,
			(match: string, firstQuote: string, url: string, endQuote: string) => {
				if (firstQuote.startsWith("url")) {
					return match;
				}
				const encodedUrl =
					type === "rewrite"
						? rewriteUrl(url.trim(), context, meta!)
						: unrewriteUrl(url.trim(), context);

				return `${firstQuote}${encodedUrl}${endQuote}`;
			}
		);

		// a callback, not the string: a fragment is not percent-encoded, and
		// `$` in it would be read as a replacement pattern
		return match.replace(importStatement, () => rewritten);
	});

	return css;
}
