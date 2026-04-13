import { rewriteCss, rewriteUrl } from "@mercuryworkshop/scramjet";
import { directTest, type Test } from "../testcommon.ts";

function createRewriteContext() {
	const context = {
		config: {},
		prefix: new URL("https://proxy.test/service/"),
		interface: {
			codecEncode: encodeURIComponent,
			codecDecode: decodeURIComponent,
			getInjectScripts: () => [],
		},
		cookieJar: {},
	} as any;

	const meta = {
		origin: new URL("https://example.com"),
		base: new URL("https://example.com/css/app.css"),
		clientId: "runway-cid",
	} as any;

	return { context, meta };
}

function cssRewriteTest(props: {
	name: string;
	url: string;
	fn: (url: string, encoded: string) => [string, string];
}) {
	const { name, url, fn } = props;
	return directTest({
		name,
		fn: ({ assertEqual }) => {
			const { context, meta } = createRewriteContext();
			const encoded = rewriteUrl(url, context, meta);
			const [input, expected] = fn(url, encoded);
			const rewritten = rewriteCss(input, context, meta);
			assertEqual(
				rewritten,
				expected,
				`${name}: ${input} should be rewritten to ${expected}`
			);
		},
	});
}

function cssRewriteMultiTest(props: {
	name: string;
	input: string;
	urls: string[];
}): Test {
	const { name, input, urls } = props;
	return directTest({
		name,
		fn: ({ assertEqual }) => {
			const { context, meta } = createRewriteContext();
			let expected = input;
			for (const u of urls) {
				const enc = rewriteUrl(u, context, meta);
				expected = expected.split(u).join(enc);
			}
			assertEqual(
				rewriteCss(input, context, meta),
				expected,
				`${name}: multi-url rewrite`
			);
		},
	});
}

export default [
	cssRewriteTest({
		name: "rewriter-css-url",
		url: "/assets/bg.png",
		fn: (url, encoded) => [
			`body{background:url("${url}")}`,
			`body{background:url("${encoded}")}`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-string",
		url: "/styles/theme.css",
		fn: (url, encoded) => [
			`@import "/styles/theme.css";`,
			`@import "${encoded}";`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url",
		url: "/styles/theme.css",
		fn: (url, encoded) => [
			`@import url("/styles/theme.css");`,
			`@import url("${encoded}");`,
		],
	}),
	// below tests were llm generated
	cssRewriteTest({
		name: "rewriter-css-import-quoted-string-layer-block",
		url: "/tokens.css",
		fn: (url, encoded) => [
			`@import "${url}" layer(design);`,
			`@import "${encoded}" layer(design);`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url-function-layer-block",
		url: "/base.css",
		fn: (url, encoded) => [
			`@import url("${url}") layer(base);`,
			`@import url("${encoded}") layer(base);`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url-function-layer-keyword",
		url: "/reset.css",
		fn: (url, encoded) => [
			`@import url("${url}") layer;`,
			`@import url("${encoded}") layer;`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url-function-supports",
		url: "/grid.css",
		fn: (url, encoded) => [
			`@import url("${url}") supports(display: grid);`,
			`@import url("${encoded}") supports(display: grid);`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url-function-media-list",
		url: "/narrow.css",
		fn: (url, encoded) => [
			`@import url("${url}") screen and (min-width: 400px);`,
			`@import url("${encoded}") screen and (min-width: 400px);`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url-layer-supports-media",
		url: "/bundle.css",
		fn: (url, encoded) => [
			`@import url("${url}") layer(theme) supports(display: grid) screen, print;`,
			`@import url("${encoded}") layer(theme) supports(display: grid) screen, print;`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-single-quoted-url-layer",
		url: "/alt.css",
		fn: (url, encoded) => [
			`@import url('${url}') layer(alt);`,
			`@import url('${encoded}') layer(alt);`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-quoted-string-layer-keyword",
		url: "/legacy.css",
		fn: (url, encoded) => [
			`@import "${url}" layer;`,
			`@import "${encoded}" layer;`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-url-supports-with-or-condition",
		url: "/flex.css",
		fn: (url, encoded) => [
			`@import url("${url}") supports((display: flex) or (display: grid));`,
			`@import url("${encoded}") supports((display: flex) or (display: grid));`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-url-single-quotes",
		url: "/assets/icon.svg",
		fn: (url, encoded) => [
			`li{list-style:url('${url}')}`,
			`li{list-style:url('${encoded}')}`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-url-unquoted",
		url: "/img/x.png",
		fn: (url, encoded) => [
			`p{background-image:url(${url})}`,
			`p{background-image:url(${encoded})}`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-url-whitespace-trimmed",
		url: "/w.png",
		fn: (url, encoded) => [
			`a{background:url(  ${url}  )}`,
			`a{background:url(${encoded})}`,
		],
	}),
	cssRewriteMultiTest({
		name: "rewriter-css-multiple-url-same-rule",
		input: `a{background:url(/a.png), url(/b.png) 1x, url(/c.png) 2x;}`,
		urls: ["/a.png", "/b.png", "/c.png"],
	}),
	cssRewriteTest({
		name: "rewriter-css-double-quoted-url-close-paren-in-string",
		url: "https://example.com/asset)name.png",
		fn: (url, encoded) => [
			`x{background:url("${url}")}`,
			`x{background:url("${encoded}")}`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-single-quoted",
		url: "/styles/other.css",
		fn: (url, encoded) => [`@import '${url}';`, `@import '${encoded}';`],
	}),
	cssRewriteTest({
		name: "rewriter-css-import-string-trailing-space",
		url: "/late.css",
		fn: (url, encoded) => [`@import "${url}" ;`, `@import "${encoded}" ;`],
	}),
	directTest({
		name: "rewriter-css-data-url-prefixed-not-corrupted",
		fn: ({ assertEqual }) => {
			const { context, meta } = createRewriteContext();
			const data =
				'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>';
			const enc = rewriteUrl(data, context, meta);
			const input = `i{background:url(${data})}`;
			assertEqual(
				rewriteCss(input, context, meta),
				`i{background:url(${enc})}`,
				"data: URLs must survive rewrite (commas/quotes inside payload)"
			);
		},
	}),
	directTest({
		name: "rewriter-css-about-url-left-unproxied",
		fn: ({ assertEqual }) => {
			const { context, meta } = createRewriteContext();
			const input = `f{behavior:url(about:blank)}`;
			assertEqual(rewriteCss(input, context, meta), input);
		},
	}),
	cssRewriteTest({
		name: "rewriter-css-uppercase-url-function-should-rewrite",
		url: "/z.png",
		fn: (url, encoded) => [
			`b{background:URL("${url}")}`,
			`b{background:URL("${encoded}")}`,
		],
	}),
	cssRewriteTest({
		name: "rewriter-css-mixed-case-url-function-should-rewrite",
		url: "/z.png",
		fn: (url, encoded) => [
			`b{background:uRl("${url}")}`,
			`b{background:uRl("${encoded}")}`,
		],
	}),
	directTest({
		name: "rewriter-css-block-comment-should-not-rewrite-url",
		fn: ({ assertEqual }) => {
			const { context, meta } = createRewriteContext();
			const path = "/ghost.png";
			const input = `/* hint url(${path}) */ .x{}`;
			assertEqual(rewriteCss(input, context, meta), input);
		},
	}),
	cssRewriteTest({
		name: "rewriter-css-unquoted-https-url-encoded",
		url: "https://example.com/a.png?x=1",
		fn: (url, encoded) => [
			`body{background:url(${url})}`,
			`body{background:url(${encoded})}`,
		],
	}),
	directTest({
		name: "rewriter-css-empty-url-call-unchanged",
		fn: ({ assertEqual }) => {
			const { context, meta } = createRewriteContext();
			const input = "e{background:url()}";
			assertEqual(rewriteCss(input, context, meta), input);
		},
	}),
];
