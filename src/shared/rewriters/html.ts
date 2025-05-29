import { ElementType, Parser } from "htmlparser2";
import { ChildNode, DomHandler, Element } from "domhandler";
import render from "dom-serializer";
import { URLMeta, rewriteUrl } from "./url";
import { rewriteCss } from "./css";
import { rewriteJs } from "./js";
import { CookieStore } from "../cookie";
import { unrewriteBlob } from "../../shared/rewriters/url";
import { $scramjet } from "../../scramjet";

const encoder = new TextEncoder();
export function rewriteHtml(
	html: string,
	cookieStore: CookieStore,
	meta: URLMeta,
	fromTop: boolean = false
) {
	const handler = new DomHandler((err, dom) => dom);
	const parser = new Parser(handler);

	parser.write(html);
	parser.end();
	traverseParsedHtml(handler.root, cookieStore, meta);

	function findhead(node) {
		if (node.type === ElementType.Tag && node.name === "head") {
			return node as Element;
		} else if (node.childNodes) {
			for (const child of node.childNodes) {
				const head = findhead(child);
				if (head) return head;
			}
		}

		return null;
	}

	if (fromTop) {
		let head = findhead(handler.root);
		if (!head) {
			head = new Element("head", {}, []);
			handler.root.children.unshift(head);
		}

		const dump = JSON.stringify(cookieStore.dump());
		const injected = `
			self.COOKIE = ${dump};
			self.$scramjet.config = ${JSON.stringify($scramjet.config)};
			if ("document" in self && document?.currentScript) {
				document.currentScript.remove();
			}
		`;

		const script = (src) => new Element("script", { src });

		// for compatibility purpose
		const base64Injected = bytesToBase64(encoder.encode(injected));

		head.children.unshift(
			script($scramjet.config.files.wasm),
			script($scramjet.config.files.shared),
			script("data:application/javascript;base64," + base64Injected),
			script($scramjet.config.files.client)
		);
	}

	return render(handler.root, {
		encodeEntities: "utf8",
		decodeEntities: false,
	});
}

// type ParseState = {
// 	base: string;
// 	origin?: URL;
// };

export function unrewriteHtml(html: string) {
	const handler = new DomHandler((err, dom) => dom);
	const parser = new Parser(handler);

	parser.write(html);
	parser.end();

	function traverse(node: ChildNode) {
		if ("attribs" in node) {
			for (const key in node.attribs) {
				if (key == "scramjet-attr-script-source-src") {
					if (node.children[0] && "data" in node.children[0])
						node.children[0].data = atob(node.attribs[key]);
					continue;
				}

				if (key.startsWith("scramjet-attr-")) {
					node.attribs[key.slice("scramjet-attr-".length)] = node.attribs[key];
					delete node.attribs[key];
				}
			}
		}

		if ("childNodes" in node) {
			for (const child of node.childNodes) {
				traverse(child);
			}
		}
	}

	traverse(handler.root);

	return render(handler.root, {
		decodeEntities: false,
	});
}

export const htmlRules: {
	[key: string]: "*" | string[] | ((...any: any[]) => string | null);
	fn: (value: string, meta: URLMeta, cookieStore: CookieStore) => string | null;
}[] = [
	{
		fn: (value: string, meta: URLMeta) => {
			return rewriteUrl(value, meta);
		},

		// url rewrites
		src: [
			"embed",
			"script",
			"img",
			"iframe",
			"frame",
			"source",
			"input",
			"track",
		],
		href: ["a", "link", "area", "image"],
		data: ["object"],
		action: ["form"],
		formaction: ["button", "input", "textarea", "submit"],
		poster: ["video"],
		"xlink:href": ["image"],
	},
	{
		fn: (value: string, meta: URLMeta) => {
			if (value.startsWith("blob:")) {
				// for media elements specifically they must take the original blob
				// because they can't be fetch'd
				return unrewriteBlob(value);
			}

			return rewriteUrl(value, meta);
		},
		src: ["video", "audio"],
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
		fn: (value: string, meta: URLMeta) => rewriteSrcset(value, meta),

		// srcset
		srcset: ["img", "source"],
		imagesrcset: ["link"],
	},
	{
		fn: (value: string, meta: URLMeta, cookieStore: CookieStore) =>
			rewriteHtml(
				value,
				cookieStore,
				{
					// for srcdoc origin is the origin of the page that the iframe is on. base and path get dropped
					origin: new URL(meta.origin.origin),
					base: new URL(meta.origin.origin),
				},
				true
			),

		// srcdoc
		srcdoc: ["iframe"],
	},
	{
		fn: (value: string, meta: URLMeta) => rewriteCss(value, meta),
		style: "*",
	},
	{
		fn: (value: string) => {
			if (["_parent", "_top", "_unfencedTop"].includes(value)) return "_self";
			else return value;
		},
		target: ["a", "base"],
	},
];

// i need to add the attributes in during rewriting

function traverseParsedHtml(
	node: any,
	cookieStore: CookieStore,
	meta: URLMeta
) {
	if (node.name === "base" && node.attribs.href !== undefined) {
		meta.base = new URL(node.attribs.href, meta.origin);
	}

	if (node.attribs) {
		for (const rule of htmlRules) {
			for (const attr in rule) {
				const sel = rule[attr.toLowerCase()];
				if (typeof sel === "function") continue;

				if (sel === "*" || sel.includes(node.name)) {
					if (node.attribs[attr] !== undefined) {
						const value = node.attribs[attr];
						const v = rule.fn(value, meta, cookieStore);

						if (v === null) delete node.attribs[attr];
						else {
							node.attribs[attr] = v;
						}
						node.attribs[`scramjet-attr-${attr}`] = value;
					}
				}
			}
		}
		for (const [attr, value] of Object.entries(node.attribs)) {
			if (eventAttributes.includes(attr)) {
				node.attribs[`scramjet-attr-${attr}`] = value;
				node.attribs[attr] = rewriteJs(
					value as string,
					`(inline ${attr} on element)`,
					meta
				);
			}
		}
	}

	if (node.name === "style" && node.children[0] !== undefined)
		node.children[0].data = rewriteCss(node.children[0].data, meta);

	if (
		node.name === "script" &&
		node.attribs.type === "module" &&
		node.attribs.src
	)
		node.attribs.src = node.attribs.src + "?type=module";

	if (
		node.name === "script" &&
		/(application|text)\/javascript|module|importmap|undefined/.test(
			node.attribs.type
		) &&
		node.children[0] !== undefined
	) {
		let js = node.children[0].data;
		const module = node.attribs.type === "module" ? true : false;
		node.attribs["scramjet-attr-script-source-src"] = bytesToBase64(
			encoder.encode(js)
		);
		const htmlcomment = /<!--[\s\S]*?-->/g;
		js = js.replace(htmlcomment, "");
		node.children[0].data = rewriteJs(
			js,
			"(inline script element)",
			meta,
			module
		);
	}

	if (node.name === "meta" && node.attribs["http-equiv"] !== undefined) {
		if (
			node.attribs["http-equiv"].toLowerCase() === "content-security-policy"
		) {
			node = {};
		} else if (
			node.attribs["http-equiv"] === "refresh" &&
			node.attribs.content.includes("url")
		) {
			const contentArray = node.attribs.content.split("url=");
			if (contentArray[1])
				contentArray[1] = rewriteUrl(contentArray[1].trim(), meta);
			node.attribs.content = contentArray.join("url=");
		}
	}

	if (node.childNodes) {
		for (const childNode in node.childNodes) {
			node.childNodes[childNode] = traverseParsedHtml(
				node.childNodes[childNode],
				cookieStore,
				meta
			);
		}
	}

	return node;
}

export function rewriteSrcset(srcset: string, meta: URLMeta) {
	const sources = srcset.split(",").map((src) => src.trim());
	const rewrittenSources = sources.map((source) => {
		// Split into URLs and descriptors (if any)
		// e.g. url0, url1 1.5x, url2 2x
		const [url, ...descriptors] = source.split(/\s+/);

		// Rewrite the URLs and keep the descriptors (if any)
		const rewrittenUrl = rewriteUrl(url.trim(), meta);

		return descriptors.length > 0
			? `${rewrittenUrl} ${descriptors.join(" ")}`
			: rewrittenUrl;
	});

	return rewrittenSources.join(", ");
}

// function base64ToBytes(base64) {
// 	const binString = atob(base64);

// 	return Uint8Array.from(binString, (m) => m.codePointAt(0));
// }

function bytesToBase64(bytes: Uint8Array) {
	const binString = Array.from(bytes, (byte) =>
		String.fromCodePoint(byte)
	).join("");

	return btoa(binString);
}
const eventAttributes = [
	"onbeforexrselect",
	"onabort",
	"onbeforeinput",
	"onbeforematch",
	"onbeforetoggle",
	"onblur",
	"oncancel",
	"oncanplay",
	"oncanplaythrough",
	"onchange",
	"onclick",
	"onclose",
	"oncontentvisibilityautostatechange",
	"oncontextlost",
	"oncontextmenu",
	"oncontextrestored",
	"oncuechange",
	"ondblclick",
	"ondrag",
	"ondragend",
	"ondragenter",
	"ondragleave",
	"ondragover",
	"ondragstart",
	"ondrop",
	"ondurationchange",
	"onemptied",
	"onended",
	"onerror",
	"onfocus",
	"onformdata",
	"oninput",
	"oninvalid",
	"onkeydown",
	"onkeypress",
	"onkeyup",
	"onload",
	"onloadeddata",
	"onloadedmetadata",
	"onloadstart",
	"onmousedown",
	"onmouseenter",
	"onmouseleave",
	"onmousemove",
	"onmouseout",
	"onmouseover",
	"onmouseup",
	"onmousewheel",
	"onpause",
	"onplay",
	"onplaying",
	"onprogress",
	"onratechange",
	"onreset",
	"onresize",
	"onscroll",
	"onsecuritypolicyviolation",
	"onseeked",
	"onseeking",
	"onselect",
	"onslotchange",
	"onstalled",
	"onsubmit",
	"onsuspend",
	"ontimeupdate",
	"ontoggle",
	"onvolumechange",
	"onwaiting",
	"onwebkitanimationend",
	"onwebkitanimationiteration",
	"onwebkitanimationstart",
	"onwebkittransitionend",
	"onwheel",
	"onauxclick",
	"ongotpointercapture",
	"onlostpointercapture",
	"onpointerdown",
	"onpointermove",
	"onpointerrawupdate",
	"onpointerup",
	"onpointercancel",
	"onpointerover",
	"onpointerout",
	"onpointerenter",
	"onpointerleave",
	"onselectstart",
	"onselectionchange",
	"onanimationend",
	"onanimationiteration",
	"onanimationstart",
	"ontransitionrun",
	"ontransitionstart",
	"ontransitionend",
	"ontransitioncancel",
	"oncopy",
	"oncut",
	"onpaste",
	"onscrollend",
	"onscrollsnapchange",
	"onscrollsnapchanging",
];
