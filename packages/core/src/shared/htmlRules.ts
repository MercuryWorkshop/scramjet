import { rewriteCss } from "@rewriters/css";
import { rewriteHtml, rewriteSrcset } from "@rewriters/html";
import {
	frozenBaseUrl,
	isFragmentOnly,
	rewriteUrl,
	sameDocumentUrl,
	splitFragment,
	unrewriteBlob,
	URLMeta,
} from "@rewriters/url";
import { ScramjetContext } from "@/shared";
import { parseDeclarativeRefresh } from "./refresh";
import { String_toLowerCase, _URL } from "./snapshot";

/**
 * The SVG elements whose `href` is a URL reference that is fetched or
 * navigated. Shared between the modern `href` and the legacy `xlink:href`,
 * which every one of them still honours: a rule for one and not the other is
 * a hole with the other's name on it.
 */
const svgUrlReferences = [
	"use",
	"textPath",
	"mpath",
	"feImage",
	"animate",
	"animateMotion",
	"animateTransform",
	"set",
	"discard",
	"linearGradient",
	"radialGradient",
	"pattern",
	"filter",
];

export const htmlRules: {
	[key: string]: "*" | string[] | ((...any: any[]) => string | null);
	fn: (
		value: string,
		context: ScramjetContext,
		meta: URLMeta,
		getAttr: (name: string) => string | null
	) => string | null;
}[] = [
	{
		fn: (value, context, meta) => rewriteUrl(value, context, meta),

		// url rewrites
		src: ["embed", "img", "frame", "input", "track"],
		href: ["image"],
		data: ["object"],
		action: ["form"],
		formaction: ["button", "input", "textarea", "submit"],
		poster: ["video"],
		// `image` exists in both vocabularies; the SVG one also takes the
		// legacy spelling
		"xlink:href": ["image"],
	},
	{
		// https://html.spec.whatwg.org/multipage/links.html#following-hyperlinks-2
		//
		// A fragment-only href is left as it is. The browser resolves a
		// hyperlink's URL when it is followed, against the document's base URL
		// *at that time*, and then compares it with the document's URL to
		// decide whether this is a fragment navigation. Left relative, `#x`
		// resolves against the real URL the document has right then - after
		// any number of hash changes and `pushState`s - and so stays in the
		// document exactly when the site's would. The real base it resolves
		// against, if there is one, is a proxy URL as well (the `base` rule
		// below), so it cannot resolve out of the proxy.
		//
		// Any other href that names this same document is sent to its real
		// URL by `rewriteUrl`, which is as close as a URL fixed when it is
		// written can get.
		fn: (value, context, meta) => {
			if (isFragmentOnly(value)) return value;

			return rewriteUrl(value, context, meta, { navigateType: "link" });
		},

		href: ["a", "area"],
		// the SVG `a` also takes the legacy spelling
		"xlink:href": ["a"],
	},
	{
		// https://html.spec.whatwg.org/multipage/semantics.html#set-the-frozen-base-url
		//
		// The base element's href is resolved against the document's fallback
		// base URL - never against the document base URL it is itself setting.
		//
		// It is rewritten because the browser resolves against it too, for
		// everything scramjet leaves relative - fragment-only hyperlinks above
		// all. Left pointing at the site, `#x` would resolve to the site's real
		// URL and navigate out of the proxy. A base that names the document
		// itself is its real URL, so that `#x` resolved against it is still in
		// the document. One the browser ignores - `data:`,
		// `javascript:`, not a URL - is left as it is, for the browser to
		// ignore it too.
		fn: (value, context, meta) => {
			const base = frozenBaseUrl(value, meta.origin);
			if (!base) return value;

			const [withoutFragment, fragment] = splitFragment(base.href);

			return (
				sameDocumentUrl(withoutFragment, fragment, meta) ??
				rewriteUrl(base.href, context, meta)
			);
		},

		href: ["base"],
	},
	{
		fn: (value, context, meta, getAttr) => {
			const isModule =
				getAttr("type")?.toLowerCase() === "module" ||
				getAttr("rel")?.toLowerCase() === "modulepreload";

			return rewriteUrl(value, context, meta, {
				isModule,
			});
		},

		src: ["script"],
		// an SVG script takes its source from `href`, not `src` - and it is a
		// script like any other, run in the proxy's origin
		href: ["link", "script"],
		"xlink:href": ["script"],
	},
	{
		fn: (value, context, meta) => {
			const url = rewriteUrl(value, context, meta, {
				topFrame: meta.topFrameName,
				parentFrame: meta.parentFrameName,
				isIframe: "1",
			});

			return url;
		},
		src: ["iframe"],
	},
	{
		// is this a good idea?
		fn: (_value, _context, _meta) => {
			return null;
		},
		sandbox: ["iframe"],
	},
	{
		fn: (value, context, meta) => {
			if (value.startsWith("blob:")) {
				// for media elements specifically they must take the original blob
				// because they can't be fetch'd
				return unrewriteBlob(value, context, meta);
			}

			return rewriteUrl(value, context, meta);
		},
		src: ["video", "audio", "source"],
	},
	{
		fn: () => "",

		integrity: ["script", "link"],
	},
	{
		fn: () => null,

		// csp stuff that must be deleted
		nonce: "*",
		csp: ["iframe"],
		credentialless: ["iframe"],
	},
	{
		fn: (value, context, meta) => rewriteSrcset(value, context, meta),

		// srcset
		srcset: ["img", "source"],
		imagesrcset: ["link"],
	},
	{
		fn: (value, context, meta) =>
			rewriteHtml(
				value,
				context,
				{
					// for srcdoc origin is the origin of the page that the iframe is on. base and path get dropped
					origin: new _URL(meta.origin.origin),
					base: new _URL(meta.origin.origin),
					topFrameName: meta.topFrameName,
					parentFrameName: meta.parentFrameName,
					referrerPolicy: meta.referrerPolicy,
				},
				{
					loadScripts: true,
					inline: true,
					source: meta.origin.href,
					apisource: "set HTMLIFrameElement.prototype.srcdoc",
				}
			),

		// srcdoc
		srcdoc: ["iframe"],
	},
	{
		fn: (value, context, meta) => rewriteCss(value, context, meta),
		style: "*",
	},
	{
		fn: (value, context, meta) => {
			// ASCII case-insensitive keywords - `_TOP` is `_top`, and would reach
			// the real top frame left as it is. No name means this is the frame
			// the keyword names, and the attribute is dropped to say so
			const keyword = String_toLowerCase(value);
			if (keyword === "_top" || keyword === "_unfencedtop")
				return meta.topFrameName ?? null;
			else if (keyword === "_parent") return meta.parentFrameName ?? null;
			else return value;
		},
		target: ["a", "base"],
	},
	{
		// svg elements with an href property
		fn: (value, context, meta) => {
			// a reference to an element in this same document, which the
			// browser only looks up locally when the URL is fragment-only
			if (isFragmentOnly(value)) return value;

			return rewriteUrl(value, context, meta);
		},
		href: svgUrlReferences,
		"xlink:href": svgUrlReferences,
	},
	{
		// https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh -
		// only a URL once `http-equiv` says so. `dom/element.ts` re-runs this
		// when `http-equiv` changes, so the order the two are set in does not
		// matter
		fn: (value, context, meta, getAttr) => {
			if (getAttr("http-equiv")?.toLowerCase() !== "refresh") return value;

			const refresh = parseDeclarativeRefresh(value);
			if (!refresh || refresh.url === null || refresh.url.length === 0) {
				return value;
			}

			return (
				value.slice(0, refresh.urlStart) +
				// the document navigating itself, so `#x` is a fragment
				// navigation like any other
				rewriteUrl(refresh.url.trim(), context, meta, {
					navigateType: "location",
				}) +
				value.slice(refresh.urlEnd)
			);
		},
		content: ["meta"],
	},
];
