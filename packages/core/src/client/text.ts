/**
 * The text layer: text, and the source of a script or style element.
 *
 * A script element's children are its program and a style element's are its
 * stylesheet, so both go through a rewriter on the way in and have to come back
 * out unrewritten. Everything else in the tree is text like any other.
 *
 * The model is one string per element - its "child text content", the
 * concatenation of its Text children - held two ways at once:
 *
 *   - what the page wrote, per node, in `box.characterDataSources` (and, for a
 *     script, in the `scramjet-attr_script-source` attribute, which is
 *     where the HTML rewriter leaves it and which survives cloning)
 *   - what the document holds, which is the rewritten whole in the *first* Text
 *     child with every later one emptied, so that the browser's own
 *     concatenation is exactly the rewritten program
 *
 * Every member that can change that text - `textContent`, `innerText`,
 * `script.text`, the `CharacterData` mutators, and every insertion method that
 * can put a Text node under a script - re-derives the first from its parts and
 * rewrites it whole. Rewriting a fragment on its own is not an option: half a
 * program does not parse, and the half that does would run unrewritten.
 *
 * The order matters as much as the content. A connected script that has not
 * executed yet is prepared - and runs - the moment its children change
 * (https://html.spec.whatwg.org/multipage/scripting.html#script-children-changed-steps),
 * so nothing may reach the DOM before it has been through the rewriter. That is
 * why an insertion blanks the text it is inserting, inserts it, and only then
 * writes the rewritten whole.
 *
 * The interceptors that use this live in `dom/node.ts`, `dom/markup.ts` (a
 * script's `innerHTML` is its source) and `dom/fragments.ts` (ranges).
 */

import type { ScramjetClient } from "@client/index";
import { HTML_NAMESPACE, SCRIPT_SOURCE_ATTRIBUTE } from "@client/attributes";
import {
	getScriptBlockTypeString,
	isModuleScriptType,
	isScriptType,
} from "@/shared/mime";
import { rewriteCss, unrewriteCss } from "@rewriters/css";
import { rewriteJs } from "@rewriters/js";
import { rewriteImportMap } from "@rewriters/importmap";
import { base64Decode, bytesToBase64 } from "@/shared/util";
import {
	_WeakMap,
	String_substring,
	String_toLowerCase,
	TextEncoder_encode,
} from "@/shared/snapshot";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Node types, as `Node.prototype.nodeType` reports them. */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

/** A script or a style: an element whose children are code rather than text. */
export type RawTextKind = "script" | "style";

/** What an insertion has to do once the native call has returned, or thrown. */
type InsertionCommit = { done(): void; undo(): void };

/** The text primitives, bound to one client - `client.text`, built in its constructor. */
export class TextLayer {
	/**
	 * The import maps the document has registered, in registration order, and
	 * the source each was registered with. The browser reads a map once, when
	 * the script is prepared - rewriting its text afterwards changes nothing -
	 * so neither may the resolver in `client/shared/import.ts`.
	 */
	private readonly importMaps: Element[] = [];
	private readonly importMapSources = new _WeakMap<Element, string>();

	constructor(private readonly client: ScramjetClient) {}

	private get attrs() {
		return this.client.attributes;
	}

	private get sources() {
		return this.client.box.characterDataSources;
	}

	/** `node`'s type, as `nodeType` reports it. */
	type(node: Node): number {
		return new this.client.native.Node(node).nodeType;
	}

	/** `node`'s parent element, or null. */
	parent(node: Node): Element | null {
		return new this.client.native.Node(node).parentElement;
	}

	private firstChild(node: Node): Node | null {
		return new this.client.native.Node(node).firstChild;
	}

	private nextSibling(node: Node): Node | null {
		return new this.client.native.Node(node).nextSibling;
	}

	private previousSibling(node: Node): Node | null {
		return new this.client.native.Node(node).previousSibling;
	}

	private isText(node: Node): boolean {
		const what = this.type(node);

		return what === TEXT_NODE || what === CDATA_SECTION_NODE;
	}

	private rawData(node: CharacterData): string {
		return new this.client.native.CharacterData(node).data;
	}

	private writeData(node: CharacterData, text: string): void {
		new this.client.native.CharacterData(node).data = text;
	}

	/** Whether `element` is a script or a style, in HTML or in SVG. */
	kind(element: Element): RawTextKind | null {
		const namespace = new this.client.native.Element(element).namespaceURI;
		// an element named "script" in some other namespace is not one, and
		// running its text through a javascript rewriter would corrupt it
		if (namespace !== HTML_NAMESPACE && namespace !== SVG_NAMESPACE) {
			return null;
		}

		const local = this.attrs.localName(element);
		if (local === "script") return "script";
		if (local === "style") return "style";

		return null;
	}

	/**
	 * https://html.spec.whatwg.org/multipage/scripting.html#the-script-element -
	 * what the `type` and `language` attributes say this script block is. Read
	 * through the mirror, because that is what the page believes it set.
	 */
	private scriptBlockType(element: Element): string {
		const type = this.attrs.get(element, "type");
		const language = this.attrs.get(element, "language");

		// an attribute is present exactly when the mirror-aware read answers with
		// something, so the two "has" flags are the same test
		return getScriptBlockTypeString(
			type,
			language,
			type !== null,
			language !== null
		);
	}

	/**
	 * How this element's text has to be rewritten, or null when it is not
	 * rewritten at all - `<script type="application/json">` is data, and the
	 * page has to get back exactly the bytes it wrote.
	 */
	private rewriterFor(element: Element): ((text: string) => string) | null {
		const client = this.client;
		const what = this.kind(element);
		if (what === null) return null;
		if (what === "style") {
			return (text) => rewriteCss(text, client.context, client.meta);
		}

		const blockType = this.scriptBlockType(element);
		if (isScriptType(blockType)) {
			const module = isModuleScriptType(blockType);

			return (text) =>
				rewriteJs(
					text,
					"(anonymous script element)",
					client.context,
					client.meta,
					module,
					client
				) as string;
		}

		// an import map's specifiers are URLs the module loader will resolve, so
		// they go through the same rewrite the HTML rewriter gives a parsed one
		if (String_toLowerCase(blockType) === "importmap") {
			return (text) => this.rewriteImportMap(text);
		}

		return null;
	}

	private rewriteImportMap(json: string): string {
		try {
			return rewriteImportMap(json, this.client.context, this.client.meta);
		} catch (err) {
			dbg.error("failed to parse an importmap", err);

			return json;
		}
	}

	/** The Text children of `element`, in order. */
	textChildren(element: Element): CharacterData[] {
		const out: CharacterData[] = [];
		for (
			let child = this.firstChild(element);
			child;
			child = this.nextSibling(child)
		) {
			const what = this.type(child);
			if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
				out[out.length] = child as CharacterData;
			}
		}

		return out;
	}

	/**
	 * https://dom.spec.whatwg.org/#dom-text-wholetext - the data of the
	 * contiguous Text nodes around `node`, as the page wrote them. A comment or
	 * an element between two of a script's Text children ends the run.
	 */
	wholeText(node: CharacterData): string {
		let first: Node = node;
		for (
			let prev = this.previousSibling(first);
			prev && this.isText(prev);
			prev = this.previousSibling(first)
		) {
			first = prev;
		}

		let out = "";
		for (
			let child: Node | null = first;
			child && this.isText(child);
			child = this.nextSibling(child)
		) {
			out += this.data(child as CharacterData);
		}

		return out;
	}

	/** One node's data, as the page wrote it. */
	data(node: CharacterData): string {
		const known = this.sources.get(node);
		if (known !== undefined) return known;

		const owner = this.parent(node);
		if (!owner) return this.rawData(node);

		const what = this.kind(owner);
		if (what === null) return this.rawData(node);

		if (what === "script") {
			// the attribute carries the source of the *whole* element, so it only
			// answers for a node that is the whole of it - which is every script
			// the HTML rewriter produced
			const encoded = this.attrs.raw.get(owner, SCRIPT_SOURCE_ATTRIBUTE);
			if (encoded !== null) {
				const children = this.textChildren(owner);
				if (children.length === 1 && children[0] === node) {
					return base64Decode(encoded);
				}
			}

			return this.rawData(node);
		}

		// a style has nowhere to keep its source, so the un-rewriter is what
		// recovers a stylesheet that came down in the markup
		return unrewriteCss(this.rawData(node), this.client.context);
	}

	/** The child text content of `element`, as the page wrote it. */
	source(element: Element): string {
		const children = this.textChildren(element);
		let out = "";
		for (let i = 0; i < children.length; i++) out += this.data(children[i]);

		return out;
	}

	/** Record the script source alongside the element, the way the parser does. */
	private recordSource(element: Element, text: string) {
		if (this.kind(element) !== "script") return;

		if (this.rewriterFor(element)) {
			this.attrs.raw.set(
				element,
				SCRIPT_SOURCE_ATTRIBUTE,
				bytesToBase64(TextEncoder_encode(text))
			);
		} else {
			// the text is not rewritten, so there is nothing to recover and a
			// stale attribute would answer for it forever
			this.attrs.raw.remove(element, SCRIPT_SOURCE_ATTRIBUTE);
		}
	}

	/** Re-derive `element`'s live text from its children's recorded data. */
	sync(element: Element): void {
		const rewrite = this.rewriterFor(element);
		const children = this.textChildren(element);

		if (!rewrite) {
			// not rewritten: the document holds what the page wrote, node for node
			for (let i = 0; i < children.length; i++) {
				const text = this.data(children[i]);
				this.sources.delete(children[i]);
				if (this.rawData(children[i]) !== text) {
					this.writeData(children[i], text);
				}
			}
			this.recordSource(element, "");

			return;
		}

		let text = "";
		for (let i = 0; i < children.length; i++) text += this.data(children[i]);

		const rewritten = rewrite(text);

		// recorded before any of the writes below, each of which can run the
		// script - and code that reads `document.currentScript.text` from inside
		// it has to get the page's source back, not the rewritten one
		this.recordSource(element, text);

		// the later nodes are emptied *first*. every one of these writes is a
		// children-changed, and a connected script that has not run yet is
		// prepared on each of them - so the last state the element passes through
		// has to be the complete rewritten program, never a half of it followed
		// by the tail of the last one
		for (let i = children.length - 1; i > 0; i--) {
			if (this.rawData(children[i]) !== "") this.writeData(children[i], "");
		}
		if (children.length > 0 && this.rawData(children[0]) !== rewritten) {
			this.writeData(children[0], rewritten);
		}
	}

	/**
	 * Record `element` as a registered import map, with the source it has now,
	 * if the browser would have registered it by this point: a connected
	 * `importmap` script with something in it. Run before anything changes the
	 * text of a script, since the text it had is the text that counts.
	 */
	noteImportMap(element: Element): void {
		if (this.importMapSources.has(element)) return;
		if (this.kind(element) !== "script") return;
		if (String_toLowerCase(this.scriptBlockType(element)) !== "importmap") {
			return;
		}
		if (!new this.client.native.Node(element).isConnected) return;

		const source = this.source(element);
		if (source === "") return;

		this.importMapSources.set(element, source);
		this.importMaps[this.importMaps.length] = element;
	}

	/**
	 * The sources of every import map `document` has registered, in order.
	 * A map the parser put down, or one inserted since the last look, is
	 * picked up here - its text has not changed since, or it would have been
	 * noted then.
	 */
	registeredImportMaps(document: Document): string[] {
		const found: NodeListOf<Element> = new this.client.native.Document(
			document
		).querySelectorAll("script[type=importmap i]");
		for (let i = 0; i < found.length; i++) this.noteImportMap(found[i]);

		const out: string[] = [];
		for (let i = 0; i < this.importMaps.length; i++) {
			out[i] = this.importMapSources.get(this.importMaps[i])!;
		}

		return out;
	}

	/** Replace the child text content of `element`, rewriting it. */
	setSource(element: Element, text: string): void {
		this.noteImportMap(element);
		const rewrite = this.rewriterFor(element);

		// first, for the reason `sync` gives: the write can run the script, and
		// until the new child has a record of its own the attribute is what
		// answers for it
		this.recordSource(element, text);

		new this.client.native.Node(element).textContent = rewrite
			? rewrite(text)
			: text;

		const child = this.firstChild(element);
		if (child) this.sources.set(child as CharacterData, text);
	}

	/** Replace one node's data, rewriting the element it belongs to. */
	setData(node: CharacterData, text: string): void {
		const owner = this.parent(node);
		if (owner) this.noteImportMap(owner);

		if (!owner || this.kind(owner) === null) {
			// plain text: what the page wrote is what the document holds, and a
			// record left over from a script this node used to live in would
			// answer for it forever
			this.sources.delete(node);
			this.writeData(node, text);

			return;
		}

		this.adopt(owner);
		this.sources.set(node, text);
		this.sync(owner);
	}

	/**
	 * `normalize` for the Text children of a script or a style, done over the
	 * page's text - ahead of the native, which would get it wrong.
	 *
	 * The native merges and removes by the *live* data, and every Text child
	 * after the first holds none: the rewritten whole is in the first. Left to
	 * it, a Text node the page wrote after a comment would be removed as empty.
	 * So each run of contiguous Text is merged into its first non-empty node
	 * here, empty ones are removed, and each survivor that holds nothing live
	 * is given a placeholder the native will leave alone. {@link sync}, which
	 * the caller runs once the native is done, puts the live text back.
	 *
	 * https://dom.spec.whatwg.org/#dom-node-normalize
	 */
	normalizeChildren(element: Element): void {
		this.adopt(element);
		const nElement = new this.client.native.Node(element);

		let child = this.firstChild(element);
		while (child) {
			let next = this.nextSibling(child);
			// exclusive Text only: a CDATA section is never merged or removed
			if (this.type(child) !== TEXT_NODE) {
				child = next;
				continue;
			}

			const node = child as CharacterData;
			let merged = this.data(node);
			if (merged === "") {
				this.sources.delete(node);
				nElement.removeChild(node);
				child = next;
				continue;
			}
			while (next && this.type(next) === TEXT_NODE) {
				const following = this.nextSibling(next);
				merged += this.data(next as CharacterData);
				this.sources.delete(next as CharacterData);
				nElement.removeChild(next);
				next = following;
			}
			this.sources.set(node, merged);
			if (this.rawData(node) === "") this.writeData(node, " ");
			child = next;
		}
	}

	/** Whether anything under `node` is a script or a style. */
	containsRawText(node: Node): boolean {
		const what = this.type(node);
		if (what === ELEMENT_NODE && this.kind(node as Element) !== null) {
			return true;
		}

		// `childElementCount` and `querySelector` are installed once per
		// interface that mixes ParentNode in, and each copy brand checks for its
		// own - so a DocumentFragment has to be asked with the fragment's
		const parent =
			what === DOCUMENT_FRAGMENT_NODE
				? new this.client.native.DocumentFragment(node)
				: new this.client.native.Element(node);

		// something with no element children can have no script or style under
		// it, and this is the read path of every `textContent` in the document
		if (parent.childElementCount === 0) return false;

		return !!parent.querySelector("script,style");
	}

	/**
	 * Carry the page's text over to a copy `cloneNode` or `importNode` just
	 * made of `original`.
	 *
	 * The native copies what the document holds, which inside a script or a
	 * style is the rewritten text. A Text node on its own is detached once
	 * copied, so it simply gets the page's text back. A copied subtree keeps
	 * the rewritten text, since it is still code, and each of its script and
	 * style Text children is given the record its original had.
	 */
	cloned(original: Node, clone: Node): void {
		const what = this.type(original);
		if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
			const page = this.data(original as CharacterData);
			if (page !== this.rawData(clone as CharacterData)) {
				this.writeData(clone as CharacterData, page);
			}

			return;
		}
		// an attribute, a comment, a doctype: nothing a script could be under
		if (
			what !== ELEMENT_NODE &&
			what !== DOCUMENT_FRAGMENT_NODE &&
			what !== DOCUMENT_NODE
		) {
			return;
		}
		if (what !== DOCUMENT_NODE && !this.containsRawText(original)) return;

		const from = this.rawTextInclusiveDescendants(original);
		const to = this.rawTextInclusiveDescendants(clone);
		// the clone is the same tree, so the two lists line up
		if (from.length !== to.length) return;

		for (let i = 0; i < from.length; i++) {
			const a = this.textChildren(from[i]);
			const b = this.textChildren(to[i]);
			for (let j = 0; j < a.length && j < b.length; j++) {
				this.sources.set(b[j], this.data(a[j]));
			}
		}
	}

	/** `node`, if it is a script or a style, and every one under it. */
	private rawTextInclusiveDescendants(node: Node): Element[] {
		const what = this.type(node);
		const out: Element[] = [];
		if (what === ELEMENT_NODE && this.kind(node as Element) !== null) {
			out[out.length] = node as Element;
		}

		// the same per-interface copies as `containsRawText`'s
		const parent =
			what === ELEMENT_NODE
				? new this.client.native.Element(node)
				: what === DOCUMENT_FRAGMENT_NODE
					? new this.client.native.DocumentFragment(node)
					: what === DOCUMENT_NODE
						? new this.client.native.Document(node)
						: null;
		if (!parent) return out;

		const found: NodeListOf<Element> = parent.querySelectorAll("script,style");
		for (let i = 0; i < found.length; i++) {
			if (this.kind(found[i]) !== null) out[out.length] = found[i];
		}

		return out;
	}

	/**
	 * The descendant text content of `node`, as the page wrote it.
	 *
	 * Only the branches that lead to a script or a style are walked here; a
	 * subtree with neither under it is answered by the native `textContent`
	 * in one call, which is what keeps `document.body.textContent` from being
	 * a JS walk over the whole document.
	 */
	descendantText(node: Node): string {
		let out = "";

		for (
			let child = this.firstChild(node);
			child;
			child = this.nextSibling(child)
		) {
			const what = this.type(child);
			if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
				out += this.data(child as CharacterData);
			} else if (what === ELEMENT_NODE) {
				// a script's or a style's own text is its source, and anything
				// nested under it still counts - so it is walked like the rest
				if (this.kind(child as Element) !== null) {
					out += this.descendantText(child);
				} else if (this.containsRawText(child)) {
					out += this.descendantText(child);
				} else {
					out += new this.client.native.Node(child).textContent;
				}
			}
		}

		return out;
	}

	/** A fresh Text node in `near`'s document, carrying `text` as its data. */
	createText(near: Node, text: string): Text {
		const document =
			new this.client.native.Node(near).ownerDocument ??
			this.client.global.document;

		return new this.client.native.Document(document).createTextNode(text);
	}

	/**
	 * Record what `node` says and empty it, without touching anything else.
	 *
	 * What a node about to be inserted into a script goes through, so that the
	 * insertion - which can prepare and run the element - lands nothing the
	 * rewriter has not seen.
	 */
	blank(node: CharacterData): void {
		this.sources.set(node, this.data(node));
		this.writeData(node, "");
	}

	/**
	 * Give `copy`, a Text node the native just made out of one of the page's,
	 * the page's text `page`. Inside a script or a style that is its record,
	 * and the document goes on holding code; anywhere else it is the data.
	 */
	copied(copy: CharacterData, page: string): void {
		const owner = this.parent(copy);
		if (owner && this.kind(owner) !== null) {
			this.sources.set(copy, page);

			return;
		}

		this.sources.delete(copy);
		if (this.rawData(copy) !== page) this.writeData(copy, page);
	}

	/**
	 * Replace what `node` is recorded as saying, without re-deriving its
	 * element - for a caller about to {@link sync} it anyway.
	 */
	record(node: CharacterData, page: string): void {
		this.sources.set(node, page);
	}

	/** Hand `node` back its own text, for a move out of a script into plain text. */
	restore(node: CharacterData): void {
		const text = this.data(node);
		this.sources.delete(node);
		this.writeData(node, text);
	}

	/**
	 * Record every Text child of a script or style that has no record yet.
	 *
	 * Run before anything changes the element's children. A script straight
	 * out of the HTML rewriter has one Text child holding the rewritten
	 * program and its source only in {@link SCRIPT_SOURCE_ATTRIBUTE}, which
	 * answers for that child only while it is the only one - so the record has
	 * to be taken while it still is.
	 */
	adopt(element: Element): void {
		if (this.kind(element) === null) return;

		const children = this.textChildren(element);
		for (let i = 0; i < children.length; i++) {
			if (!this.sources.has(children[i])) {
				this.sources.set(children[i], this.data(children[i]));
			}
		}
	}

	/** Whether `value` is really a Node - a brand check, not a prototype walk. */
	isNode(value: unknown): boolean {
		if (typeof value !== "object" || value === null) return false;

		// the native getter's own brand check. `instanceof` walks a prototype
		// chain the page can rebuild, and consults a `Symbol.hasInstance` the
		// page can define - either one decides whether the text is blanked
		try {
			void new this.client.native.Node(value).nodeType;

			return true;
		} catch {
			return false;
		}
	}

	private asElement(node: Node | null): Element | null {
		return node && this.type(node) === ELEMENT_NODE ? (node as Element) : null;
	}

	/** The Text nodes an argument contributes to its new parent's text content. */
	private textNodesOf(inserted: Node): CharacterData[] {
		const what = this.type(inserted);
		if (what === TEXT_NODE || what === CDATA_SECTION_NODE) {
			return [inserted as CharacterData];
		}
		// a fragment is flattened into the parent, so its own Text children
		// become the parent's. anything deeper belongs to an element and never
		// counts as the parent's child text content
		if (what === DOCUMENT_FRAGMENT_NODE) {
			return this.textChildren(inserted as unknown as Element);
		}

		return [];
	}

	/**
	 * Give a connected script the node insertion its children just had.
	 *
	 * An insertion into a connected script that has not started prepares it,
	 * and that is when it runs. The insertion here landed blanked text - so the
	 * script was prepared with an empty source, which leaves it unstarted - and
	 * the rewritten program only arrived afterwards as a data write, which
	 * Blink does not prepare a script on. Inserting and removing an empty Text
	 * node is an insertion with the program already in place: the script runs
	 * then, still inside the page's call, where the native would have run it.
	 * A script that has already started ignores both.
	 */
	private reprepare(element: Element) {
		if (this.kind(element) !== "script" || !this.rewriterFor(element)) return;

		const nElement = new this.client.native.Node(element);
		if (!nElement.isConnected) return;

		const probe = this.createText(element, "");
		nElement.appendChild(probe);
		nElement.removeChild(probe);
	}

	/**
	 * Everything an insertion has to do around the native call, or null when
	 * there is nothing to do.
	 *
	 * Text going *into* a script is recorded and blanked, so that the insertion
	 * itself - which is a children-changed, and can execute the element - lands
	 * nothing the rewriter has not seen. `done` then writes the rewritten
	 * whole; `undo` puts every blanked node back the way it was, for an
	 * insertion the native refused - a node that stays where it was must not
	 * come out of a failed call emptied.
	 *
	 * Text coming *out of* one is handed back its own data, because outside a
	 * script it is text like any other and the document should hold what it
	 * reads as.
	 */
	private insertion(
		parent: Node | null,
		nodes: readonly unknown[]
	): InsertionCommit | null {
		const target = this.asElement(parent);
		const into = target ? this.kind(target) : null;
		const resync: Element[] = [];
		const restoring: CharacterData[] = [];
		const blanked: {
			node: CharacterData;
			raw: string;
			had: boolean;
			record: string | undefined;
		}[] = [];

		if (into && target) {
			this.noteImportMap(target);
			this.adopt(target);
		}

		for (let i = 0; i < nodes.length; i++) {
			const inserted = nodes[i];
			// a string, or an object that is not a node at all - the IDL union
			// already turned one of those into a string, and reading `nodeType`
			// off it would throw where the native would have stringified it
			if (!this.isNode(inserted)) continue;

			const moving = this.textNodesOf(inserted as Node);
			for (let j = 0; j < moving.length; j++) {
				const node = moving[j];
				const from = this.parent(node);
				if (from && this.kind(from) !== null) {
					// its siblings are about to lose it, and the record is the only
					// thing that remembers what they say
					this.adopt(from);
					resync[resync.length] = from;
				}

				if (into) {
					blanked[blanked.length] = {
						node,
						raw: this.rawData(node),
						had: this.sources.has(node),
						record: this.sources.get(node),
					};
					this.blank(node);
				} else if (this.sources.has(node)) {
					// restored on the way out rather than here: writing a script's
					// own source back into a node that is still inside it would be
					// the one unrewritten children-changed this all exists to avoid
					restoring[restoring.length] = node;
				}
			}
		}

		if (!into && resync.length === 0 && restoring.length === 0) return null;

		return {
			done: () => {
				for (let i = 0; i < restoring.length; i++) this.restore(restoring[i]);
				for (let i = 0; i < resync.length; i++) {
					if (resync[i] !== target) this.sync(resync[i]);
				}
				// only a script or a style has anything to re-derive; a plain
				// parent holds what the page wrote, which is what the restores
				// above put back
				if (into && target) {
					this.sync(target);
					if (blanked.length > 0) this.reprepare(target);
				}
			},
			undo: () => {
				for (let i = 0; i < blanked.length; i++) {
					const { node, raw, had, record } = blanked[i];
					if (had) this.sources.set(node, record!);
					else this.sources.delete(node);
					this.writeData(node, raw);
				}
			},
		};
	}

	/**
	 * Run `insert`, a native insertion of `nodes` into `parent`, with every
	 * Text node it moves into or out of a script or a style handled around it.
	 * See {@link insertion}.
	 */
	around<T>(
		parent: Node | null,
		nodes: readonly unknown[],
		insert: () => T
	): T {
		const commit = this.insertion(parent, nodes);
		if (!commit) return insert();

		let result: T;
		try {
			result = insert();
		} catch (err) {
			commit.undo();
			throw err;
		}
		commit.done();

		return result;
	}

	/**
	 * Insert a new Text node carrying `value` into `parent` before
	 * `reference`, as the page's text: rewritten whole when `parent` is a
	 * script or a style. Throws what the native `insertBefore` throws.
	 */
	insertText(parent: Node, reference: Node | null, value: string): Text {
		const node = this.createText(parent, value);

		return this.around(
			parent,
			[node],
			(): Text =>
				new this.client.native.Node(parent).insertBefore(node, reference)
		);
	}

	/**
	 * `splitText` over the page's text rather than the rewritten text the
	 * document holds. Only for a node inside a script or a style.
	 */
	split(node: Text, offset: number): Text {
		const owner = this.parent(node)!;
		this.adopt(owner);

		const value = this.data(node);
		// the live data is the rewritten whole, so a native split at this
		// offset would cut the rewritten program, not the page's text
		const tail = this.createText(node, "");
		this.sources.set(tail, String_substring(value, offset));
		this.sources.set(node, String_substring(value, 0, offset));

		new this.client.native.CharacterData(node).after(tail);
		this.sync(owner);

		return tail;
	}
}
