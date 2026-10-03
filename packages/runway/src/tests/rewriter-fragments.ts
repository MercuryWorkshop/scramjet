import {
	canHaveItsURLRewritten,
	isFragmentOnly,
	rewriteCss,
	rewriteHistoryUrl,
	rewriteUrl,
	splitFragment,
	unrewriteCss,
	unrewriteUrl,
} from "@mercuryworkshop/scramjet/bundled";
import { directTest, type Test } from "../testcommon.ts";

/**
 * The fragment handling in the URL rewriter, in process. `fragments.ts` checks
 * the same behaviour end to end against the browser.
 */

/* eslint-disable quotes -- CSS with both kinds of quote in it */

const prefix = "https://proxy.test/service/";
const context = {
	config: {},
	prefix: new URL(prefix),
	interface: {
		codecEncode: encodeURIComponent,
		codecDecode: decodeURIComponent,
		getInjectScripts: () => [],
	},
	cookieJar: {},
} as any;

/** a document at https://example.com/page?q=1, loaded by another site */
const raw =
	prefix +
	encodeURIComponent("https://example.com/page?q=1") +
	"?%24io=https%3A%2F%2Fother.test";
const meta = () =>
	({
		origin: new URL("https://example.com/page?q=1#now"),
		base: new URL("https://example.com/page?q=1#now"),
		rawUrl: raw + "#now",
	}) as any;

export default [
	directTest({
		name: "rewriter-fragment-split",
		fn: ({ assertEqual }) => {
			const cases: [string, [string, string | null]][] = [
				["https://a.test/p", ["https://a.test/p", null]],
				["https://a.test/p#", ["https://a.test/p", "#"]],
				["https://a.test/p#x#y", ["https://a.test/p", "#x#y"]],
				["https://a.test/p?q=%23#x", ["https://a.test/p?q=%23", "#x"]],
			];
			for (const [href, expected] of cases) {
				assertEqual(
					JSON.stringify(splitFragment(href)),
					JSON.stringify(expected),
					href
				);
			}
		},
	}),

	directTest({
		name: "rewriter-fragment-only",
		fn: ({ assertEqual }) => {
			const cases: [string, boolean][] = [
				["#x", true],
				["#", true],
				["  #x", true],
				["\t\n#x", true],
				["\u0000#x", true],
				["x#y", false],
				["/#x", false],
				["", false],
				[" #x", false],
			];
			for (const [url, expected] of cases) {
				assertEqual(isFragmentOnly(url), expected, JSON.stringify(url));
			}
		},
	}),

	directTest({
		name: "rewriter-fragment-verbatim",
		fn: ({ assertEqual }) => {
			// the fragment is not put through the codec, in either direction
			for (const fragment of [
				"#a/b",
				"#a%2Fb",
				"#%",
				"#caf%C3%A9",
				"#:~:text=x",
				"#",
				"#a#b",
			]) {
				const url = "https://example.com/x" + fragment;
				const rewritten = rewriteUrl(url, context, meta());
				assertEqual(
					splitFragment(rewritten)[1],
					fragment,
					"rewritten " + fragment
				);
				assertEqual(
					unrewriteUrl(rewritten, context),
					url,
					"round trip " + fragment
				);
			}
			assertEqual(
				splitFragment(rewriteUrl("https://example.com/x", context, meta()))[1],
				null,
				"no fragment"
			);
		},
	}),

	directTest({
		name: "rewriter-fragment-same-document",
		fn: ({ assertEqual, assert }) => {
			const nav = (url: string) =>
				rewriteUrl(url, context, meta(), { navigateType: "location" });
			// the document's own URL, fragment or not, goes to its real URL
			assertEqual(nav("#x"), raw + "#x", "#x");
			assertEqual(nav("#"), raw + "#", "#");
			assertEqual(
				nav("https://example.com/page?q=1#y"),
				raw + "#y",
				"absolute"
			);
			// without a fragment it loads a new document, with this one as the
			// initiator rather than the one that loaded it
			assert(!nav("?q=1").startsWith(raw), "the same URL without a fragment");
			assert(
				!nav("https://example.com/page?q=1").startsWith(raw),
				"absolute, without a fragment"
			);
			// anything else is a fresh rewrite
			assert(!nav("?q=2#x").startsWith(raw), "another query");
			assert(!nav("/other#x").startsWith(raw), "another path");
			// only a navigation is substituted
			assert(
				!rewriteUrl("#x", context, meta()).startsWith(raw),
				"a subresource"
			);
			// and only for a document
			const worker = { ...meta(), rawUrl: undefined };
			assert(
				!rewriteUrl("#x", context, worker, {
					navigateType: "location",
				}).startsWith(raw),
				"no rawUrl"
			);
		},
	}),

	directTest({
		name: "rewriter-fragment-history",
		fn: ({ assertEqual }) => {
			const hist = (url: string) =>
				rewriteHistoryUrl(
					new URL(url, "https://example.com/page?q=1#now"),
					context,
					meta()
				);
			assertEqual(hist("#x"), raw + "#x", "a fragment");
			assertEqual(hist("?q=1"), raw, "the same URL");
			// a new URL keeps the parameters the document was requested with
			assertEqual(
				hist("/deep/route?a=b#c"),
				prefix +
					encodeURIComponent("https://example.com/deep/route?a=b") +
					"?%24io=https%3A%2F%2Fother.test#c",
				"another URL"
			);
		},
	}),

	directTest({
		name: "rewriter-fragment-can-have-url-rewritten",
		fn: ({ assertEqual }) => {
			// https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
			const cases: [string, string, boolean][] = [
				["https://a.test/p?q#f", "https://a.test/other?r#g", true],
				["https://a.test/p", "https://b.test/p", false],
				["https://a.test/p", "https://a.test:8443/p", false],
				["https://a.test/p", "http://a.test/p", false],
				["https://a.test/p", "https://user@a.test/p", false],
				// file: may change its query and fragment, not its path
				["file:///dir/f.html", "file:///dir/f.html?q=1#x", true],
				["file:///dir/f.html?a", "file:///dir/f.html?b", true],
				["file:///dir/f.html", "file:///dir/g.html", false],
				// anything else only its fragment
				["about:blank", "about:blank#x", true],
				["about:blank", "about:blank?q", false],
				["about:srcdoc", "about:srcdoc#x", true],
				["about:srcdoc", "about:blank#x", false],
				["data:text/html,a", "data:text/html,a#x", true],
				["data:text/html,a", "data:text/html,b", false],
			];
			for (const [document, target, expected] of cases) {
				assertEqual(
					canHaveItsURLRewritten(new URL(document), new URL(target)),
					expected,
					`${document} -> ${target}`
				);
			}
		},
	}),

	directTest({
		name: "rewriter-fragment-css-local-reference",
		fn: ({ assertEqual }) => {
			for (const css of [
				"a{fill:url(#g)}",
				'a{fill:url("#g")}',
				"a{fill:url( '#g' )}",
				"a{clip-path:url(#c);mask:url(#m)}",
			]) {
				assertEqual(rewriteCss(css, context, meta()), css, css);
				assertEqual(unrewriteCss(css, context), css, "unrewrite " + css);
			}
			const external = rewriteCss("a{fill:url(sprite.svg#g)}", context, meta());
			assertEqual(
				external,
				"a{fill:url(" + rewriteUrl("sprite.svg#g", context, meta()) + ")}",
				"a URL that is not fragment-only is still rewritten"
			);
		},
	}),
] as Test[];
