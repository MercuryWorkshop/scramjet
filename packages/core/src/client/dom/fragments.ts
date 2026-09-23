import { rewriteHtml } from "@rewriters/html";
import { ScramjetClient } from "@client/index";
import { ForeignContext } from "@/shared/rewriters/html";
import { Array_indexOf, String, String_substring } from "@/shared/snapshot";
import { Arguments, Returns, Type } from "@client/webidl";
import { foreignContextForElement } from "@client/dom/markup";

const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const DOCUMENT_NODE = 9;
const DOCUMENT_TYPE_NODE = 10;
const DOCUMENT_FRAGMENT_NODE = 11;

function foreignContextForRange(
	client: ScramjetClient,
	range: Range
): ForeignContext {
	const nRange = new client.native.Range(range);
	const node = nRange.startContainer;
	const nNode = new client.native.Node(node);
	const element = nNode.nodeType === 1 ? node : nNode.parentElement;
	if (!element) return "html";

	return foreignContextForElement(client, element as Element);
}

export default function (client: ScramjetClient, _self: Self) {
	const text = client.text;

	const parentOf = (n: Node): Node | null =>
		new client.native.Node(n).parentNode;
	const isText = (n: Node) => {
		const what = text.type(n);

		return what === TEXT_NODE || what === CDATA_SECTION_NODE;
	};
	const isRawText = (n: Node | null): n is Element =>
		n !== null &&
		text.type(n) === ELEMENT_NODE &&
		text.kind(n as Element) !== null;

	const indexOf = (n: Node): number => {
		let index = 0;
		for (
			let sibling = new client.native.Node(n).previousSibling;
			sibling;
			sibling = new client.native.Node(sibling).previousSibling
		) {
			index++;
		}

		return index;
	};

	const hierarchyRequest = (member: string, detail: string) =>
		client.errors.domException("HierarchyRequestError", {
			execute: member,
			on: "Range",
			detail,
		});

	/**
	 * https://dom.spec.whatwg.org/#concept-range-insert, for the one case the
	 * native cannot be trusted with: a start inside a script's or a style's
	 * Text. The split in step 7 would cut the *rewritten* program at an offset
	 * into the page's, and the new tail would carry rewritten code out as the
	 * page's text - so the split is done over the page's text instead, and the
	 * insertion goes through the same blanking as every other one.
	 *
	 * Returns false when the native can do it all.
	 */
	const insertIntoRawText = (self: Range, inserted: Node, member: string) => {
		const start: Node = new client.native.Range(self).startContainer;
		if (!isText(start)) return false;

		const parent = parentOf(start);
		if (!isRawText(parent)) return false;

		// 1. If range's start node is node, throw
		if (start === inserted) {
			throw hierarchyRequest(
				member,
				"The node to be inserted is the start node."
			);
		}

		// 6. Ensure pre-insertion validity of node into parent. the parent is an
		//    element, so what is left of the checks is the node's type and the
		//    cycle
		const what = text.type(inserted);
		if (
			what === DOCUMENT_NODE ||
			what === DOCUMENT_TYPE_NODE ||
			what === ATTRIBUTE_NODE
		) {
			throw hierarchyRequest(member, "The node cannot be inserted here.");
		}
		if (new client.native.Node(inserted).contains(parent)) {
			throw hierarchyRequest(
				member,
				"The new child element contains the parent."
			);
		}

		const collapsed: boolean = new client.native.Range(self).collapsed;
		const offset: number = new client.native.Range(self).startOffset;

		// 7. split the start node - over the page's text
		let reference: Node | null = text.split(start as Text, offset);
		// 8. If node is referenceNode, set referenceNode to its next sibling
		if (inserted === reference) reference = null;

		// 10-11. the offset the range's end moves to if it was collapsed
		let newOffset =
			reference === null
				? new client.native.Node(parent).childNodes.length
				: indexOf(reference);
		newOffset +=
			what === DOCUMENT_FRAGMENT_NODE
				? new client.native.Node(inserted).childNodes.length
				: 1;

		// 9, 12. remove it from where it was and insert it, blanked
		text.around(parent, [inserted], () =>
			new client.native.Node(parent).insertBefore(inserted, reference)
		);

		// 13. If range is collapsed, set range's end to (parent, newOffset)
		if (collapsed) new client.native.Range(self).setEnd(parent, newOffset);

		return true;
	};

	/**
	 * https://dom.spec.whatwg.org/#concept-range-bp - whether a node other than
	 * a Text is partially contained, which `surroundContents` refuses. Only the
	 * start's and the end's ancestors below the common ancestor can be.
	 */
	const hasPartiallyContainedNonText = (self: Range): boolean => {
		const common: Node = new client.native.Range(self).commonAncestorContainer;
		const ends = [
			new client.native.Range(self).startContainer,
			new client.native.Range(self).endContainer,
		];
		for (let i = 0; i < ends.length; i++) {
			for (let n: Node | null = ends[i]; n && n !== common; n = parentOf(n)) {
				if (!isText(n)) return true;
			}
		}

		return false;
	};

	/**
	 * Whether a range over `root` can reach a script's or a style's text, which
	 * the native reads as the rewritten code. Everything else it reads right.
	 */
	const reachesRawText = (root: Node): boolean => {
		if (isRawText(root) || isRawText(parentOf(root))) return true;

		const what = text.type(root);
		if (what === DOCUMENT_NODE) {
			return !!new client.native.Document(root).querySelector("script,style");
		}
		if (what !== ELEMENT_NODE && what !== DOCUMENT_FRAGMENT_NODE) return false;

		return text.containsRawText(root);
	};

	/** Every Text node under `root` that `range` intersects, in tree order. */
	const intersecting = (range: Range, root: Node): CharacterData[] => {
		const nRange = new client.native.Range(range);
		const out: CharacterData[] = [];
		if (isText(root)) return [root as CharacterData];

		const walk = (node: Node) => {
			for (
				let child = new client.native.Node(node).firstChild;
				child;
				child = new client.native.Node(child).nextSibling
			) {
				if (!nRange.intersectsNode(child)) continue;
				if (isText(child)) out[out.length] = child as CharacterData;
				else walk(child);
			}
		};
		walk(root);

		return out;
	};

	/** Every Text node in `fragment`, in tree order. */
	const textsOf = (fragment: Node): CharacterData[] => {
		const out: CharacterData[] = [];
		const walk = (node: Node) => {
			for (
				let child = new client.native.Node(node).firstChild;
				child;
				child = new client.native.Node(child).nextSibling
			) {
				if (isText(child)) out[out.length] = child as CharacterData;
				else walk(child);
			}
		};
		walk(fragment);

		return out;
	};

	/**
	 * The part of each intersected Text node the range covers, as the page
	 * wrote it - which is what `toString` concatenates, and what the copies
	 * `cloneContents` and `extractContents` make of them say.
	 *
	 * An offset into a boundary node counts in the page's text, since that is
	 * the text the page believes the node holds.
	 *
	 * https://dom.spec.whatwg.org/#dom-range-stringifier
	 */
	const covered = (range: Range, nodes: CharacterData[]): string[] => {
		const nRange = new client.native.Range(range);
		const start: Node = nRange.startContainer;
		const end: Node = nRange.endContainer;
		const startOffset: number = nRange.startOffset;
		const endOffset: number = nRange.endOffset;

		const out: string[] = [];
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			const page = text.data(node);
			if (node === start && node === end) {
				out[i] = String_substring(page, startOffset, endOffset);
			} else if (node === start) {
				out[i] = String_substring(page, startOffset);
			} else if (node === end) {
				out[i] = String_substring(page, 0, endOffset);
			} else {
				out[i] = page;
			}
		}

		return out;
	};

	/**
	 * A boundary offset, in the page's text. Inside a script's or a style's
	 * Text the native counts the rewritten code, which is longer than what the
	 * page wrote - `selectNodeContents` on one would put the end past the end.
	 */
	const pageOffset = (container: Node, offset: number): number => {
		if (!isText(container) || !isRawText(parentOf(container))) return offset;
		const length = text.data(container as CharacterData).length;

		return offset > length ? length : offset;
	};

	client.Intercept(class extends AbstractRange {
		@Type("unsigned long")
		get startOffset(): number {
			return pageOffset(super.startContainer, super.startOffset);
		}

		@Type("unsigned long")
		get endOffset(): number {
			return pageOffset(super.endContainer, super.endOffset);
		}
	});

	client.Intercept(class extends Range {
		@Arguments()
		@Returns("DOMString")
		toString(): string {
			const native = super.toString();
			const root = super.commonAncestorContainer;
			if (!reachesRawText(root)) return native;

			const parts = covered(this, intersecting(this, root));
			let out = "";
			for (let i = 0; i < parts.length; i++) out += parts[i];

			return out;
		}

		@Arguments()
		@Returns("DocumentFragment")
		cloneContents(): DocumentFragment {
			const root = super.commonAncestorContainer;
			if (super.collapsed || !reachesRawText(root)) {
				return super.cloneContents();
			}

			const nodes = intersecting(this, root);
			const parts = covered(this, nodes);
			const fragment = super.cloneContents();

			// every intersected Text node comes out as exactly one copy, in the
			// same order - so the two lists line up
			const copies = textsOf(fragment);
			if (copies.length === nodes.length) {
				for (let i = 0; i < copies.length; i++) {
					text.copied(copies[i], parts[i]);
				}
			}

			return fragment;
		}

		@Arguments()
		@Returns("DocumentFragment")
		extractContents(): DocumentFragment {
			const root = super.commonAncestorContainer;
			if (super.collapsed || !reachesRawText(root)) {
				return super.extractContents();
			}

			const start: Node = super.startContainer;
			const end: Node = super.endContainer;
			const startOffset: number = super.startOffset;
			const endOffset: number = super.endOffset;
			const nodes = intersecting(this, root);
			const parts = covered(this, nodes);

			// the scripts and styles about to lose text, each recorded while
			// its children still are what the records describe
			const owners: Element[] = [];
			const pages: string[] = [];
			for (let i = 0; i < nodes.length; i++) {
				pages[i] = text.data(nodes[i]);
				const owner = parentOf(nodes[i]);
				if (isRawText(owner) && Array_indexOf(owners, owner) === -1) {
					text.adopt(owner);
					owners[owners.length] = owner;
				}
			}

			const fragment = super.extractContents();

			const out = textsOf(fragment);
			if (out.length === nodes.length) {
				for (let i = 0; i < out.length; i++) {
					// a node moved whole keeps its identity and its record; one
					// only partly covered stayed put, and this is its copy
					if (out[i] === nodes[i]) {
						if (!isRawText(parentOf(out[i]))) text.restore(out[i]);
					} else {
						text.copied(out[i], parts[i]);
					}
				}
			}

			// what a partly covered boundary node has left, in the page's text
			for (let i = 0; i < nodes.length; i++) {
				if (out[i] === nodes[i] || !isRawText(parentOf(nodes[i]))) continue;
				const page = pages[i];
				if (nodes[i] === start && nodes[i] === end) {
					text.record(
						nodes[i],
						String_substring(page, 0, startOffset) +
							String_substring(page, endOffset)
					);
				} else if (nodes[i] === start) {
					text.record(nodes[i], String_substring(page, 0, startOffset));
				} else if (nodes[i] === end) {
					text.record(nodes[i], String_substring(page, endOffset));
				}
			}
			for (let i = 0; i < owners.length; i++) text.sync(owners[i]);

			return fragment;
		}

		@Returns("DocumentFragment")
		@Arguments("(TrustedHTML or DOMString)")
		createContextualFragment(string: string | TrustedHTML): DocumentFragment {
			const html = String(string);
			const rewritten = rewriteHtml(html, client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "Range.prototype.createContextualFragment",
				foreignContext: foreignContextForRange(client, this),
			});

			return super.createContextualFragment(rewritten);
		}

		// an insertion like any other, and one that can land Text in a script
		@Arguments("Node")
		@Returns("undefined")
		insertNode(node: Node): void {
			void super.collapsed;
			if (insertIntoRawText(this, node, "insertNode")) return;

			// the parent the native will insert into: the start node, or the
			// parent of the Text it splits
			const start = super.startContainer;
			const parent = isText(start) ? parentOf(start) : start;

			text.around(parent, [node], () => super.insertNode(node));
		}

		// https://dom.spec.whatwg.org/#dom-range-surroundcontents - the native
		// appends the extracted text to `newParent` *after* inserting it, so a
		// script or a style as the new parent is connected - and prepared - by
		// the time its text lands. Done step by step for those, so that the
		// append goes through the blanking every other insertion does
		@Arguments("Node")
		@Returns("undefined")
		surroundContents(newParent: Node): void {
			void super.collapsed;
			if (!isRawText(newParent)) return super.surroundContents(newParent);

			// 1. a partially contained non-Text node is an InvalidStateError
			if (hasPartiallyContainedNonText(this)) {
				throw client.errors.domException("InvalidStateError", {
					execute: "surroundContents",
					on: "Range",
					detail: "The Range has partially selected a non-Text node.",
				});
			}
			// 2. newParent is an element, so it is never the wrong type

			// 3. Let fragment be the result of extracting this
			const fragment: DocumentFragment = new client.native.Range(
				this
			).extractContents();
			// 4. If newParent has children, replace all with null within it
			new client.native.Element(newParent).replaceChildren();
			// 5. Insert newParent into this
			if (!insertIntoRawText(this, newParent, "surroundContents")) {
				const start = super.startContainer;
				const parent = isText(start) ? parentOf(start) : start;
				text.around(parent, [newParent], () => super.insertNode(newParent));
			}
			// 6. Append fragment to newParent - blanked on the way in
			text.around(newParent, [fragment], () =>
				new client.native.Node(newParent).appendChild(fragment)
			);
			// 7. Select newParent within this
			new client.native.Range(this).selectNode(newParent);
		}
	});
}
