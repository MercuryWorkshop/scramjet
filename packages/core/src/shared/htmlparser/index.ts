/**
 * Vendored htmlparser2 + dom-serializer (+ the parts of domhandler and
 * entities they need), hardened to run in a realm whose globals belong to the
 * page. See README.md for provenance, the deviations from upstream, and how to
 * backport fixes.
 */
import { DomBuilder, type Document } from "./dom";
import { Parser, type ParserOptions } from "./Parser";

export * from "./dom";
export { Parser, type Handler, type ParserOptions } from "./Parser";
export { render } from "./serializer";

/**
 * Parse a complete document (or fragment) into a DOM.
 * @param data Markup to parse.
 * @param options Parser options.
 */
export function parseDocument(data: string, options?: ParserOptions): Document {
	const builder = new DomBuilder();
	new Parser(builder, options).end(data);
	return builder.root;
}
