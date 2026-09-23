/**
 * Attribute selectors over the page-visible DOM.
 *
 * A page cannot see `scramjet-attr-*`. Attribute selectors for rewritten
 * attributes instead match the author's value in the mirror, while ordinary
 * attributes keep native matching. This works inside selector lists and
 * functional pseudo-classes because each attribute selector is replaced in
 * place. Stylesheet selectors are outside this DOM API layer.
 *
 * https://drafts.csswg.org/selectors/#attribute-selectors
 */

import { isInternalAttribute, mirrorAttributeName } from "@client/attributes";
import {
	Array_indexOf,
	Number_parseInt,
	String_charCodeAt,
	String_fromCodePoint,
	String_startsWith,
	String_substring,
	String_toLowerCase,
} from "@/shared/snapshot";

/** A simple selector that matches no element, valid anywhere `[attr]` is. */
const NEVER = ":not(*)";

// The null-namespace attribute names in htmlRules whose live value can differ
// from the page-visible one. The `on*` names use the event-handler rule.
const MIRRORED_NAMES = [
	"src",
	"href",
	"data",
	"action",
	"formaction",
	"poster",
	"sandbox",
	"integrity",
	"nonce",
	"csp",
	"credentialless",
	"srcset",
	"imagesrcset",
	"srcdoc",
	"style",
	"target",
	"content",
];

function canHaveMirror(name: string): boolean {
	return (
		Array_indexOf(MIRRORED_NAMES, name) !== -1 || String_startsWith(name, "on")
	);
}

function isHex(c: number): boolean {
	return (
		(c >= 0x30 && c <= 0x39) ||
		(c >= 0x41 && c <= 0x46) ||
		(c >= 0x61 && c <= 0x66)
	);
}

function isWhitespace(c: number): boolean {
	return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d;
}

/**
 * The index just past the `]` closing the attribute selector opened at
 * `start`, skipping strings and escapes, or -1 when it is never closed.
 */
function closingBracket(selector: string, start: number): number {
	let quote = 0;
	for (let i = start + 1; i < selector.length; i++) {
		const c = String_charCodeAt(selector, i);
		if (c === 0x5c) {
			i++;
			continue;
		}
		if (quote) {
			if (c === quote) quote = 0;
			continue;
		}
		if (c === 0x22 || c === 0x27) quote = c;
		else if (c === 0x5d) return i + 1;
	}

	return -1;
}

/**
 * The attribute name an attribute selector's body tests for, with its CSS
 * escapes decoded and its namespace prefix dropped.
 */
function attributeName(body: string): {
	name: string;
	start: number;
	end: number;
	namespaced: boolean;
} {
	let i = 0;
	while (i < body.length && isWhitespace(String_charCodeAt(body, i))) i++;
	let start = i;

	const ident = (): string => {
		let out = "";
		while (i < body.length) {
			const c = String_charCodeAt(body, i);
			if (c === 0x5c) {
				i++;
				let hex = "";
				while (
					hex.length < 6 &&
					i < body.length &&
					isHex(String_charCodeAt(body, i))
				) {
					hex += body[i++];
				}
				if (hex.length > 0) {
					if (i < body.length && isWhitespace(String_charCodeAt(body, i))) {
						i++;
					}
					const point = Number_parseInt(hex, 16);
					out += String_fromCodePoint(
						point === 0 || point > 0x10ffff ? 0xfffd : point
					);
				} else if (i < body.length) {
					out += body[i++];
				}
				continue;
			}
			// the end of a name: whitespace, a namespace separator, a matcher,
			// or the case-sensitivity flag after one
			if (
				isWhitespace(c) ||
				c === 0x7c || // |
				c === 0x3d || // =
				c === 0x7e || // ~
				c === 0x5e || // ^
				c === 0x24 || // $
				c === 0x2a // *
			) {
				break;
			}
			out += body[i++];
		}

		return out;
	};

	// `*|name`, `ns|name` and `|name` - the part before a lone `|` (one that
	// is not the start of `|=`) is a namespace prefix
	let name = String_charCodeAt(body, i) === 0x2a ? (i++, "*") : ident();
	let namespaced = false;
	if (
		String_charCodeAt(body, i) === 0x7c &&
		String_charCodeAt(body, i + 1) !== 0x3d
	) {
		namespaced = true;
		i++;
		start = i;
		name = ident();
	}

	return { name, start, end: i, namespaced };
}

/**
 * `selector` with internal attributes hidden and mirrored attributes matched
 * against their page-visible value. Null means the native selector is enough.
 */
export function rewriteAttributeSelectors(selector: string): string | null {
	let out = "";
	let last = 0;
	let changed = false;
	let quote = 0;

	for (let i = 0; i < selector.length; i++) {
		const c = String_charCodeAt(selector, i);
		if (c === 0x5c) {
			i++;
			continue;
		}
		if (quote) {
			if (c === quote) quote = 0;
			continue;
		}
		if (c === 0x22 || c === 0x27) {
			quote = c;
			continue;
		}
		if (c !== 0x5b) continue;

		const end = closingBracket(selector, i);
		// unterminated: the parser closes it at the end of the input
		const stop = end === -1 ? selector.length : end;
		const body = String_substring(
			selector,
			i + 1,
			end === -1 ? stop : stop - 1
		);
		const attribute = attributeName(body);
		if (isInternalAttribute(attribute.name)) {
			out += String_substring(selector, last, i) + NEVER;
			last = stop;
			changed = true;
		} else if (!attribute.namespaced) {
			const name = String_toLowerCase(attribute.name);
			if (canHaveMirror(name)) {
				const mirrorName = mirrorAttributeName(name);
				const original = String_substring(selector, i, stop);
				const mirror =
					"[" +
					String_substring(body, 0, attribute.start) +
					mirrorName +
					String_substring(body, attribute.end) +
					"]";
				// An attribute selector tests the value visible to the page. If a
				// mirror exists, the live attribute is hidden by that mirror's value.
				// https://drafts.csswg.org/selectors/#attribute-selectors
				out +=
					String_substring(selector, last, i) +
					`:is(${original}:not([${mirrorName}]),${mirror})`;
				last = stop;
				changed = true;
			}
		}
		i = stop - 1;
	}

	if (!changed) return null;

	return out + String_substring(selector, last);
}
