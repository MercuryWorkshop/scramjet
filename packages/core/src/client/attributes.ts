/**
 * The attribute layer.
 *
 * Scramjet rewrites content attributes: `src` on an image is a proxy URL in the
 * live DOM, `nonce` is gone entirely, `style` has been through the CSS
 * rewriter. None of that may be visible to the page, so every rewritten
 * attribute is *mirrored* - the value the page wrote is kept alongside it in
 * `scramjet-attr-<name>`, and every read answers out of the mirror.
 *
 * The rules are the same ones the HTML rewriter applies while parsing
 * (`shared/htmlRules.ts`, plus the event handler attributes), so an attribute
 * written by script ends up in exactly the state it would have been in had it
 * come down in the markup: one table, one write path, one read path, whichever
 * member the page reached for.
 *
 * Everything that touches an attribute goes through the client's
 * {@link AttributeLayer} - `dom/element.ts`'s `Element` members, `dom/attr.ts`
 * for `Attr` and `NamedNodeMap`, `dom/reflect.ts` for the reflected IDL
 * attributes, and the text layer for a script's source. Nothing reads
 * `scramjet-attr-` by hand.
 *
 * Known hole: a MutationObserver sees the document, not this layer. One
 * `setAttribute("src", ...)` is two records - the mirror's, under its
 * `scramjet-attr-` name, and the real attribute's - with rewritten values in
 * `oldValue`, and a stripped attribute's change shows up under the mirror's
 * name alone. Hiding them means wrapping every observer's callback and
 * `takeRecords` to filter and rename records, and to recover old values the
 * document never held.
 */

import type { ScramjetClient } from "@client/index";
import { htmlRules } from "@/shared/htmlRules";
import { SCRIPT_SOURCE_ATTRIBUTE, eventAttributes } from "@rewriters/html";
import { rewriteJs } from "@rewriters/js";
import {
	_Map,
	_WeakMap,
	Array_indexOf,
	Reflect_apply,
	String,
	String_charCodeAt,
	String_indexOf,
	String_startsWith,
	String_substring,
	String_toLowerCase,
} from "@/shared/snapshot";

/**
 * The prefix on every attribute scramjet keeps for itself.
 *
 * Matched without the trailing dash when *hiding*, case-insensitively, so
 * nothing under the name can be read or written by a page however it spells
 * it. A trailing dash is required when computing a mirror, and that is the
 * only form we ever write.
 */
const INTERNAL_PREFIX = "scramjet-attr";
const MIRROR_PREFIX = "scramjet-attr-";

/**
 * Where a script element's original source is kept, in base64. The name is the
 * HTML rewriter's; both ends of the round trip have to agree on it.
 */
export { SCRIPT_SOURCE_ATTRIBUTE };

/** The HTML namespace, for the spec's "is in the HTML namespace" tests. */
export const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** The XLink namespace, which the legacy `xlink:href` lives in. */
export const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

/** The part of a qualified name after its prefix, if it has one. */
export function localPart(qualifiedName: string): string {
	const colon = String_indexOf(qualifiedName, ":");

	return colon === -1
		? qualifiedName
		: String_substring(qualifiedName, colon + 1);
}

/**
 * The name the rule table knows a namespaced attribute by, or null when no
 * rule can apply to it.
 *
 * The rules key on `xlink:href`, which is the spelling the HTML parser gives
 * the attribute. Through `setAttributeNS` the prefix is the page's to choose,
 * and `setAttributeNS(XLINK, "x:href", url)` is the same attribute - one the
 * browser fetches from - under a name no rule would otherwise match.
 *
 * Every other rule is for an attribute in the null namespace. `src` in some
 * page-chosen namespace is not the attribute an image loads from, and
 * rewriting it would put a proxy URL - and a mirror - where neither belongs.
 */
export function ruleAttributeName(
	namespace: string | null,
	qualifiedName: string
): string | null {
	if (namespace === null) return qualifiedName;
	if (namespace === XLINK_NAMESPACE && localPart(qualifiedName) === "href") {
		return "xlink:href";
	}

	return null;
}

/**
 * The "if namespace is the empty string, set it to null" step every `*NS`
 * member opens with, so that the rest can test for null alone.
 * https://dom.spec.whatwg.org/#validate-and-extract
 */
export function nullNamespace(namespace: string | null): string | null {
	return namespace === "" ? null : namespace;
}

/** Whether `qualifiedName` names an attribute of scramjet's own. */
export function isInternalAttribute(qualifiedName: string): boolean {
	return String_startsWith(String_toLowerCase(qualifiedName), INTERNAL_PREFIX);
}

/** The internal name mirroring `qualifiedName`. */
export function mirrorAttributeName(qualifiedName: string): string {
	return MIRROR_PREFIX + qualifiedName;
}

/**
 * The attribute `internalName` mirrors: `"scramjet-attr-src"` -> `"src"`.
 *
 * `""` for an internal attribute that mirrors nothing, and null for a name that
 * is not internal at all. The three cases are distinct - a caller walking the
 * attribute list surfaces the first, drops the second and passes the third
 * through.
 */
export function mirroredAttributeName(internalName: string): string | null {
	if (!isInternalAttribute(internalName)) return null;
	if (internalName === SCRIPT_SOURCE_ATTRIBUTE) return "";
	if (!String_startsWith(internalName, MIRROR_PREFIX)) return "";

	return String_substring(internalName, MIRROR_PREFIX.length);
}

/**
 * https://dom.spec.whatwg.org/#valid-attribute-local-name
 *
 * Checked here rather than left to the native because a rewritten attribute is
 * written mirror-first: handing an invalid name to the native would either name
 * the mirror in the message the page catches, or - worse - let the raw value
 * land under the real name before anything threw.
 */
export function isValidAttributeLocalName(name: string): boolean {
	if (name.length === 0) return false;

	for (let i = 0; i < name.length; i++) {
		const c = String_charCodeAt(name, i);
		if (
			c === 0x09 || // tab
			c === 0x0a || // LF
			c === 0x0c || // FF
			c === 0x0d || // CR
			c === 0x20 || // space
			c === 0x00 || // NUL
			c === 0x2f || // /
			c === 0x3d || // =
			c === 0x3e // >
		) {
			return false;
		}
	}

	return true;
}

/** Whether `name` contains an ASCII upper alpha, so lowercasing would change it. */
function hasUppercase(name: string): boolean {
	for (let i = 0; i < name.length; i++) {
		const c = String_charCodeAt(name, i);
		if (c >= 0x41 && c <= 0x5a) return true;
	}

	return false;
}

/** What a rule does to one attribute value; null means "remove the attribute". */
export type AttributeRewriter = (value: string) => string | null;

/**
 * The attribute primitives, bound to one client - `client.attributes`, built in
 * its constructor.
 *
 * Every member takes a *qualified* name, already run through {@link qualify}
 * by whoever accepted it from the page.
 */
export class AttributeLayer {
	/**
	 * The document as it really is, mirrors and all. Only for a caller that
	 * *means* the internal attribute - the script source, or a mirror it is
	 * maintaining itself.
	 */
	readonly raw: {
		get(element: Element, name: string): string | null;
		set(element: Element, name: string, value: string): void;
		remove(element: Element, name: string): void;
		has(element: Element, name: string): boolean;
	};

	/**
	 * The page's own `Attr` for a stripped attribute it inserted as a node.
	 *
	 * A rule that strips an attribute leaves only its mirror in the document,
	 * so the node the page handed to `setAttributeNode` can never really be
	 * attached - and the page expects `ownerElement` and `getAttributeNode` to
	 * go on answering with it. It is recorded here instead, and every member
	 * that would answer with the mirror's node answers with it. Keyed by
	 * element, then by name; the reverse map is for `ownerElement`.
	 */
	private readonly standIns = new _WeakMap<Element, _Map<string, Attr>>();
	private readonly standInOwners = new _WeakMap<Attr, Element>();

	constructor(private readonly client: ScramjetClient) {
		this.raw = {
			get: (element, name) =>
				new client.native.Element(element).getAttribute(name),
			set: (element, name, value) => {
				new client.native.Element(element).setAttribute(name, value);
			},
			remove: (element, name) => {
				new client.native.Element(element).removeAttribute(name);
			},
			has: (element, name) =>
				new client.native.Element(element).hasAttribute(name),
		};
	}

	/** `element`'s local name, case-preserved - the rules key on it. */
	localName(element: Element): string {
		return new this.client.native.Element(element).localName;
	}

	/** Whether `element` is an HTML element in an HTML document. */
	isHtml(element: Element): boolean {
		const nElement = new this.client.native.Element(element);

		return (
			nElement.namespaceURI === HTML_NAMESPACE &&
			this.client.box.instanceof(nElement.ownerDocument, "HTMLDocument")
		);
	}

	/**
	 * Step 2 of the spec's attribute algorithms: the lowercasing is conditional.
	 * An SVG or MathML element keeps `viewBox` as `viewBox`, and folding it
	 * writes a different, meaningless attribute.
	 */
	qualify(element: Element, qualifiedName: string): string {
		return hasUppercase(qualifiedName) && this.isHtml(element)
			? String_toLowerCase(qualifiedName)
			: qualifiedName;
	}

	/** The value the page should see, or null when the attribute is absent. */
	get(element: Element, qualifiedName: string): string | null {
		if (isInternalAttribute(qualifiedName)) return null;

		const mirror = this.raw.get(element, mirrorAttributeName(qualifiedName));
		if (mirror !== null) return mirror;

		return this.raw.get(element, qualifiedName);
	}

	/** Whether the page should see the attribute at all. */
	has(element: Element, qualifiedName: string): boolean {
		if (isInternalAttribute(qualifiedName)) return false;

		return (
			this.raw.has(element, qualifiedName) ||
			this.raw.has(element, mirrorAttributeName(qualifiedName))
		);
	}

	/** The rule for this attribute on this element, or null if it isn't rewritten. */
	rewriter(element: Element, qualifiedName: string): AttributeRewriter | null {
		const client = this.client;
		// keyed on the lowercased attribute name and on the element's *local*
		// name, which is the spelling the HTML rewriter matches against too.
		// `tagName` would uppercase every HTML element, and lowercasing that in
		// turn would never match `linearGradient`
		const name = String_toLowerCase(qualifiedName);
		const tag = this.localName(element);

		for (let i = 0; i < htmlRules.length; i++) {
			const rule = htmlRules[i];
			const selector = rule[name];
			if (!selector) continue;
			// `fn` is a key of the rule object like any other; an attribute
			// actually named "fn" would otherwise find the rewriter itself
			if (typeof selector === "function") continue;
			if (selector !== "*" && Array_indexOf(selector, tag) === -1) continue;

			return (value) =>
				rule.fn(value, client.context, client.meta, (other) =>
					this.get(element, other)
				);
		}

		// an event handler content attribute is javascript, and the parser
		// rewrites it. a page writing one through `setAttribute` has to reach the
		// same rewriter, or the handler runs against the real globals
		if (Array_indexOf(eventAttributes, name) !== -1) {
			return (value) =>
				rewriteJs(
					value,
					`(inline ${name} on element)`,
					client.context,
					client.meta,
					false,
					client
				) as string;
		}

		return null;
	}

	/** {@link rewriter}, for an attribute identified by namespace too. */
	rewriterNS(
		element: Element,
		namespace: string | null,
		qualifiedName: string
	): AttributeRewriter | null {
		const name = ruleAttributeName(namespace, qualifiedName);

		return name === null ? null : this.rewriter(element, name);
	}

	/**
	 * The attribute change steps scramjet keeps for itself, run after every
	 * write or removal that did not go through {@link set} or {@link remove}
	 * (both of which run it themselves). `value` is the page's value, or null
	 * for a removal.
	 */
	changed(element: Element, qualifiedName: string, value: string | null) {
		// https://html.spec.whatwg.org/multipage/urls-and-fetching.html#attr-nonce -
		// the nonce content attribute's change steps copy it into the
		// element's [[CryptographicNonce]], which is what the `nonce` IDL
		// attribute answers with. Writing the IDL attribute touches only the
		// slot, never the content attribute
		if (qualifiedName === "nonce") {
			this.client.box.nonces.set(element, value === null ? "" : value);
		}

		// `iframe.sandbox` is handed out from a stand-in element, because the
		// rule strips the real attribute and a token list over it would edit
		// the live iframe. the stand-in has to follow every other write
		if (qualifiedName === "sandbox") {
			const standIn = this.client.box.sandboxStandIns.get(element);
			if (standIn) {
				if (value === null) this.raw.remove(standIn, "sandbox");
				else this.raw.set(standIn, "sandbox", value);
			}
		}

		// a refresh's content is only a URL once `http-equiv` says so, and the
		// page may well set the two in the other order - so the content is
		// re-rewritten, from the page's own value, whenever that changes
		if (qualifiedName === "http-equiv" && this.localName(element) === "meta") {
			const content = this.get(element, "content");
			if (content !== null) this.set(element, "content", content);
		}

		// A script's block type controls whether its child text is code, data, or
		// an import map. When either legacy type attribute changes, re-derive the
		// live text from the saved source before a later child change can prepare
		// the script (HTML's "prepare the script element" algorithm, step 8).
		// https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element
		if (
			(qualifiedName === "type" || qualifiedName === "language") &&
			this.localName(element) === "script"
		) {
			this.client.text.sync(element);
		}
	}

	/** Write `value`, rewriting it and recording the mirror if a rule applies. */
	set(element: Element, qualifiedName: string, value: string): void {
		if (isInternalAttribute(qualifiedName)) return;

		const rewrite = this.rewriter(element, qualifiedName);
		if (!rewrite) {
			this.raw.set(element, qualifiedName, value);
			this.changed(element, qualifiedName, value);

			return;
		}

		const rewritten = rewrite(value);
		const stripped =
			rewritten === null && !this.raw.has(element, qualifiedName);
		const old = stripped
			? this.raw.get(element, mirrorAttributeName(qualifiedName))
			: null;

		// the mirror goes down first: the rewritten value can start a fetch the
		// moment it lands, and anything that reads the attribute back out of
		// that side effect has to already see the page's own value
		this.raw.set(element, mirrorAttributeName(qualifiedName), value);

		if (rewritten === null) this.raw.remove(element, qualifiedName);
		else this.raw.set(element, qualifiedName, rewritten);

		this.changed(element, qualifiedName, value);
		if (stripped) this.reactStripped(element, qualifiedName, old, value);
	}

	/** Remove the attribute and its mirror together. */
	remove(element: Element, qualifiedName: string): void {
		if (isInternalAttribute(qualifiedName)) return;

		// unconditionally, and both halves: a rule that removes the attribute
		// outright (`nonce`, `sandbox`) leaves nothing but the mirror behind, and
		// a removal that checked for the real one first would leave that mirror
		// to answer `getAttribute` forever
		const node: Attr | null = new this.client.native.Element(
			element
		).getAttributeNode(qualifiedName);
		const mirror = this.raw.get(element, mirrorAttributeName(qualifiedName));
		const standIn = this.standIn(element, qualifiedName);
		this.raw.remove(element, mirrorAttributeName(qualifiedName));
		this.raw.remove(element, qualifiedName);
		this.detached(node, mirror);
		if (standIn) this.release(element, qualifiedName, standIn, mirror);

		this.changed(element, qualifiedName, null);
		// a stripped attribute: the document saw only the mirror go, which no
		// custom element observes
		if (!node && mirror !== null) {
			this.reactStripped(element, qualifiedName, mirror, null);
		}
	}

	/**
	 * Remove the stripped attribute `name`, which only its mirror represents,
	 * and hand back the node the page should get for it: its own `Attr` if it
	 * inserted one, the mirror's node - renamed by `dom/attr.ts` - otherwise.
	 */
	removeStripped(element: Element, name: string): Attr | null {
		const node =
			this.standIn(element, name) ??
			new this.client.native.Element(element).getAttributeNode(
				mirrorAttributeName(name)
			);
		this.remove(element, name);

		return node;
	}

	/** The page's `Attr` standing in for the stripped attribute `name`, or null. */
	standIn(element: Element, name: string): Attr | null {
		const map = this.standIns.get(element);
		const attr = map?.get(name);
		if (!map || !attr) return null;

		// the attribute has since landed in the document for real, or its
		// mirror has gone some way that did not come through here
		if (
			this.raw.has(element, name) ||
			!this.raw.has(element, mirrorAttributeName(name))
		) {
			map.delete(name);
			this.standInOwners.delete(attr);

			return null;
		}

		return attr;
	}

	/** Detach a stand-in, which goes back to answering with its own value. */
	private release(
		element: Element,
		name: string,
		attr: Attr,
		value: string | null
	) {
		this.standIns.get(element)?.delete(name);
		this.standInOwners.delete(attr);
		if (value !== null) this.setAttrValue(attr, value);
	}

	/** The node the page should see in place of `attr`, a node of the document's. */
	face(element: Element, attr: Attr): Attr {
		const mirrored = mirroredAttributeName(this.attrName(attr));
		if (!mirrored) return attr;

		return this.standIn(element, mirrored) ?? attr;
	}

	/**
	 * `attributeChangedCallback` for a change to a stripped attribute, which
	 * the document never sees - so the browser never enqueues the reaction.
	 * Run synchronously, which is where the native reaction runs for a call
	 * from script.
	 *
	 * The observed list and the callback are read off the definition now,
	 * rather than captured by `define` the way the spec has it: reading them
	 * at `define` would mean reading them a second time. Only an autonomous
	 * custom element is recognized; a customized built-in's `is` value is not
	 * readable from here.
	 *
	 * https://html.spec.whatwg.org/multipage/custom-elements.html#concept-custom-element-reaction
	 */
	private reactStripped(
		element: Element,
		name: string,
		oldValue: string | null,
		newValue: string | null
	) {
		const client = this.client;
		const registry = client.global.customElements as
			| CustomElementRegistry
			| undefined;
		if (!registry) return;

		const nElement = new client.native.Element(element);
		let definition: CustomElementConstructor | undefined;
		try {
			definition = new client.native.CustomElementRegistry(registry).get(
				nElement.localName
			);
		} catch {
			return;
		}
		// defined, but this element not yet upgraded to it
		if (typeof definition !== "function" || !nElement.matches(":defined")) {
			return;
		}

		let callback: unknown;
		let listed = false;
		try {
			callback = definition.prototype.attributeChangedCallback;
			const observed = (definition as any).observedAttributes;
			if (observed === undefined || observed === null) return;
			for (const entry of observed as Iterable<unknown>) {
				if (String(entry) === name) listed = true;
			}
		} catch {
			return;
		}
		if (!listed || typeof callback !== "function") return;

		try {
			Reflect_apply(callback, element, [name, oldValue, newValue, null]);
		} catch (err) {
			// a reaction's exception is reported, never thrown at the caller
			new client.native.window(client.global).reportError(err);
		}
	}

	/** The qualified names the page should see, in the document's order. */
	names(element: Element): string[] {
		const all: string[] = new this.client.native.Element(
			element
		).getAttributeNames();

		let internal = false;
		for (let i = 0; i < all.length; i++) {
			if (isInternalAttribute(all[i])) {
				internal = true;
				break;
			}
		}
		if (!internal) return all;

		const out: string[] = [];
		for (let i = 0; i < all.length; i++) {
			const name = all[i];
			const mirrored = mirroredAttributeName(name);

			// an ordinary attribute, in its own position
			if (mirrored === null) {
				out[out.length] = name;
				continue;
			}
			// internal, and standing in for nothing
			if (mirrored === "") continue;
			// a mirror whose attribute is still there is a duplicate of it
			if (this.raw.has(element, mirrored)) continue;

			// the rule removed the attribute, so its mirror is all that is left
			// to represent it
			out[out.length] = mirrored;
		}

		return out;
	}

	/**
	 * The `Attr` nodes the page should see, in the document's order - what
	 * {@link names} lists, as nodes. Not looked up by name: two attributes in
	 * different namespaces can share a qualified name, and a lookup would find
	 * the first one for both.
	 */
	nodes(element: Element): Attr[] {
		const map = new this.client.native.NamedNodeMap(
			new this.client.native.Element(element).attributes
		);
		const length = map.length;
		const out: Attr[] = [];
		for (let i = 0; i < length; i++) {
			const attr: Attr = map.item(i);
			const mirrored = mirroredAttributeName(this.attrName(attr));
			if (mirrored === "") continue;
			if (mirrored !== null && this.raw.has(element, mirrored)) continue;
			out[out.length] = mirrored === null ? attr : this.face(element, attr);
		}

		return out;
	}

	/**
	 * The page's value for `attr`, out of its element's mirror, or null when it
	 * has none.
	 *
	 * The mirror is keyed on the qualified name, and it belongs to the
	 * attribute a lookup by that name finds - the first one holding it. A
	 * later attribute that happens to share the name, in another namespace,
	 * has a value of its own.
	 */
	mirrorOf(element: Element, attr: Attr): string | null {
		if (this.standIn(element, this.attrName(attr)) === attr) {
			return this.raw.get(element, mirrorAttributeName(this.attrName(attr)));
		}

		const name = this.heldName(element, attr);
		if (isInternalAttribute(name)) return null;
		if (new this.client.native.Element(element).getAttributeNode(name) !== attr)
			return null;

		return this.raw.get(element, mirrorAttributeName(name));
	}

	/**
	 * The qualified name `element` holds `attr` under, which is what its
	 * mirror is keyed on.
	 *
	 * Usually the node's own name. But Blink replaces an attribute with the
	 * same namespace and local name in place and keeps the old qualified name:
	 * `p:href` set over `xlink:href` is listed, looked up and serialized as
	 * `xlink:href`, while the node goes on calling itself `p:href`.
	 */
	heldName(element: Element, attr: Attr): string {
		const name = this.attrName(attr);
		const nElement = new this.client.native.Element(element);
		if (nElement.getAttributeNode(name) === attr) return name;

		const map = new this.client.native.NamedNodeMap(nElement.attributes);
		const length = map.length;
		for (let i = 0; i < length; i++) {
			if (map.item(i) === attr) return nElement.getAttributeNames()[i];
		}

		return name;
	}

	/** The `Attr` node the page should see for `qualifiedName`, or null. */
	node(element: Element, qualifiedName: string): Attr | null {
		if (isInternalAttribute(qualifiedName)) return null;

		const nElement = new this.client.native.Element(element);
		const real: Attr | null = nElement.getAttributeNode(qualifiedName);
		if (real) return real;

		// a removed attribute is represented by the page's own node, if it
		// inserted one, and by its mirror's node - which `dom/attr.ts` renames
		// back - if it did not
		return (
			this.standIn(element, qualifiedName) ??
			nElement.getAttributeNode(mirrorAttributeName(qualifiedName))
		);
	}

	/**
	 * The mirror node standing in for a stripped attribute named `localName`,
	 * for a namespace-less `*NS` lookup the native could not answer. Only when
	 * nothing in the document holds that qualified name: a namespaced
	 * `xlink:href` is not in the null namespace, and its mirror must not make
	 * it look as though it were.
	 */
	strippedNode(element: Element, localName: string): Attr | null {
		if (isInternalAttribute(localName)) return null;
		if (this.raw.has(element, localName)) return null;

		return (
			this.standIn(element, localName) ??
			new this.client.native.Element(element).getAttributeNode(
				mirrorAttributeName(localName)
			)
		);
	}

	/**
	 * Hand a node that has just left its element the page's value back.
	 *
	 * Detached, an `Attr` answers with what it holds, which for a rewritten
	 * attribute is the proxy's value - so the mirror it was answering out of
	 * a moment ago is written into it. `mirror` is read before the removal.
	 */
	detached(attr: Attr | null, mirror: string | null): void {
		if (!attr || mirror === null) return;
		if (isInternalAttribute(this.attrName(attr))) return;
		if (this.owner(attr) !== null) return;

		this.setAttrValue(attr, mirror);
	}

	/**
	 * The element an `Attr` node belongs to, or null when it is detached - as
	 * the page sees it, so a stand-in belongs to the element it stands in on.
	 */
	owner(attr: Attr): Element | null {
		const owner = this.nativeOwner(attr);
		if (owner) return owner;

		const element = this.standInOwners.get(attr);

		return element && this.standIn(element, this.attrName(attr)) === attr
			? element
			: null;
	}

	/** The element the document really has `attr` on. */
	nativeOwner(attr: Attr): Element | null {
		return new this.client.native.Attr(attr).ownerElement;
	}

	/** An `Attr`'s qualified name, as the document holds it. */
	attrName(attr: Attr): string {
		return new this.client.native.Attr(attr).name;
	}

	/** An `Attr`'s value, as the document holds it. */
	attrValue(attr: Attr): string {
		return new this.client.native.Attr(attr).value;
	}

	/** An `Attr`'s namespace. */
	attrNamespace(attr: Attr): string | null {
		return new this.client.native.Attr(attr).namespaceURI;
	}

	/** Write an `Attr`'s value without going through its element. */
	setAttrValue(attr: Attr, value: string): void {
		new this.client.native.Attr(attr).value = value;
	}

	/**
	 * The value an `Attr` should report to the page, which is its element's
	 * mirror when it has one. What `Attr.value` answers, and `nodeValue` and
	 * `textContent` when the node is an attribute.
	 */
	visibleValue(attr: Attr): string {
		const name = this.attrName(attr);
		// a mirror's own value *is* the page's value
		if (isInternalAttribute(name)) return this.attrValue(attr);

		const owner = this.owner(attr);
		if (!owner) return this.attrValue(attr);

		const mirror = this.mirrorOf(owner, attr);

		return mirror === null ? this.attrValue(attr) : mirror;
	}

	/** The write half of {@link visibleValue}, so a rule sees the value first. */
	setVisibleValue(attr: Attr, value: string): void {
		const name = this.attrName(attr);
		const owner = this.owner(attr);

		// detached, or the mirror itself: there is no rule to apply, and writing
		// the mirror is how the page's value is meant to be changed
		if (!owner || isInternalAttribute(name)) {
			const old = this.attrValue(attr);
			this.setAttrValue(attr, value);
			// a mirror node stands in for the attribute its rule stripped, so
			// this is a change to *that* attribute, and its change steps run -
			// `nonce`'s slot and `sandbox`'s token list follow it
			const mirrored = owner ? mirroredAttributeName(name) : null;
			if (mirrored) {
				this.changed(owner!, mirrored, value);
				this.reactStripped(owner!, mirrored, old, value);
			}

			return;
		}

		const namespace = this.attrNamespace(attr);
		const owns =
			new this.client.native.Element(owner).getAttributeNode(name) === attr ||
			this.standIn(owner, name) === attr;
		// the attribute a write by name reaches, so the write by name is the same
		// operation
		if (namespace === null && owns) {
			this.set(owner, name, value);

			return;
		}

		// a namespaced attribute - `p:href` in XLink is the same attribute as
		// `xlink:href`, and has to reach the same rule - or one that shares its
		// qualified name with another, which a write by name would miss. either
		// way it is this node that is written
		const rewrite = this.rewriterNS(owner, namespace, name);
		if (!rewrite) {
			this.setAttrValue(attr, value);

			return;
		}

		const rewritten = rewrite(value);
		if (owns) this.raw.set(owner, mirrorAttributeName(name), value);
		if (rewritten !== null) {
			this.setAttrValue(attr, rewritten);

			return;
		}

		new this.client.native.Element(owner).removeAttributeNode(attr);
		this.setAttrValue(attr, value);
	}

	/**
	 * {@link insertNode} for an attribute its rule strips. It never lands in
	 * the document - inserting it only to take it out again would be two
	 * mutations a MutationObserver or a custom element would see - so its
	 * mirror is written, and the node itself becomes the stand-in the page's
	 * lookups answer with. The node it replaces is the previous stand-in, if
	 * the page inserted one.
	 */
	private insertStripped(
		element: Element,
		name: string,
		attr: Attr,
		value: string,
		old: string | null
	): Attr | null {
		const previous = this.standIn(element, name);

		this.raw.set(element, mirrorAttributeName(name), value);

		let map = this.standIns.get(element);
		if (!map) {
			map = new _Map<string, Attr>();
			this.standIns.set(element, map);
		}
		if (previous) this.release(element, name, previous, old);
		map.set(name, attr);
		this.standInOwners.set(attr, element);

		this.changed(element, name, value);
		this.reactStripped(element, name, old, value);

		return previous;
	}

	/**
	 * `setAttributeNode` and `setAttributeNodeNS`, which `NamedNodeMap`'s
	 * `setNamedItem` and `setNamedItemNS` are the same operation as.
	 *
	 * The rewriting happens *before* the node is inserted: for `src` on a
	 * connected element the browser starts fetching the moment the attribute
	 * lands, so fixing the value up afterwards would be one request to the real
	 * origin every time.
	 */
	insertNode(element: Element, attr: Attr, namespaced: boolean): Attr | null {
		const nElement = new this.client.native.Element(element);
		const insert = (): Attr | null =>
			namespaced
				? nElement.setAttributeNodeNS(attr)
				: nElement.setAttributeNode(attr);

		// an attribute that already belongs to an element is either this
		// element's - a no-op the native answers with the node itself - or
		// another's, which is an InUseAttributeError. neither may be rewritten
		// first: the value is already the rewritten one, and rewriting it again
		// would land a proxy URL in the mirror
		if (this.nativeOwner(attr) !== null) return insert();
		// the same two cases, for a node that only looks attached
		const standingIn = this.owner(attr);
		if (standingIn === element) return attr;
		if (standingIn) {
			throw this.client.errors.domException("InUseAttributeError", {
				execute: namespaced ? "setAttributeNodeNS" : "setAttributeNode",
				on: "Element",
				detail:
					"The node provided is an attribute node that is already an attribute of another Element; attribute nodes must be explicitly cloned.",
			});
		}

		const name = this.attrName(attr);
		// a page-built attribute under our own prefix would poison a mirror, so
		// it is dropped the same way `setAttribute` drops one
		if (isInternalAttribute(name)) {
			void nElement.hasAttributes();

			return null;
		}

		const value = this.attrValue(attr);
		const namespace = this.attrNamespace(attr);
		const rewrite = this.rewriterNS(element, namespace, name);

		// the node being replaced, and what it answered with, so it can go on
		// answering with it once it is detached. both members replace by
		// namespace and local name, which need not be the same qualified name -
		// `p:href` in XLink replaces `xlink:href`
		// https://dom.spec.whatwg.org/#concept-element-attributes-set
		const previous: Attr | null = nElement.getAttributeNodeNS(
			namespace,
			new this.client.native.Attr(attr).localName
		);
		const previousName = previous ? this.attrName(previous) : null;
		const previousMirror = previous ? this.mirrorOf(element, previous) : null;

		const mirrorName = mirrorAttributeName(name);
		const staleMirror = this.raw.get(element, mirrorName);
		let rewritten: string | null = value;
		if (rewrite) {
			rewritten = rewrite(value);
			if (rewritten === null && !previous) {
				return this.insertStripped(element, name, attr, value, staleMirror);
			}
			this.setAttrValue(attr, rewritten === null ? "" : rewritten);
			// the mirror goes down first, for the reason `set` gives - and
			// because inserting the node runs a custom element's
			// attributeChangedCallback, which reads the attribute back
			this.raw.set(element, mirrorName, value);
		}

		let replaced: Attr | null;
		try {
			replaced = insert();
		} catch (err) {
			// a namespace clash, or an element that is not one - the node the
			// page still holds must not come back carrying the rewritten value,
			// and the element must not come back carrying its mirror
			if (rewrite) {
				if (staleMirror === null) this.raw.remove(element, mirrorName);
				else this.raw.set(element, mirrorName, staleMirror);
				this.setAttrValue(attr, value);
			}
			throw err;
		}

		// the name the document holds it under now. Blink replaces an attribute
		// with the same namespace and local name in place, keeping the old
		// qualified name - so `p:href` inserted over `xlink:href` is held as
		// `xlink:href`, and the mirror has to follow it there
		const held = this.owner(attr) ? this.heldName(element, attr) : name;
		if (rewrite && held !== name) {
			this.raw.set(element, mirrorAttributeName(held), value);
			if (staleMirror === null) this.raw.remove(element, mirrorName);
			else this.raw.set(element, mirrorName, staleMirror);
		}

		// the replaced node's mirror stops answering: it is gone, and nothing
		// takes its place under that name unless the new node was mirrored there
		if (previousMirror !== null && (previousName !== held || !rewrite)) {
			this.raw.remove(element, mirrorAttributeName(previousName!));
		}
		this.detached(replaced, previousMirror);
		this.changed(element, held, value);

		if (rewritten !== null) return replaced;

		// the rule wants the attribute gone. it had to be inserted all the same -
		// that is what makes this a *replacement* of whatever was there, which is
		// the node the page is handed back
		this.raw.remove(element, held);
		// and the node the page still holds gets its own value back, now that it
		// is detached and writing it has no effect on the document
		this.setAttrValue(attr, value);

		return replaced;
	}
}
