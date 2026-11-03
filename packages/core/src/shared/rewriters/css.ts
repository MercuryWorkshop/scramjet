import { URLMeta, rewriteUrl, unrewriteUrl } from "@rewriters/url";
import { ScramjetContext } from "@/shared";
import { String } from "@/shared/snapshot";

export function fixOverflow(css: string): string {
    return css.replace(
        /(\bbody\s*\{[^{}]*?\boverflow-y\s*:\s*)scroll\b/gi,
        "$1auto"
    );
}

export function rewriteCss(
	css: string,
	context: ScramjetContext,
	meta: URLMeta
) {
  const rewritten = handleCss("rewrite", css, context, meta);

  const hostname = meta.origin.hostname.toLowerCase();

  if (
      hostname !== "www.youtube.com" &&
      hostname !== "youtube.com" &&
      hostname !== "m.youtube.com"
  ) {
      return rewritten;
  }

  return fixOverflow(rewritten);
}

export function unrewriteCss(css: string, context: ScramjetContext) {
	return handleCss("unrewrite", css, context);
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
	css = css.replace(
		urlRegex,
		(
			match,
			doubleQuotedUrl: string | undefined,
			singleQuotedUrl: string | undefined,
			unquotedUrl: string | undefined
		) => {
			const url = doubleQuotedUrl ?? singleQuotedUrl ?? unquotedUrl;
			const encodedUrl =
				type === "rewrite"
					? rewriteUrl(url.trim(), context, meta!)
					: unrewriteUrl(url.trim(), context);

			return match.replace(url, encodedUrl);
		}
	);
	css = css.replace(Atruleregex, (match, importStatement: string) => {
		return match.replace(
			importStatement,
			importStatement.replace(
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
			)
		);
	});

	return css;
}
