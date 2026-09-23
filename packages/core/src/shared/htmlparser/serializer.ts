/**
 * DOM serializer, from dom-serializer's `src/index.ts` (with its
 * `foreign-names.ts`) and the three escapers it uses from `entities`'
 * `src/escape.ts`.
 *
 * The options are pinned to what scramjet always passed -
 * `{ encodeEntities: "utf8", decodeEntities: false }` - which leaves
 * `xmlMode` as the only switch:
 *
 * - HTML: text and attributes are escaped per the HTML spec's "escaping a
 *   string" (`escapeText` / `escapeAttribute`), raw-text elements aren't
 *   escaped, void elements get no end tag, empty attributes print bare.
 * - XML (and foreign content inside HTML): `encodeXML`, which also turns
 *   non-ASCII into numeric references; childless elements self-close.
 */
import {
	Number_toString,
	Object_keys,
	RegExp_exec,
	String,
	String_charCodeAt,
	String_codePointAt,
	String_slice,
	String_substring,
	String_toLowerCase,
} from "../snapshot";
import { type AnyNode, type Element, ElementType, type Text } from "./dom";
import { SafeMap, SafeSet } from "./safe";

type XmlMode = boolean | "foreign";

const xmlCodeMap = new SafeMap<number, string>([
	[34, "&quot;"],
	[38, "&amp;"],
	[39, "&apos;"],
	[60, "&lt;"],
	[62, "&gt;"],
]);

/**
 * Bitset for ASCII characters that need to be escaped in XML.
 */
const XML_BITSET_VALUE = 0x50_00_00_c4; // 32..63 -> 34 ("),38 (&),39 ('),60 (<),62 (>)

/**
 * Encodes all non-ASCII characters, as well as characters not valid in XML
 * documents using XML entities. Uses a fast bitset scan instead of RegExp.
 *
 * If a character has no equivalent entity, a numeric hexadecimal reference
 * (eg. `&#xfc;`) will be used.
 * @param input Input string to encode or decode.
 */
export function encodeXML(input: string): string {
	let out: string | undefined;
	let last = 0;
	const { length } = input;

	for (let index = 0; index < length; index++) {
		const char = String_charCodeAt(input, index);

		// Check for ASCII chars that don't need escaping
		if (
			char < 0x80 &&
			(((XML_BITSET_VALUE >>> char) & 1) === 0 || char >= 64 || char < 32)
		) {
			continue;
		}

		if (out === undefined) out = String_substring(input, 0, index);
		else if (last !== index) out += String_substring(input, last, index);

		if (char < 64) {
			// Known replacement
			out += xmlCodeMap.get(char)!;
			last = index + 1;
			continue;
		}

		// Non-ASCII: encode as numeric entity (handle surrogate pair)
		const cp = String_codePointAt(input, index)!;
		out += `&#x${Number_toString(cp, 16)};`;
		if (cp !== char) index++; // Skip trailing surrogate
		last = index + 1;
	}

	if (out === undefined) return input;
	if (last < length) out += String_slice(input, last);
	return out;
}

/**
 * Creates a function that escapes all characters matched by the given regular
 * expression using the given map of characters to escape to their entities.
 * @param regex Regular expression to match characters to escape.
 * @param map Map of characters to escape to their entities.
 * @returns Function that escapes all characters matched by the given regular
 * expression using the given map of characters to escape to their entities.
 */
function getEscaper(
	regex: RegExp,
	map: SafeMap<number, string>
): (data: string) => string {
	return function escape(data: string): string {
		let match: RegExpExecArray | null;
		let lastIndex = 0;
		let result = "";

		while ((match = RegExp_exec(regex, data))) {
			if (lastIndex !== match.index) {
				result += String_substring(data, lastIndex, match.index);
			}

			// We know that this character will be in the map.
			result += map.get(String_charCodeAt(match[0], 0))!;

			// Every match will be of length 1
			lastIndex = match.index + 1;
		}

		return result + String_substring(data, lastIndex);
	};
}

/**
 * Encodes all characters that have to be escaped in HTML attributes,
 * following {@link https://html.spec.whatwg.org/multipage/parsing.html#escapingString}.
 * @param data String to escape.
 */
export const escapeAttribute: (data: string) => string = getEscaper(
	/["&\u00A0]/g,
	new SafeMap([
		[34, "&quot;"],
		[38, "&amp;"],
		[160, "&nbsp;"],
	])
);

/**
 * Encodes all characters that have to be escaped in HTML text,
 * following {@link https://html.spec.whatwg.org/multipage/parsing.html#escapingString}.
 * @param data String to escape.
 */
export const escapeText: (data: string) => string = getEscaper(
	/[&<>\u00A0]/g,
	new SafeMap([
		[38, "&amp;"],
		[60, "&lt;"],
		[62, "&gt;"],
		[160, "&nbsp;"],
	])
);

function caseMap(names: string[]): SafeMap<string, string> {
	const entries: [string, string][] = [];
	for (let index = 0; index < names.length; index++) {
		entries[index] = [String_toLowerCase(names[index]), names[index]];
	}
	return new SafeMap(entries);
}

/**
 * Mixed-case SVG and MathML element names recognized in foreign content.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign
 */
const elementNames = caseMap([
	"altGlyph",
	"altGlyphDef",
	"altGlyphItem",
	"animateColor",
	"animateMotion",
	"animateTransform",
	"clipPath",
	"feBlend",
	"feColorMatrix",
	"feComponentTransfer",
	"feComposite",
	"feConvolveMatrix",
	"feDiffuseLighting",
	"feDisplacementMap",
	"feDistantLight",
	"feDropShadow",
	"feFlood",
	"feFuncA",
	"feFuncB",
	"feFuncG",
	"feFuncR",
	"feGaussianBlur",
	"feImage",
	"feMerge",
	"feMergeNode",
	"feMorphology",
	"feOffset",
	"fePointLight",
	"feSpecularLighting",
	"feSpotLight",
	"feTile",
	"feTurbulence",
	"foreignObject",
	"glyphRef",
	"linearGradient",
	"radialGradient",
	"textPath",
]);

/**
 * Mixed-case SVG and MathML attribute names recognized in foreign content.
 */
const attributeNames = caseMap([
	"definitionURL",
	"attributeName",
	"attributeType",
	"baseFrequency",
	"baseProfile",
	"calcMode",
	"clipPathUnits",
	"diffuseConstant",
	"edgeMode",
	"filterUnits",
	"glyphRef",
	"gradientTransform",
	"gradientUnits",
	"kernelMatrix",
	"kernelUnitLength",
	"keyPoints",
	"keySplines",
	"keyTimes",
	"lengthAdjust",
	"limitingConeAngle",
	"markerHeight",
	"markerUnits",
	"markerWidth",
	"maskContentUnits",
	"maskUnits",
	"numOctaves",
	"pathLength",
	"patternContentUnits",
	"patternTransform",
	"patternUnits",
	"pointsAtX",
	"pointsAtY",
	"pointsAtZ",
	"preserveAlpha",
	"preserveAspectRatio",
	"primitiveUnits",
	"refX",
	"refY",
	"repeatCount",
	"repeatDur",
	"requiredExtensions",
	"requiredFeatures",
	"specularConstant",
	"specularExponent",
	"spreadMethod",
	"startOffset",
	"stdDeviation",
	"stitchTiles",
	"surfaceScale",
	"systemLanguage",
	"tableValues",
	"targetX",
	"targetY",
	"textLength",
	"viewBox",
	"viewTarget",
	"xChannelSelector",
	"yChannelSelector",
	"zoomAndPan",
]);

const unencodedElements = new SafeSet([
	"style",
	"script",
	"xmp",
	"iframe",
	"noembed",
	"noframes",
	"plaintext",
	"noscript",
]);

/**
 * Format attributes
 * @param attributes Attribute map to serialize.
 * @param xmlMode Serialization mode.
 */
function formatAttributes(
	attributes: { [name: string]: unknown },
	xmlMode: XmlMode
) {
	const encode = xmlMode ? encodeXML : escapeAttribute;

	const keys = Object_keys(attributes);
	let output = "";
	for (let index = 0; index < keys.length; index++) {
		let key = keys[index];
		const value = attributes[key];
		const normalizedValue = value == null ? "" : String(value);

		if (xmlMode === "foreign") {
			/* Fix up mixed-case attribute names */
			key = attributeNames.get(key) ?? key;
		}

		if (index > 0) output += " ";
		output +=
			!xmlMode && normalizedValue === ""
				? key
				: `${key}="${encode(normalizedValue)}"`;
	}

	return output;
}

/**
 * Self-enclosing tags
 */
const singleTag = new SafeSet([
	"area",
	"base",
	"basefont",
	"br",
	"col",
	"command",
	"embed",
	"frame",
	"hr",
	"img",
	"input",
	"isindex",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

/**
 * Renders a DOM node or an array of DOM nodes to a string.
 *
 * Can be thought of as the equivalent of the `outerHTML` of the passed node(s).
 * @param node Node to be rendered.
 * @param xmlMode Treat the input as an XML document.
 */
export function render(
	node: AnyNode | ArrayLike<AnyNode>,
	xmlMode: XmlMode = false
): string {
	const nodes = "length" in node ? node : [node];

	let output = "";
	let index = 0;
	while (index < nodes.length) {
		output += renderNode(nodes[index], xmlMode);
		index++;
	}

	return output;
}

function renderNode(node: AnyNode, xmlMode: XmlMode): string {
	switch (node.type) {
		case ElementType.Root: {
			return render(node.children, xmlMode);
		}
		case ElementType.Directive: {
			return `<${node.data}>`;
		}
		case ElementType.Comment: {
			return `<!--${node.data}-->`;
		}
		case ElementType.CDATA: {
			return `<![CDATA[${(node.children[0] as Text).data}]]>`;
		}
		case ElementType.Tag: {
			return renderTag(node, xmlMode);
		}
		case ElementType.Text: {
			return renderText(node, xmlMode);
		}
	}
}

const foreignModeIntegrationPoints = new SafeSet([
	"mi",
	"mo",
	"mn",
	"ms",
	"mtext",
	"annotation-xml",
	"foreignObject",
	"desc",
	"title",
]);

const foreignElements = new SafeSet(["svg", "math"]);

function renderTag(element: Element, xmlMode: XmlMode) {
	// Handle SVG / MathML in HTML
	if (xmlMode === "foreign") {
		/* Fix up mixed-case element names */
		element.name = elementNames.get(element.name) ?? element.name;
		/* Exit foreign mode at integration points */
		if (
			element.parent &&
			foreignModeIntegrationPoints.has((element.parent as Element).name)
		) {
			xmlMode = false;
		}
	}
	if (!xmlMode && foreignElements.has(element.name)) {
		xmlMode = "foreign";
	}

	let tag = `<${element.name}`;
	const attribs = formatAttributes(element.attribs, xmlMode);

	if (attribs) {
		tag += ` ${attribs}`;
	}

	// In XML mode or foreign mode, childless elements self-close
	if (element.children.length === 0 && xmlMode) {
		tag += "/>";
	} else {
		tag += ">";
		if (element.children.length > 0) {
			tag += render(element.children, xmlMode);
		}

		if (!!xmlMode || !singleTag.has(element.name)) {
			tag += `</${element.name}>`;
		}
	}

	return tag;
}

function renderText(element: Text, xmlMode: XmlMode) {
	let data = element.data || "";

	if (
		!(
			!xmlMode &&
			element.parent &&
			unencodedElements.has((element.parent as Element).name)
		)
	) {
		data = xmlMode ? encodeXML(data) : escapeText(data);
	}

	return data;
}
