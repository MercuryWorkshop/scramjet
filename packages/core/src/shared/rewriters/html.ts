import { ElementType, Handler, Parser } from "htmlparser2";
import { ChildNode, DomHandler, Element, Comment } from "domhandler";
import render from "dom-serializer";
import { URLMeta, rewriteUrl } from "@rewriters/url";
import { rewriteCss } from "@rewriters/css";
import { rewriteJs } from "@rewriters/js";
import { CookieJar } from "@/shared/cookie";
import { config, iface } from "@/shared";
import { htmlRules } from "@/shared/htmlRules";

const encoder = new TextEncoder();
function rewriteHtmlInner(
	html: string,
	cookieJar: CookieJar,
	meta: URLMeta,
	fromTop: boolean = false,
	preRewrite?: (handler: DomHandler) => void,
	postRewrite?: (handler: DomHandler) => void
) {
	const handler = new DomHandler((err, dom) => dom);
	const parser = new Parser(handler);

	parser.write(html);
	parser.end();
	if (preRewrite) preRewrite(handler);
	traverseParsedHtml(handler.root, cookieJar, meta);

	let htmlRoot: Element | undefined;
	let headElement: Element | undefined;
	let bodyElement: Element | undefined;

	function detectQuirks() {
		for (const child of handler.root.childNodes) {
			if (
				child.type === ElementType.Directive ||
				child.type === ElementType.Comment ||
				child.type === ElementType.Text
			) {
				continue;
			}

			if (child.type === ElementType.Tag && child.name === "html") {
				htmlRoot = child as Element;
			} else {
				// there's a child of the root that isn't an html element or a doctype/comment/text
				return true;
			}
		}

		if (!htmlRoot) return true; // no html tag or it's somewhere else other than first child

		for (const child of htmlRoot.childNodes) {
			if (
				child.type === ElementType.Directive ||
				child.type === ElementType.Comment ||
				child.type === ElementType.Text
			) {
				continue;
			}

			if (child.type === ElementType.Tag && child.name === "head") {
				if (bodyElement) {
					// head comes after body
					return true;
				}
				headElement = child as Element;
			} else if (child.type === ElementType.Tag && child.name === "body") {
				bodyElement = child as Element;
			} else {
				// there's a child of html that isn't head or body
				// fine if head already exists, bad if it doesn't
				if (!headElement) {
					return true;
				}
			}

			return false;
		}
	}

	let isQuirky = detectQuirks();

	if (fromTop) {
		const script = (src: string) => new Element("script", { src });
		const injectScripts = iface.getInjectScripts(
			meta,
			handler,
			config,
			cookieJar,
			script
		);

		if (isQuirky) {
			dbg.warn(
				`detected quirky document structure parsing @ ${meta.origin.href}!`
			);
			// there's weird stuff going on with the document that could result in page scripts being loaded before our inject scripts
			// so inject them at position 0
			handler.root.children.unshift(...injectScripts);
		} else {
			if (!headElement) {
				headElement = new Element("head", {}, []);
				htmlRoot.children.unshift(headElement);
			}

			headElement.children.unshift(...injectScripts);
		}
	}

	if (postRewrite) postRewrite(handler);

	return render(handler.root, {
		encodeEntities: "utf8",
		decodeEntities: false,
	});
}

export function rewriteHtml(
	html: string,
	cookieStore: CookieJar,
	meta: URLMeta,
	fromTop: boolean = false,
	preRewrite?: (handler: DomHandler) => void,
	postRewrite?: (handler: DomHandler) => void
) {
	const before = performance.now();
	const ret = rewriteHtmlInner(
		html,
		cookieStore,
		meta,
		fromTop,
		preRewrite,
		postRewrite
	);
	dbg.time(meta, before, "html rewrite");

	return ret;
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

// i need to add the attributes in during rewriting

function traverseParsedHtml(node: any, cookieStore: CookieJar, meta: URLMeta) {
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
		node.attribs.type === "importmap" &&
		node.children[0] !== undefined
	) {
		let json = node.children[0].data;
		try {
			const map = JSON.parse(json);
			if (map.imports) {
				for (const key in map.imports) {
					let url = map.imports[key];
					if (typeof url === "string") {
						url = rewriteUrl(url, meta);
						map.imports[key] = url;
					}
				}
			}

			node.children[0].data = JSON.stringify(map);
		} catch (e) {
			console.error("Failed to parse importmap JSON:", e);
		}
	}
	if (
		node.name === "script" &&
		/(application|text)\/javascript|module|undefined/.test(node.attribs.type) &&
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
			// just delete it. this needs to be emulated eventually but like
			node = new Comment(node.attribs.content);
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
	const sources = srcset.split(/ .*,/).map((src) => src.trim());
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
