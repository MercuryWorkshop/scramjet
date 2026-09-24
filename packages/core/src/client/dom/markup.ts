/**
 * The markup sinks: every member that takes a string of HTML and parses it into
 * the document, and every one that serializes a subtree back out.
 *
 * Each of them is the same pair of operations - `rewriteHtml` on the way in,
 * `unrewriteHtml` on the way out - and the only thing that varies is which
 * element supplies the *foreign context*. HTML, SVG and MathML tokenize
 * differently, so a fragment parsed with the wrong one comes out as a different
 * tree; the rewriter has to be told which it is, and which element to ask
 * depends on where the fragment is going.
 *
 * https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html
 * https://html.spec.whatwg.org/multipage/parsing.html#html-fragment-parsing-algorithm
 */

import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type } from "@client/webidl";
import { rewriteHtml, unrewriteHtml } from "@rewriters/html";
import { ForeignContext } from "@/shared/rewriters/html";
import { isHtmlMimeType } from "@/shared/mime";
import { Array_indexOf, String, String_toLowerCase } from "@/shared/snapshot";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

/** MathML's text integration points, whose children are parsed as HTML. */
const MATHML_TEXT_INTEGRATION_POINTS = ["mi", "mo", "mn", "ms", "mtext"];
/** SVG's HTML integration points. */
const SVG_HTML_INTEGRATION_POINTS = ["foreignObject", "desc", "title"];

/**
 * The tokenizer context *inside* `element` - what the fragment parsing
 * algorithm uses when `element` is the context element.
 *
 * Decided from the namespace and local name the element really has, read
 * through the natives. Not `instanceof`: that walks a prototype chain and a
 * `Symbol.hasInstance` the page controls, and a context the rewriter gets
 * wrong is markup it parses differently from the browser - `<style>` is raw
 * text in HTML and a container in SVG, which is the whole of an escape.
 *
 * https://html.spec.whatwg.org/multipage/parsing.html#html-integration-point
 * https://html.spec.whatwg.org/multipage/parsing.html#mathml-text-integration-point
 */
export function foreignContextForElement(
	client: ScramjetClient,
	element: Element
): ForeignContext {
	const nElement = new client.native.Element(element);
	const namespace = nElement.namespaceURI;
	const local: string = nElement.localName;

	if (namespace === SVG_NAMESPACE) {
		return Array_indexOf(SVG_HTML_INTEGRATION_POINTS, local) !== -1
			? "html"
			: "svg";
	}

	if (namespace === MATHML_NAMESPACE) {
		if (Array_indexOf(MATHML_TEXT_INTEGRATION_POINTS, local) !== -1) {
			return "html";
		}
		if (local === "annotation-xml") {
			const encoding = nElement.getAttribute("encoding");
			const lowered = encoding === null ? "" : String_toLowerCase(encoding);
			if (lowered === "text/html" || lowered === "application/xhtml+xml") {
				return "html";
			}
		}

		return "math";
	}

	return "html";
}

/**
 * The tokenizer context `element` itself sits in - what its parent supplies,
 * which is what a fragment replacing or sitting beside it is parsed in.
 */
export function insideForeignContext(
	client: ScramjetClient,
	element: Element | null
): ForeignContext {
	if (!element) return "html";

	const parent: Element | null = new client.native.Node(element).parentElement;

	return parent ? foreignContextForElement(client, parent) : "html";
}

export default function (client: ScramjetClient, _self: Self) {
	const text = client.text;

	const parse = (
		html: string,
		apisource: string,
		foreignContext: ForeignContext
	) =>
		rewriteHtml(html, client.context, client.meta, {
			loadScripts: false,
			inline: true,
			source: client.url.href,
			apisource,
			foreignContext,
		});

	const serialize = (html: string, foreignContext: ForeignContext) =>
		unrewriteHtml(html, foreignContext, client.context);

	/**
	 * The markup of a script or a style: its children, with each Text child
	 * serialized unescaped as the page wrote it - which the rewritten text in
	 * the document is not. Anything else under it serializes as it would
	 * anywhere; a comment appended by script is still a comment.
	 *
	 * https://html.spec.whatwg.org/multipage/parsing.html#serialising-html-fragments
	 */
	const rawTextMarkup = (element: Element): string => {
		let out = "";
		for (
			let child = new client.native.Node(element).firstChild;
			child;
			child = new client.native.Node(child).nextSibling
		) {
			switch (text.type(child)) {
				case 3: // Text
				case 4: // CDATASection
					out += text.data(child as CharacterData);
					break;
				case 8: // Comment
					out += `<!--${new client.native.CharacterData(child).data}-->`;
					break;
				case 7: {
					// ProcessingInstruction
					const pi = new client.native.ProcessingInstruction(child);
					out += `<?${pi.target} ${pi.data}>`;
					break;
				}
				case 1: // Element
					out += serialize(
						new client.native.Element(child).outerHTML,
						insideForeignContext(client, child as Element)
					);
					break;
			}
		}

		return out;
	};

	/** Whether `node` is a script or a style, whose markup is its text. */
	const rawTextElement = (node: Node | null): boolean =>
		node !== null &&
		text.type(node) === 1 &&
		text.kind(node as Element) !== null;

	// https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-element-innerhtml
	client.Intercept(class extends Element {
		// the IDL union hands a TrustedHTML through as the object it is - that is
		// what the brand check is for - and on an engine with no TrustedHTML at
		// all the whole union degrades to a passthrough. the rewriters take a
		// string either way
		@Type("(TrustedHTML or [LegacyNullToEmptyString] DOMString)")
		set innerHTML(value: string) {
			// `tagName` rather than `innerHTML`: the brand check has to happen on
			// every path, and reading the native innerHTML to get one would
			// serialize the whole subtree for nothing
			void super.tagName;

			const html = String(value);

			// a script or a style is a raw text element: its "markup" is never
			// parsed as markup, it is the element's source
			if (text.kind(this) !== null) {
				text.setSource(this, html);

				return;
			}

			super.innerHTML = parse(
				html,
				"set Element.prototype.innerHTML",
				foreignContextForElement(client, this)
			);
		}

		@Type("(TrustedHTML or [LegacyNullToEmptyString] DOMString)")
		get innerHTML(): string {
			if (text.kind(this) !== null) {
				void super.tagName;

				return rawTextMarkup(this);
			}

			return serialize(super.innerHTML, foreignContextForElement(client, this));
		}

		@Type("(TrustedHTML or [LegacyNullToEmptyString] DOMString)")
		set outerHTML(value: string) {
			// replacing a child of a script or a style: the fragment is parsed
			// in that element's raw text context, which makes it one Text node
			// holding the string as written - that is, more of the program
			const parent = super.parentNode;
			if (rawTextElement(parent)) {
				text.insertText(parent!, this, String(value));
				super.remove();

				return;
			}

			super.outerHTML = parse(
				String(value),
				"set Element.prototype.outerHTML",
				// the fragment replaces this element, so it is parsed in the
				// context its *parent* supplies
				insideForeignContext(client, this)
			);
		}

		@Type("(TrustedHTML or [LegacyNullToEmptyString] DOMString)")
		get outerHTML(): string {
			// the serialization contains this element's own tag, so it has to be
			// re-parsed in the context that tag sits in
			return serialize(super.outerHTML, insideForeignContext(client, this));
		}

		@Arguments("(TrustedHTML or DOMString)", "optional SetHTMLUnsafeOptions")
		@Returns("undefined")
		setHTMLUnsafe(html: string, options?: SetHTMLUnsafeOptions): void {
			// the same raw text context as `innerHTML`'s: the markup is the source
			if (text.kind(this) !== null) {
				void super.tagName;
				text.setSource(this, String(html));

				return;
			}

			super.setHTMLUnsafe(
				parse(
					String(html),
					"Element.prototype.setHTMLUnsafe",
					foreignContextForElement(client, this)
				),
				options
			);
		}

		// the sanitizing sibling of setHTMLUnsafe. what it removes is scripting,
		// not URLs, so everything it leaves behind still has to be rewritten
		@Arguments("DOMString", "optional SetHTMLOptions")
		@Returns("undefined")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- calls super.setHTML on every path; setHTML is missing from lib.dom
		setHTML(html: string, options?: SetHTMLOptions): void {
			// https://wicg.github.io/sanitizer-api/#set-and-filter-html - a
			// script context is refused outright, and a style's text survives the
			// sanitizer as text. the native still runs first on an empty string,
			// for the options' validation and the script case's no-op
			const what = text.kind(this);
			if (what !== null) {
				super.setHTML("", options);
				if (what === "style") text.setSource(this, String(html));

				return;
			}

			super.setHTML(
				parse(
					String(html),
					"Element.prototype.setHTML",
					foreignContextForElement(client, this)
				),
				options
			);
		}

		@Arguments("optional GetHTMLOptions")
		@Returns("DOMString")
		getHTML(options?: GetHTMLOptions): string {
			// a raw text element serializes its children unescaped, so its markup
			// is its source - which the rewritten text in the document is not
			if (text.kind(this) !== null) {
				void super.getHTML(options);

				return rawTextMarkup(this);
			}

			return serialize(
				super.getHTML(options),
				foreignContextForElement(client, this)
			);
		}

		@Arguments("DOMString", "(TrustedHTML or DOMString)")
		@Returns("undefined")
		insertAdjacentHTML(position: string, string: string): void {
			void super.tagName;

			const where = String_toLowerCase(String(position));

			// a fragment parsed in a script's or a style's context is a single
			// Text node, so inserting one there is `insertAdjacentText`
			const outside = where === "beforebegin" || where === "afterend";
			const inside = where === "afterbegin" || where === "beforeend";
			const target = outside ? super.parentNode : inside ? this : null;
			if (rawTextElement(target)) {
				const reference =
					where === "beforebegin"
						? (this as Node)
						: where === "afterend"
							? super.nextSibling
							: where === "afterbegin"
								? super.firstChild
								: null;
				text.insertText(target!, reference, String(string));

				return;
			}

			// beforebegin and afterend parse against this element's parent, the
			// other two against this element
			const context =
				where === "beforebegin" || where === "afterend"
					? insideForeignContext(client, this)
					: foreignContextForElement(client, this);

			super.insertAdjacentHTML(
				position as InsertPosition,
				parse(String(string), "Element.prototype.insertAdjacentHTML", context)
			);
		}
	});

	// a shadow root's markup is parsed against its host, which is the element
	// the fragment will be rendered inside
	client.Intercept(class extends ShadowRoot {
		@Type("(TrustedHTML or [LegacyNullToEmptyString] DOMString)")
		set innerHTML(value: string) {
			super.innerHTML = parse(
				String(value),
				"set ShadowRoot.prototype.innerHTML",
				foreignContextForElement(client, super.host)
			);
		}

		@Type("(TrustedHTML or [LegacyNullToEmptyString] DOMString)")
		get innerHTML(): string {
			return serialize(
				super.innerHTML,
				foreignContextForElement(client, super.host)
			);
		}

		@Arguments("(TrustedHTML or DOMString)", "optional SetHTMLUnsafeOptions")
		@Returns("undefined")
		setHTMLUnsafe(html: string, options?: SetHTMLUnsafeOptions): void {
			super.setHTMLUnsafe(
				parse(
					String(html),
					"ShadowRoot.prototype.setHTMLUnsafe",
					foreignContextForElement(client, super.host)
				),
				options
			);
		}

		@Arguments("DOMString", "optional SetHTMLOptions")
		@Returns("undefined")
		setHTML(html: string, options?: SetHTMLOptions): void {
			super.setHTML(
				parse(
					String(html),
					"ShadowRoot.prototype.setHTML",
					foreignContextForElement(client, super.host)
				),
				options
			);
		}

		@Arguments("optional GetHTMLOptions")
		@Returns("DOMString")
		getHTML(options?: GetHTMLOptions): string {
			return serialize(
				super.getHTML(options),
				foreignContextForElement(client, super.host)
			);
		}
	});

	// https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-domparser-parsefromstring
	client.Intercept(class extends DOMParser {
		@Arguments("(TrustedHTML or DOMString)", "DOMParserSupportedType")
		@Returns("Document")
		parseFromString(string: string, type: DOMParserSupportedType): Document {
			const html = String(string);
			const mime = String(type);
			const isHtml = isHtmlMimeType(mime);

			return super.parseFromString(
				rewriteHtml(html, client.context, client.meta, {
					loadScripts: false,
					inline: true,
					source: client.url.href,
					apisource: "DOMParser.prototype.parseFromString",
					...(isHtml ? { scriptingEnabled: false } : { xmlMode: true }),
				}),
				type
			);
		}
	});
}
