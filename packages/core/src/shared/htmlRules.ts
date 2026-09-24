import { rewriteCss } from "@rewriters/css";
import { rewriteHtml, rewriteSrcset } from "@rewriters/html";
import { rewriteUrl, unrewriteBlob, URLMeta } from "@rewriters/url";
import { ScramjetContext } from "@/shared";
import { parseDeclarativeRefresh } from "./refresh";
import { _URL } from "./snapshot";

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
		fn: (value, context, meta) =>
			rewriteUrl(value, context, meta, { navigateType: "location" }),

		// url rewrites
		src: ["embed", "img", "frame", "input", "track"],
		href: ["a", "area", "image"],
		data: ["object"],
		action: ["form"],
		formaction: ["button", "input", "textarea", "submit"],
		poster: ["video"],
		// `image` and `a` exist in both vocabularies; the SVG one also takes the
		// legacy spelling
		"xlink:href": ["image", "a"],
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
					topUrl: meta.topUrl,
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
			if (value === "_top" || value === "_unfencedTop")
				return meta.topFrameName;
			else if (value === "_parent") return meta.parentFrameName;
			else return value;
		},
		target: ["a", "base"],
	},
	{
		// svg elements with an href property
		fn: (value, context, meta) => {
			// #id values are not rewritten
			if (value.startsWith("#")) return value;
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
				rewriteUrl(refresh.url.trim(), context, meta) +
				value.slice(refresh.urlEnd)
			);
		},
		content: ["meta"],
	},
];
