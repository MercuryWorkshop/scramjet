/**
 * The DOM the parser builds and the serializer prints - what used to come
 * from `domhandler` and `domelementtype`, cut down to what the rewriter uses.
 *
 * Dropped from domhandler: sibling links (`prev`/`next`), start/end indices,
 * the DOM-level-1 aliases (`childNodes`, `nodeType`, `tagName`...), the
 * parse5 fields, `cloneNode`, and the separate `script`/`style` node types
 * (an element's `name` already says that).
 *
 * Every class roots its prototype chain in `null` and every `children` array
 * is a {@link NullArray}; see safe.ts for why.
 */
import {
	Array_pop,
	Array_push,
	Array_unshift,
	Object_setPrototypeOf,
} from "../snapshot";
import type { Handler } from "./Parser";
import {
	type NullRecord,
	type NullArray,
	nullArray,
	toNullRecord,
} from "./safe";

export enum ElementType {
	/** The document or fragment everything else hangs off. */
	Root = "root",
	Text = "text",
	/** `<? ... ?>` and `<!doctype ...>`. */
	Directive = "directive",
	Comment = "comment",
	CDATA = "cdata",
	Tag = "tag",
}

export type ParentNode = Document | Element | CDATA;
export type ChildNode =
	| Text
	| Comment
	| ProcessingInstruction
	| Element
	| CDATA;
export type AnyNode = ParentNode | ChildNode;

abstract class Node {
	abstract readonly type: ElementType;
	parent: ParentNode | null = null;
}

abstract class DataNode extends Node {
	constructor(public data: string) {
		super();
	}
}

export class Text extends DataNode {
	readonly type = ElementType.Text;
}

export class Comment extends DataNode {
	readonly type = ElementType.Comment;
}

/** Processing instructions, including doctypes. */
export class ProcessingInstruction extends DataNode {
	readonly type = ElementType.Directive;

	constructor(
		public name: string,
		data: string
	) {
		super(data);
	}
}

abstract class NodeWithChildren extends Node {
	readonly children: NullArray<ChildNode> = nullArray();

	constructor(children?: ArrayLike<ChildNode>) {
		super();
		if (children) this.append(children);
	}

	/** Add `nodes` at the end of this node's children. */
	append(nodes: ArrayLike<ChildNode>): void {
		for (let index = 0; index < nodes.length; index++) {
			nodes[index].parent = this as NodeWithChildren as ParentNode;
			Array_push(this.children, nodes[index]);
		}
	}

	/** Add `nodes`, in order, in front of this node's existing children. */
	prepend(nodes: ArrayLike<ChildNode>): void {
		for (let index = nodes.length - 1; index >= 0; index--) {
			nodes[index].parent = this as NodeWithChildren as ParentNode;
			Array_unshift(this.children, nodes[index]);
		}
	}

	/** Swap the child at `index` for `node`. */
	replaceChild(index: number, node: ChildNode): void {
		node.parent = this as NodeWithChildren as ParentNode;
		this.children[index] = node;
	}
}

export class CDATA extends NodeWithChildren {
	readonly type = ElementType.CDATA;
}

/** The root node, of a document or of a fragment. */
export class Document extends NodeWithChildren {
	readonly type = ElementType.Root;
}

export class Element extends NodeWithChildren {
	readonly type = ElementType.Tag;
	/** Attribute names to values. No prototype, so `name in attribs` is exact. */
	readonly attribs: NullRecord<string>;

	constructor(
		public name: string,
		attribs: { [name: string]: string } = {},
		children?: ArrayLike<ChildNode>
	) {
		super(children);
		this.attribs = toNullRecord(attribs);
	}
}

Object_setPrototypeOf(Node.prototype, null);

/**
 * Builds a {@link Document} out of parser events. The replacement for
 * domhandler's `DomHandler`, minus the options scramjet never set.
 */
export class DomBuilder implements Partial<Handler> {
	root = new Document();

	/** Open elements, innermost last. */
	private tagStack: NullArray<ParentNode> = nullArray<ParentNode>([this.root]);

	/** A data node that is still being written to. */
	private lastNode: Text | Comment | null = null;

	/**
	 * How many elements are still open. When it is zero, everything in
	 * `root.children` is complete; otherwise only the last root child is
	 * still being built.
	 */
	get openElements(): number {
		return this.tagStack.length - 1;
	}

	onreset(): void {
		this.root = new Document();
		this.tagStack = nullArray<ParentNode>([this.root]);
		this.lastNode = null;
	}

	onerror(error: Error): void {
		throw error;
	}

	onclosetag(): void {
		this.lastNode = null;
		Array_pop(this.tagStack);
	}

	onopentag(name: string, attribs: NullRecord<string>): void {
		const element = new Element(name, attribs);
		this.addNode(element);
		Array_push(this.tagStack, element);
	}

	ontext(data: string): void {
		const { lastNode } = this;

		if (lastNode && lastNode.type === ElementType.Text) {
			lastNode.data += data;
		} else {
			const node = new Text(data);
			this.addNode(node);
			this.lastNode = node;
		}
	}

	oncomment(data: string): void {
		const { lastNode } = this;

		if (lastNode && lastNode.type === ElementType.Comment) {
			lastNode.data += data;
			return;
		}

		const node = new Comment(data);
		this.addNode(node);
		this.lastNode = node;
	}

	oncommentend(): void {
		this.lastNode = null;
	}

	oncdatastart(): void {
		const text = new Text("");
		this.addNode(new CDATA([text]));
		this.lastNode = text;
	}

	oncdataend(): void {
		this.lastNode = null;
	}

	onprocessinginstruction(name: string, data: string): void {
		this.addNode(new ProcessingInstruction(name, data));
	}

	private addNode(node: ChildNode): void {
		const parent = this.tagStack[this.tagStack.length - 1];
		node.parent = parent;
		Array_push(parent.children, node);
		this.lastNode = null;
	}
}

Object_setPrototypeOf(DomBuilder.prototype, null);
