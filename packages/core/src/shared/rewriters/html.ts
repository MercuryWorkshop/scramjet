import {
	type AnyNode,
	type CDATA,
	type ChildNode,
	Comment,
	type Document,
	DomBuilder,
	Element,
	ElementType,
	Parser,
	parseDocument,
	render,
} from "@/shared/htmlparser";
import { type NullArray, nullArray } from "@/shared/htmlparser/safe";
import { URLMeta, rewriteUrl } from "@rewriters/url";
import { rewriteCss, unrewriteCss } from "@rewriters/css";
import { rewriteJs } from "@rewriters/js";
import { rewriteImportMap } from "@rewriters/importmap";
import { ScramjetContext } from "@/shared";
import { htmlRules } from "@/shared/htmlRules";
import { base64Decode, bytesToBase64 } from "@/shared/util";
import { Tap } from "@/Tap";
import { RawHeaders } from "@mercuryworkshop/proxy-transports";
import { TrackedHistoryState } from "@/fetch";
import {
	Error,
	Performance_now,
	Object_keys,
	TextEncoder_encode,
	Array_indexOf,
	String_slice,
	String_startsWith,
	String_toLowerCase,
	_URL,
} from "@/shared/snapshot";
import { flagEnabled } from "..";
import {
	getScriptBlockTypeString,
	isModuleScriptType,
	isScriptType,
} from "@/shared/mime";

export type ForeignContext = "svg" | "math" | "html";

/**
 * Where a script element's original source is kept, in base64.
 *
 * Under the prefix every internal attribute shares, so it is hidden like the
 * rest - but not under the `scramjet-attr-` a mirror is named with. As
 * `scramjet-attr-script-source-src` it was also the mirror of a page's own
 * `script-source-src` attribute, and every lookup of that name found the
 * source instead.
 */
export const SCRIPT_SOURCE_ATTRIBUTE = "scramjet-attr_script-source";

/** The name the mirror of `attr` is kept under. */
const mirrorName = (attr: string) => `scramjet-attr-${attr}`;

// Initialized on first rewrite because htmlRules imports rewriteHtml from this
// module. Keep rule order, but avoid enumerating every rule for every element.
let ruleAttributeNames: string[][] | undefined;
function getRuleAttributeNames(): string[][] {
	if (ruleAttributeNames) return ruleAttributeNames;
	const all: string[][] = [];
	for (let i = 0; i < htmlRules.length; i++) {
		const names = Object_keys(htmlRules[i]);
		const attributes: string[] = [];
		for (let j = 0; j < names.length; j++) {
			if (names[j] !== "fn") attributes[attributes.length] = names[j];
		}
		all[i] = attributes;
	}
	ruleAttributeNames = all;
	return all;
}

/**
 * Put `to` where `from` is in an element's attribute list.
 *
 * An attribute a rule removes leaves its mirror to represent it, and the page
 * reads the list back in the order the parser gave it - so the mirror takes
 * the removed attribute's place rather than joining the end.
 */
function replaceAttribute(
	attribs: Record<string, string>,
	from: string,
	to: string,
	value: string
) {
	const keys = Object_keys(attribs);
	const values: string[] = [];
	for (let i = 0; i < keys.length; i++) {
		values[i] = attribs[keys[i]];
		delete attribs[keys[i]];
	}
	for (let i = 0; i < keys.length; i++) {
		if (keys[i] === from) attribs[to] = value;
		else if (keys[i] !== to) attribs[keys[i]] = values[i];
	}
}

export type HtmlContext = {
	// should we inject scramjet scripts at the top of the document?
	loadScripts: boolean;
	// did the document come from the service worker, or from document.write/innerHTML?
	inline: boolean;
	// for worker originating documents, the source URL, otherwise the url of the page that triggered the rewrite
	source: string;
	// for api originating documents, the name of the api that triggered the rewrite
	apisource?: string;
	// response headers for worker originating documents
	headers?: RawHeaders;
	foreignContext?: ForeignContext;
	// XML MIME types use the XML tokenizer and serializer, while sharing the
	// attribute rewriting rules with HTML documents.
	xmlMode?: boolean;
	// `DOMParser`'s HTML parser has scripting disabled, which changes how it
	// treats `noscript` content.
	scriptingEnabled?: boolean;
	history?: TrackedHistoryState[];
};

export class IncrementalHtmlRewriter {
	private readonly builder = new DomBuilder();
	private readonly parser: Parser;
	/** Per child of the root, by index: how much of its output went out. */
	private readonly emittedLengths: NullArray<number> = nullArray();
	/** Per child of the root, by index: its rewrite, once it is complete. */
	private readonly rewrittenNodes: NullArray<string> = nullArray();
	private ended = false;

	constructor(
		private readonly context: ScramjetContext,
		private readonly meta: URLMeta,
		private readonly htmlcontext: HtmlContext
	) {
		this.parser = new Parser(this.builder, {
			startingForeignContext: htmlcontext.foreignContext,
			xmlMode: htmlcontext.xmlMode,
		});
	}

	write(html: string) {
		if (this.ended) {
			throw new Error("IncrementalHtmlRewriter stream already ended");
		}

		this.parser.write(html);

		return this.flush();
	}

	end(html = "") {
		if (this.ended) {
			return "";
		}

		if (html) {
			this.parser.write(html);
		}

		this.parser.end();
		this.ended = true;

		return this.flush();
	}

	private flush() {
		const { children } = this.builder.root;
		let output = "";

		for (let index = 0; index < children.length; index++) {
			const rewritten = this.getAvailableOutput(children, index);
			if (rewritten === null) {
				break;
			}

			const emittedLength = this.emittedLengths[index] ?? 0;
			if (rewritten.length > emittedLength) {
				output += String_slice(rewritten, emittedLength);
				this.emittedLengths[index] = rewritten.length;
			}
		}

		return output;
	}

	private getAvailableOutput(children: NullArray<ChildNode>, index: number) {
		const node = children[index];
		if (node.type !== ElementType.Tag) {
			return render(node);
		}

		// Only the last child of the root can still be open: anything after it
		// was added once the parser was back at the top level.
		if (index === children.length - 1 && this.builder.openElements > 0) {
			return null;
		}

		let rewritten = this.rewrittenNodes[index];
		if (rewritten === undefined) {
			rewritten = rewriteHtmlInner(
				node,
				this.context,
				this.meta,
				this.htmlcontext
			);
			this.rewrittenNodes[index] = rewritten;
		}

		return rewritten;
	}
}

function rewriteHtmlInner(
	html: string | ChildNode,
	context: ScramjetContext,
	meta: URLMeta,
	htmlcontext: HtmlContext
) {
	if (typeof html !== "string") {
		html = render(html);
	}

	const root = parseDocument(html, {
		startingForeignContext: htmlcontext.foreignContext,
		xmlMode: htmlcontext.xmlMode,
		scriptingEnabled: htmlcontext.scriptingEnabled,
	});

	Tap.dispatch(
		context.hooks!.rewriter.html.pre,
		{
			root,
			meta,
			htmlcontext,
			origHtml: html,
		},
		undefined
	);
	traverseParsedHtml(root, context, meta);

	let htmlRoot: Element | undefined;
	let headElement: Element | undefined;
	let bodyElement: Element | undefined;

	function detectQuirks() {
		for (let index = 0; index < root.children.length; index++) {
			const child = root.children[index];
			if (
				child.type === ElementType.Directive ||
				child.type === ElementType.Comment ||
				child.type === ElementType.Text
			) {
				continue;
			}

			if (child.type === ElementType.Tag && child.name === "html") {
				htmlRoot = child;
			} else {
				// there's a child of the root that isn't an html element or a doctype/comment/text
				return true;
			}
		}

		if (!htmlRoot) return true; // no html tag or it's somewhere else other than first child

		for (let index = 0; index < htmlRoot.children.length; index++) {
			const child = htmlRoot.children[index];
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
				headElement = child;
			} else if (child.type === ElementType.Tag && child.name === "body") {
				bodyElement = child;
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

	const isQuirky = detectQuirks();

	if (htmlcontext.loadScripts) {
		const script = (src: string) =>
			new Element("script", { src, "scramjet-injected": "true" });
		const injectScripts = context.interface.getInjectScripts(
			meta,
			root,
			htmlcontext,
			script
		);

		if (isQuirky) {
			dbg.warn(
				`detected quirky document structure parsing @ ${meta.origin.href}!`
			);
			// there's weird stuff going on with the document that could result in page scripts being loaded before our inject scripts
			// so inject them at position 0
			root.prepend(injectScripts);
		} else {
			if (!headElement) {
				headElement = new Element("head", {});
				htmlRoot.prepend([headElement]);
			}

			headElement.prepend(injectScripts);
		}
	}

	const props: typeof context.hooks.rewriter.html.post.props = {};
	Tap.dispatch(
		context.hooks!.rewriter.html.post,
		{
			root,
			meta,
			htmlcontext,
			origHtml: html,
		},
		props
	);

	if (props.setRawHtml !== undefined) {
		return props.setRawHtml;
	}

	return render(root, htmlcontext.xmlMode);
}

export function rewriteHtml(
	html: string,
	context: ScramjetContext,
	meta: URLMeta,
	htmlcontext: HtmlContext
) {
	const before = Performance_now();
	const ret = rewriteHtmlInner(html, context, meta, htmlcontext);
	if (flagEnabled("rewriterLogs", context, meta.base)) {
		dbg.time(meta, before, "html rewrite");
	}

	return ret;
}

/**
 * Undo {@link rewriteHtml} over a serialization.
 *
 * `context` is what lets a style element's text be un-rewritten; without it the
 * markup comes back with the rewritten stylesheet still in it, which is a
 * difference the page can see in `innerHTML`. Every client call passes one.
 */
export function unrewriteHtml(
	html: string,
	foreignContext?: ForeignContext,
	context?: ScramjetContext
) {
	const root = parseDocument(html, {
		startingForeignContext: foreignContext,
	});

	function traverse(node: AnyNode) {
		if (node.type === ElementType.Tag) {
			const { attribs } = node;
			const keys = Object_keys(attribs);
			for (let index = 0; index < keys.length; index++) {
				const key = keys[index];
				const lower = String_toLowerCase(key);
				if (lower === SCRIPT_SOURCE_ATTRIBUTE) {
					const child = node.children[0];
					if (child && "data" in child) child.data = base64Decode(attribs[key]);
					delete attribs[key];
					continue;
				}

				if (String_startsWith(lower, "scramjet-attr-")) {
					attribs[String_slice(key, "scramjet-attr-".length)] = attribs[key];
					delete attribs[key];
				}
			}

			// a style element has no mirror to restore from - the stylesheet is
			// recovered by running the rewrite backwards
			const child = node.children[0];
			if (
				context &&
				node.name === "style" &&
				child !== undefined &&
				"data" in child
			) {
				child.data = unrewriteCss(child.data, context);
			}
		}

		if ("children" in node) {
			for (let index = 0; index < node.children.length; index++) {
				traverse(node.children[index]);
			}
		}
	}

	traverse(root);

	return render(root);
}

function traverseParsedHtml(
	node: AnyNode,
	context: ScramjetContext,
	meta: URLMeta
): AnyNode {
	if (node.type !== ElementType.Tag) {
		if ("children" in node) traverseChildren(node, context, meta);

		return node;
	}

	const { attribs } = node;
	const ruleAttributeNames = getRuleAttributeNames();

	if (node.name === "base" && attribs.href !== undefined) {
		meta.base = new _URL(attribs.href, meta.origin);
	}

	for (let ruleIndex = 0; ruleIndex < htmlRules.length; ruleIndex++) {
		const rule = htmlRules[ruleIndex];
		const ruleKeys = ruleAttributeNames[ruleIndex];
		for (let keyIndex = 0; keyIndex < ruleKeys.length; keyIndex++) {
			const attr = ruleKeys[keyIndex];
			// Most elements do not carry any attribute a given rule handles.
			if (attribs[attr] === undefined) continue;
			const sel = rule[attr];
			if (typeof sel === "function") continue;

			if (sel === "*" || Array_indexOf(sel, node.name) !== -1) {
				const value = attribs[attr];
				const v = rule.fn(
					value,
					context,
					meta,
					(name) => attribs[name] || null
				);

				if (v === null) {
					replaceAttribute(attribs, attr, mirrorName(attr), value);
				} else {
					attribs[attr] = v;
					attribs[mirrorName(attr)] = value;
				}
			}
		}
	}
	const attrKeys = Object_keys(attribs);
	for (let index = 0; index < attrKeys.length; index++) {
		const attr = attrKeys[index];
		if (
			attr[0] === "o" &&
			attr[1] === "n" &&
			Array_indexOf(eventAttributes, attr) !== -1
		) {
			const value = attribs[attr];
			attribs[mirrorName(attr)] = value;
			attribs[attr] = rewriteJs(
				value,
				`(inline ${attr} on element)`,
				context,
				meta
			) as string;
		}
	}

	const text = node.children[0];
	const hasText = text !== undefined && text.type === ElementType.Text;

	if (node.name === "style" && hasText)
		text.data = rewriteCss(text.data, context, meta);

	if (
		node.name === "script" &&
		attribs.type !== undefined &&
		String_toLowerCase(attribs.type) === "importmap" &&
		hasText
	) {
		try {
			text.data = rewriteImportMap(text.data, context, meta);
		} catch (e) {
			dbg.error("Failed to parse importmap JSON:", e);
		}
	}
	if (node.name === "script" && hasText) {
		const scriptBlockType = getScriptBlockTypeString(
			"type" in attribs ? attribs.type : undefined,
			"language" in attribs ? attribs.language : undefined,
			"type" in attribs,
			"language" in attribs
		);
		if (isScriptType(scriptBlockType)) {
			let js = text.data;
			const module = isModuleScriptType(scriptBlockType);
			attribs[SCRIPT_SOURCE_ATTRIBUTE] = bytesToBase64(TextEncoder_encode(js));
			const htmlcomment = /<!--[\s\S]*?-->/g;
			js = js.replace(htmlcomment, "");
			text.data = rewriteJs(
				js,
				"(inline script element)",
				context,
				meta,
				module
			) as string;
		}
	}

	if (node.name === "meta" && attribs["http-equiv"] !== undefined) {
		if (
			String_toLowerCase(attribs["http-equiv"]) === "content-security-policy"
		) {
			// just delete it. this needs to be emulated eventually but like
			return new Comment(attribs.content);
		}
		// a refresh's content is rewritten - and mirrored - by its rule in
		// `htmlRules`, the same one a script's write goes through
	}

	traverseChildren(node, context, meta);

	return node;
}

function traverseChildren(
	node: Document | Element | CDATA,
	context: ScramjetContext,
	meta: URLMeta
) {
	for (let index = 0; index < node.children.length; index++) {
		const child = node.children[index];
		const rewritten = traverseParsedHtml(child, context, meta);
		if (rewritten !== child) node.replaceChild(index, rewritten as ChildNode);
	}
}

export function rewriteSrcset(
	srcset: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	const sources = srcset.split(/ .*,/).map((src) => src.trim());
	const rewrittenSources = sources.map((source) => {
		// Split into URLs and descriptors (if any)
		// e.g. url0, url1 1.5x, url2 2x
		const [url, ...descriptors] = source.split(/\s+/);

		// Rewrite the URLs and keep the descriptors (if any)
		const rewrittenUrl = rewriteUrl(url.trim(), context, meta);

		return descriptors.length > 0
			? `${rewrittenUrl} ${descriptors.join(" ")}`
			: rewrittenUrl;
	});

	return rewrittenSources.join(", ");
}

/**
 * The event handler content attributes, which carry javascript rather than a
 * value. Exported because the client's attribute layer has to rewrite the same
 * set when a page writes one through `setAttribute` - a name that is rewritten
 * at parse time and not at run time is a hole, not an optimisation.
 */
export const eventAttributes = [
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
