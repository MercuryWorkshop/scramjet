/**
 * The `Node`, `CharacterData` and `Text` members - and a script's own
 * `textContent`, `innerText` and `text` - over the text layer
 * (`client/text.ts`, `client.text`), which holds what the page wrote to a
 * script or a style and keeps the document holding its rewritten whole.
 *
 * https://dom.spec.whatwg.org/#interface-characterdata
 * https://html.spec.whatwg.org/multipage/dom.html#the-innertext-idl-attribute
 */

import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type } from "@client/webidl";
import { mirroredAttributeName } from "@client/attributes";
import {
	Object_hasOwn,
	String,
	String_substring,
	String_toLowerCase,
} from "@/shared/snapshot";

/** Node types, as `Node.prototype.nodeType` reports them. */
const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

export default function (client: ScramjetClient, _self: Self) {
	const text = client.text;
	const attrs = client.attributes;

	/**
	 * The arguments of an insertion that takes `(Node or DOMString)`, with every
	 * string turned into a Text node when the target is a script or a style.
	 *
	 * The conversion is what the native would do anyway
	 * (https://dom.spec.whatwg.org/#converting-nodes-into-a-node); doing it here
	 * means the text is a node we can blank before it lands.
	 */
	/**
	 * A node that has just left a script or a style is plain text again, and
	 * the document should hold what it reads as. It is detached, so writing its
	 * data runs nothing.
	 */
	const leftRawText = (node: Node) => {
		const what = text.type(node);
		if (what !== TEXT_NODE && what !== CDATA_SECTION_NODE) return;
		if (!client.box.characterDataSources.has(node as CharacterData)) return;

		text.restore(node as CharacterData);
	};

	/**
	 * `node`, if it is a script or a style, and every one under it - the ones
	 * `normalize` will actually merge, which is those with more than one Text
	 * child. The rest are left alone: re-deriving one means rewriting its whole
	 * program again, for nothing.
	 */
	const rawTextInclusiveDescendants = (node: Node): Element[] => {
		const what = text.type(node);
		const out: Element[] = [];
		const merges = (element: Element) =>
			text.kind(element) !== null && text.textChildren(element).length > 1;
		if (what === ELEMENT_NODE && merges(node as Element)) {
			out[out.length] = node as Element;
		}

		// the same per-interface copies as `containsRawText`'s
		const parent =
			what === ELEMENT_NODE
				? new client.native.Element(node)
				: what === DOCUMENT_FRAGMENT_NODE
					? new client.native.DocumentFragment(node)
					: what === DOCUMENT_NODE
						? new client.native.Document(node)
						: null;
		if (!parent) return out;

		const found: NodeListOf<Element> = parent.querySelectorAll("script,style");
		for (let i = 0; i < found.length; i++) {
			if (merges(found[i])) out[out.length] = found[i];
		}

		return out;
	};

	const asNodes = (parent: Node | null, args: unknown[]): unknown[] => {
		if (!parent || text.type(parent) !== ELEMENT_NODE) return args;
		if (text.kind(parent as Element) === null) return args;

		const out: unknown[] = [];
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			out[i] = text.isNode(arg) ? arg : text.createText(parent, String(arg));
		}

		return out;
	};

	// https://dom.spec.whatwg.org/#interface-node
	client.Intercept(class extends Node {
		@Type("DOMString?")
		get nodeValue(): string | null {
			const what = super.nodeType;
			if (what === ATTRIBUTE_NODE) return attrs.visibleValue(this as any);
			if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
				return text.data(this as any);
			}

			return super.nodeValue;
		}

		@Type("DOMString?")
		set nodeValue(value: string | null) {
			const what = super.nodeType;
			if (what === ATTRIBUTE_NODE) {
				attrs.setVisibleValue(this as any, value === null ? "" : String(value));

				return;
			}
			if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
				text.setData(this as any, value === null ? "" : String(value));

				return;
			}

			super.nodeValue = value;
		}

		@Type("DOMString")
		get nodeName(): string {
			const name = super.nodeName;
			// an attribute's node name is its qualified name, and a mirror
			// standing in for a removed attribute answers under that attribute's
			if (super.nodeType !== ATTRIBUTE_NODE) return name;
			const mirrored = mirroredAttributeName(name);

			return mirrored ? mirrored : name;
		}

		@Type("DOMString?")
		get textContent(): string | null {
			const what = super.nodeType;
			if (what === ATTRIBUTE_NODE) return attrs.visibleValue(this as any);
			if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
				return text.data(this as any);
			}
			if (what !== ELEMENT_NODE && what !== DOCUMENT_FRAGMENT_NODE) {
				return super.textContent;
			}

			if (!text.containsRawText(this as Node)) return super.textContent;

			// the descendant text content, a script's or a style's included: an
			// element appended under one is not code, but its text still counts
			return text.descendantText(this as Node);
		}

		@Type("DOMString?")
		set textContent(value: string | null) {
			const what = super.nodeType;
			const replacement = value === null ? "" : String(value);

			if (what === ATTRIBUTE_NODE) {
				attrs.setVisibleValue(this as any, replacement);

				return;
			}
			if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
				text.setData(this as any, replacement);

				return;
			}
			if (what === ELEMENT_NODE && text.kind(this as any) !== null) {
				text.setSource(this as any, replacement);

				return;
			}

			super.textContent = value;
		}

		@Arguments("optional boolean")
		@Returns("Node")
		cloneNode(subtree?: boolean): Node {
			const clone = super.cloneNode(subtree);
			text.cloned(this as Node, clone);

			return clone;
		}

		@Arguments("Node")
		@Returns("Node")
		appendChild<T extends Node>(node: T): T {
			void super.nodeType;

			return text.around(this as Node, [node], () => super.appendChild(node));
		}

		@Arguments("Node", "Node?")
		@Returns("Node")
		insertBefore<T extends Node>(node: T, child: Node | null): T {
			void super.nodeType;

			return text.around(this as Node, [node], () =>
				super.insertBefore(node, child)
			);
		}

		@Arguments("Node", "Node")
		@Returns("Node")
		replaceChild<T extends Node>(node: Node, child: T): T {
			void super.nodeType;

			const self = this as Node;
			const owner =
				text.type(self) === ELEMENT_NODE && text.kind(self as Element) !== null
					? (self as Element)
					: null;
			if (owner) text.adopt(owner);

			const replaced = text.around(self, [node], () =>
				super.replaceChild(node, child)
			);
			// the child that left a script is plain text again
			if (owner) leftRawText(replaced);

			return replaced;
		}

		@Arguments("Node")
		@Returns("Node")
		removeChild<T extends Node>(child: T): T {
			const self = this as Node;
			const owner =
				text.type(self) === ELEMENT_NODE && text.kind(self as Element) !== null
					? (self as Element)
					: null;
			if (owner) text.adopt(owner);

			const removed = super.removeChild(child);
			if (owner) {
				leftRawText(removed);
				text.sync(owner);
			}

			return removed;
		}

		@Arguments()
		@Returns("undefined")
		normalize(): void {
			// every script and style with more than one Text child is
			// normalized over the page's text first, which leaves the native
			// nothing of theirs to merge or remove; its records are then turned
			// back into the rewritten whole
			const self = this as Node;
			const affected = rawTextInclusiveDescendants(self);
			for (let i = 0; i < affected.length; i++) {
				text.normalizeChildren(affected[i]);
			}

			super.normalize();

			for (let i = 0; i < affected.length; i++) text.sync(affected[i]);
		}
	});

	// https://dom.spec.whatwg.org/#interface-parentnode, on the one kind of
	// parent that can hold code rather than text
	client.Intercept(class extends Element {
		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		append(...nodes: (Node | string)[]): void {
			void super.hasAttributes();

			const args = asNodes(this, nodes) as (Node | string)[];
			text.around(this, args, () => super.append(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		prepend(...nodes: (Node | string)[]): void {
			void super.hasAttributes();

			const args = asNodes(this, nodes) as (Node | string)[];
			text.around(this, args, () => super.prepend(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		replaceChildren(...nodes: (Node | string)[]): void {
			void super.hasAttributes();

			const args = asNodes(this, nodes) as (Node | string)[];
			text.around(this, args, () => super.replaceChildren(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		after(...nodes: (Node | string)[]): void {
			const parent = super.parentNode;
			const args = asNodes(parent, nodes) as (Node | string)[];
			text.around(parent, args, () => super.after(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		before(...nodes: (Node | string)[]): void {
			const parent = super.parentNode;
			const args = asNodes(parent, nodes) as (Node | string)[];
			text.around(parent, args, () => super.before(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		replaceWith(...nodes: (Node | string)[]): void {
			const parent = super.parentNode;
			const args = asNodes(parent, nodes) as (Node | string)[];
			text.around(parent, args, () => super.replaceWith(...args));
		}

		@Arguments("DOMString", "DOMString")
		@Returns("undefined")
		insertAdjacentText(where: string, data: string): void {
			// beforebegin and afterend insert into this element's parent;
			// afterbegin and beforeend into this element
			void super.hasAttributes();

			const position = String_toLowerCase(String(where));
			const outside = position === "beforebegin" || position === "afterend";
			const inside = position === "afterbegin" || position === "beforeend";
			const parent = outside ? super.parentNode : (this as Node);

			// an unknown position is the native's SyntaxError to throw, and a
			// parent that is not a script or a style is the native's to insert
			// into
			if (
				(!outside && !inside) ||
				!parent ||
				text.type(parent) !== ELEMENT_NODE ||
				text.kind(parent as Element) === null
			) {
				return super.insertAdjacentText(where as InsertPosition, data);
			}

			// as a node rather than as a string, so that it can be blanked
			// before it reaches the element and prepares the script
			const reference =
				position === "beforebegin"
					? (this as Node)
					: position === "afterend"
						? super.nextSibling
						: position === "afterbegin"
							? super.firstChild
							: null;
			text.insertText(parent, reference, String(data));
		}

		// https://dom.spec.whatwg.org/#dom-parentnode-movebefore - an atomic
		// move, which is an insertion like any other as far as a script's text
		// is concerned. absent before Chrome 133, which `Intercept` skips
		@Arguments("Node", "Node?")
		@Returns("undefined")
		moveBefore(node: Node, child: Node | null): void {
			void super.hasAttributes();

			text.around(this, [node], () => super.moveBefore(node, child));
		}
	});

	// https://dom.spec.whatwg.org/#interface-parentnode, on the two parents
	// that are never a script or a style themselves - but whose insertions can
	// still take a Text node out of one
	client.Intercept(class extends DocumentFragment {
		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		append(...nodes: (Node | string)[]): void {
			void super.childElementCount;

			text.around(this, nodes, () => super.append(...nodes));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		prepend(...nodes: (Node | string)[]): void {
			void super.childElementCount;

			text.around(this, nodes, () => super.prepend(...nodes));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		replaceChildren(...nodes: (Node | string)[]): void {
			void super.childElementCount;

			text.around(this, nodes, () => super.replaceChildren(...nodes));
		}

		@Arguments("Node", "Node?")
		@Returns("undefined")
		moveBefore(node: Node, child: Node | null): void {
			void super.childElementCount;

			text.around(this, [node], () => super.moveBefore(node, child));
		}
	});

	client.Intercept(class extends Document {
		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		append(...nodes: (Node | string)[]): void {
			void super.childElementCount;

			text.around(this, nodes, () => super.append(...nodes));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		prepend(...nodes: (Node | string)[]): void {
			void super.childElementCount;

			text.around(this, nodes, () => super.prepend(...nodes));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		replaceChildren(...nodes: (Node | string)[]): void {
			void super.childElementCount;

			text.around(this, nodes, () => super.replaceChildren(...nodes));
		}

		@Arguments("Node", "Node?")
		@Returns("undefined")
		moveBefore(node: Node, child: Node | null): void {
			void super.childElementCount;

			text.around(this, [node], () => super.moveBefore(node, child));
		}
	});

	client.Intercept(class extends Document {
		// `(boolean or ImportNodeOptions)` where the engine has the options
		// bag, `boolean` where it does not - so the argument goes to the native
		// untouched, to be converted by whichever this is
		@Arguments("Node", "optional any")
		@Returns("Node")
		importNode<T extends Node>(node: T, subtree?: any): T {
			const clone = super.importNode(node, subtree);
			text.cloned(node, clone);

			return clone;
		}
	});

	// https://dom.spec.whatwg.org/#interface-characterdata
	client.Intercept(class extends CharacterData {
		@Type("[LegacyNullToEmptyString] DOMString")
		get data(): string {
			void super.length;

			return text.data(this);
		}

		@Type("[LegacyNullToEmptyString] DOMString")
		set data(value: string) {
			void super.length;

			text.setData(this, String(value));
		}

		@Type("unsigned long")
		get length(): number {
			const native = super.length;
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) return native;

			return text.data(this).length;
		}

		@Arguments("unsigned long", "unsigned long")
		@Returns("DOMString")
		substringData(offset: number, count: number): string {
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) {
				return super.substringData(offset, count);
			}
			void super.length;

			const value = text.data(this);
			if (offset > value.length) throw indexSize("substringData");

			return String_substring(value, offset, offset + count);
		}

		@Arguments("DOMString")
		@Returns("undefined")
		appendData(data: string): void {
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) return super.appendData(data);
			void super.length;

			text.setData(this, text.data(this) + String(data));
		}

		@Arguments("unsigned long", "DOMString")
		@Returns("undefined")
		insertData(offset: number, data: string): void {
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) {
				return super.insertData(offset, data);
			}
			void super.length;

			replaceData(this, offset, 0, data, "insertData");
		}

		@Arguments("unsigned long", "unsigned long")
		@Returns("undefined")
		deleteData(offset: number, count: number): void {
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) {
				return super.deleteData(offset, count);
			}
			void super.length;

			replaceData(this, offset, count, "", "deleteData");
		}

		// https://dom.spec.whatwg.org/#concept-cd-replace, over the text the page
		// wrote rather than over the rewritten text the document holds - the two
		// have nothing to do with one another, and an offset into the second is
		// meaningless
		@Arguments("unsigned long", "unsigned long", "DOMString")
		@Returns("undefined")
		replaceData(offset: number, count: number, data: string): void {
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) {
				return super.replaceData(offset, count, data);
			}
			void super.length;

			replaceData(this, offset, count, data, "replaceData");
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		after(...nodes: (Node | string)[]): void {
			const parent = super.parentNode;
			const args = asNodes(parent, nodes) as (Node | string)[];
			text.around(parent, args, () => super.after(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		before(...nodes: (Node | string)[]): void {
			const parent = super.parentNode;
			const args = asNodes(parent, nodes) as (Node | string)[];
			text.around(parent, args, () => super.before(...args));
		}

		@Arguments("(Node or DOMString)...")
		@Returns("undefined")
		replaceWith(...nodes: (Node | string)[]): void {
			const parent = super.parentNode;
			const args = asNodes(parent, nodes) as (Node | string)[];
			text.around(parent, args, () => super.replaceWith(...args));
		}

		@Arguments()
		@Returns("undefined")
		remove(): void {
			const parent = super.parentNode;
			const owner =
				parent &&
				text.type(parent) === ELEMENT_NODE &&
				text.kind(parent as Element) !== null
					? (parent as Element)
					: null;
			if (owner) text.adopt(owner);

			super.remove();

			if (owner) {
				leftRawText(this);
				text.sync(owner);
			}
		}
	});

	/**
	 * https://dom.spec.whatwg.org/#concept-cd-replace, over the text the page
	 * wrote rather than over the rewritten text the document holds - the two
	 * have nothing to do with one another, and an offset into the second is
	 * meaningless. `insertData` and `deleteData` are this with a zero count or
	 * an empty string; they call it here rather than through `this`, which is
	 * the page's to redefine.
	 */
	const replaceData = (
		node: CharacterData,
		offset: number,
		count: number,
		data: string,
		member: string
	) => {
		// 1. Let length be node's length
		const value = text.data(node);
		// 2. If offset is greater than length, throw an "IndexSizeError"
		if (offset > value.length) throw indexSize(member);
		// 3. If offset plus count is greater than length, set count to length
		//    minus offset
		const end = offset + count > value.length ? value.length : offset + count;

		// 4-6. splice the data
		text.setData(
			node,
			String_substring(value, 0, offset) +
				String(data) +
				String_substring(value, end)
		);
	};

	const indexSize = (member: string) =>
		client.errors.domException("IndexSizeError", {
			execute: member,
			on: "CharacterData",
			detail: "The offset is larger than the node's length.",
		});

	// https://dom.spec.whatwg.org/#interface-text
	client.Intercept(class extends Text {
		@Type("DOMString")
		get wholeText(): string {
			void super.wholeText;

			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) return super.wholeText;

			return text.wholeText(this);
		}

		@Arguments("unsigned long")
		@Returns("Text")
		splitText(offset: number): Text {
			const owner = text.parent(this);
			if (!owner || text.kind(owner) === null) return super.splitText(offset);
			void super.wholeText;

			if (offset > text.data(this).length) throw indexSize("splitText");

			return text.split(this, offset);
		}
	});

	client.Intercept(class extends HTMLElement {
		@Type("[LegacyNullToEmptyString] DOMString")
		get innerText(): string {
			// a script or a style is never rendered, so its innerText is its text
			// content: the source, and the text of anything appended under it.
			// `title` is the brand check: reading the native innerText forces
			// layout, and on this path the answer is thrown away
			if (text.kind(this) !== null) {
				void super.title;

				return text.descendantText(this);
			}

			return super.innerText;
		}

		@Type("[LegacyNullToEmptyString] DOMString")
		set innerText(value: string) {
			void super.title;

			if (text.kind(this) !== null) {
				text.setSource(this, String(value));

				return;
			}

			super.innerText = value;
		}

		@Type("[LegacyNullToEmptyString] DOMString")
		get outerText(): string {
			if (text.kind(this) !== null) {
				void super.title;

				return text.source(this);
			}

			return super.outerText;
		}

		@Type("[LegacyNullToEmptyString] DOMString")
		set outerText(value: string) {
			void super.title;

			// this replaces the element with text *in its parent*, so the element
			// itself is never the script - its parent might be
			const parent = super.parentNode;
			const owner =
				parent && text.type(parent) === ELEMENT_NODE
					? (parent as Element)
					: null;

			if (!owner || text.kind(owner) === null) {
				super.outerText = value;

				return;
			}

			// inside a script or a style nothing is rendered, so the line breaks
			// the spec's own steps turn into `br` elements have nothing to do
			// here, and this is a plain replacement
			const node = text.createText(this, String(value));
			text.around(owner, [node], () => super.replaceWith(node));
		}
	});

	// Blink defines `textContent` and `innerText` over again on
	// HTMLScriptElement.prototype - they are Trusted Types sinks there - and
	// those shadow the `Node` and `HTMLElement` interceptors above, so a
	// script's own copies need intercepting in their own right. Only where they
	// are own: elsewhere the inherited interceptors already answer, and naming
	// them here would patch those a second time
	const scriptPrototype = client.global.HTMLScriptElement.prototype;
	if (
		Object_hasOwn(scriptPrototype, "textContent") &&
		Object_hasOwn(scriptPrototype, "innerText")
	) {
		client.Intercept(class extends HTMLScriptElement {
			@Type("(TrustedScript or [LegacyNullToEmptyString] DOMString)?")
			get textContent(): string | null {
				void super.type;

				return text.descendantText(this);
			}

			@Type("(TrustedScript or [LegacyNullToEmptyString] DOMString)?")
			set textContent(value: string | null) {
				void super.type;

				text.setSource(this, value === null ? "" : String(value));
			}

			@Type("(TrustedScript or [LegacyNullToEmptyString] DOMString)")
			get innerText(): string {
				void super.type;

				return text.descendantText(this);
			}

			@Type("(TrustedScript or [LegacyNullToEmptyString] DOMString)")
			set innerText(value: string) {
				void super.type;

				text.setSource(this, String(value));
			}
		});
	}

	// https://html.spec.whatwg.org/multipage/scripting.html#dom-script-text
	client.Intercept(class extends HTMLScriptElement {
		@Type("DOMString")
		get text(): string {
			void super.type;

			return text.source(this);
		}

		@Type("DOMString")
		set text(value: string) {
			void super.type;

			text.setSource(this, String(value));
		}
	});
}
