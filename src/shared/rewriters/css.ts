// This CSS rewriter uses code from Meteor
// You can find the original source code at https://github.com/MeteorProxy/Meteor

import { URLMeta, rewriteUrl, unrewriteUrl } from "./url";

export function rewriteCss(css: string, meta: URLMeta) {
	const regex =
		/(@import\s+(?!url\())?\s*url\(\s*(['"]?)([^'")]+)\2\s*\)|@import\s+(['"])([^'"]+)\4/g;

	return css.replace(
		regex,
		(
			match,
			importStatement,
			urlQuote,
			urlContent,
			importQuote,
			importContent
		) => {
			const url = urlContent || importContent;
			const encodedUrl = rewriteUrl(url.trim(), meta);

			if (importStatement) {
				return `@import url(${urlQuote}${encodedUrl}${urlQuote})`;
			}

			if (importQuote) {
				return `@import ${importQuote}${encodedUrl}${importQuote}`;
			}

			return `url(${urlQuote}${encodedUrl}${urlQuote})`;
		}
	);
}

export function unrewriteCss(css: string) {
	const regex =
		/(@import\s+(?!url\())?\s*url\(\s*(['"]?)([^'")]+)\2\s*\)|@import\s+(['"])([^'"]+)\4/g;

	return css.replace(
		regex,
		(
			match,
			importStatement,
			urlQuote,
			urlContent,
			importQuote,
			importContent
		) => {
			const url = urlContent || importContent;
			const encodedUrl = unrewriteUrl(url.trim());

			if (importStatement) {
				return `@import url(${urlQuote}${encodedUrl}${urlQuote})`;
			}

			if (importQuote) {
				return `@import ${importQuote}${encodedUrl}${importQuote}`;
			}

			return `url(${urlQuote}${encodedUrl}${urlQuote})`;
		}
	);
}
