import {
    Array_includes,
    Array_indexOf,
    Array_push,
    Array_shift,
    Array_unshift,
    Error,
    Object_create,
    Object_hasOwn,
    Object_setPrototypeOf,
    RegExp_exec,
    String_fromCodePoint as fromCodePoint,
    String_slice,
    String_toLowerCase,
} from "../snapshot";
import {
    type NullRecord,
    SafeMap,
    SafeSet,
    type NullArray,
    nullArray,
    toNullRecord,
} from "./safe";
import Tokenizer, { type Callbacks, QuoteType } from "./Tokenizer";

const formTags = new SafeSet([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea",
]);
const pTag = new SafeSet(["p"]);
const headingTags = new SafeSet(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
const tableSectionTags = new SafeSet(["thead", "tbody"]);
const ddtTags = new SafeSet(["dd", "dt"]);
const rtpTags = new SafeSet(["rt", "rp"]);

const openImpliesClose = new SafeMap<string, SafeSet>([
    ["tr", new SafeSet(["tr", "th", "td"])],
    ["th", new SafeSet(["th"])],
    ["td", new SafeSet(["thead", "th", "td"])],
    ["body", new SafeSet(["head", "link", "script"])],
    ["a", new SafeSet(["a"])],
    ["li", new SafeSet(["li"])],
    ["p", pTag],
    ["h1", headingTags],
    ["h2", headingTags],
    ["h3", headingTags],
    ["h4", headingTags],
    ["h5", headingTags],
    ["h6", headingTags],
    ["select", formTags],
    ["input", formTags],
    ["output", formTags],
    ["button", formTags],
    ["datalist", formTags],
    ["textarea", formTags],
    ["option", new SafeSet(["option"])],
    ["optgroup", new SafeSet(["optgroup", "option"])],
    ["dd", ddtTags],
    ["dt", ddtTags],
    ["address", pTag],
    ["article", pTag],
    ["aside", pTag],
    ["blockquote", pTag],
    ["details", pTag],
    ["div", pTag],
    ["dl", pTag],
    ["fieldset", pTag],
    ["figcaption", pTag],
    ["figure", pTag],
    ["footer", pTag],
    ["form", pTag],
    ["header", pTag],
    ["hr", pTag],
    ["main", pTag],
    ["nav", pTag],
    ["ol", pTag],
    ["pre", pTag],
    ["section", pTag],
    ["table", pTag],
    ["ul", pTag],
    ["rt", rtpTags],
    ["rp", rtpTags],
    ["tbody", tableSectionTags],
    ["tfoot", tableSectionTags],
]);

const DOCUMENT_TYPE = "doctype";

const voidElements = new SafeSet([
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
 * The namespace an element is created in. Scramjet: the parser decides it by
 * the tree construction rules and records it, rather than consumers guessing
 * it back from element names.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#tree-construction
 */
export type Namespace = "html" | "svg" | "math";

/**
 * Where content stops being foreign.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#mathml-text-integration-point
 * @see https://html.spec.whatwg.org/multipage/parsing.html#html-integration-point
 */
const enum Integration {
    None,
    /** start tags but `mglyph` and `malignmark`, and text, are HTML */
    MathMLText,
    /** start tags and text are HTML */
    Html,
}

/** MathML text integration points, by name, in the MathML namespace. */
const mathmlTextIntegrationPoints = new SafeSet(["mi", "mo", "mn", "ms", "mtext"]);

/**
 * HTML integration points by name, in the SVG namespace. MathML's one,
 * `annotation-xml`, is one only for some `encoding`s. Compared against
 * adjusted tag names, so in SVG's casing.
 */
const svgHtmlIntegrationPoints = new SafeSet(["foreignObject", "desc", "title"]);

/**
 * Start tags that end foreign content: open foreign elements are popped
 * until an HTML element or an integration point is current, and the tag is
 * an HTML element there. `font` is one too, with `color`, `face` or `size`.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign
 */
const foreignBreakoutTags = new SafeSet([
    "b", "big", "blockquote", "body", "br", "center", "code", "dd", "div",
    "dl", "dt", "em", "embed", "h1", "h2", "h3", "h4", "h5", "h6", "head",
    "hr", "i", "img", "li", "listing", "menu", "meta", "nobr", "ol", "p",
    "pre", "ruby", "s", "small", "span", "strong", "strike", "sub", "sup",
    "table", "tt", "u", "ul", "var",
]);

const svgTagNameAdjustments = new SafeMap<string, string>([
    ["altglyph", "altGlyph"],
    ["altglyphdef", "altGlyphDef"],
    ["altglyphitem", "altGlyphItem"],
    ["animatecolor", "animateColor"],
    ["animatemotion", "animateMotion"],
    ["animatetransform", "animateTransform"],
    ["clippath", "clipPath"],
    ["feblend", "feBlend"],
    ["fecolormatrix", "feColorMatrix"],
    ["fecomponenttransfer", "feComponentTransfer"],
    ["fecomposite", "feComposite"],
    ["feconvolvematrix", "feConvolveMatrix"],
    ["fediffuselighting", "feDiffuseLighting"],
    ["fedisplacementmap", "feDisplacementMap"],
    ["fedistantlight", "feDistantLight"],
    ["fedropshadow", "feDropShadow"],
    ["feflood", "feFlood"],
    ["fefunca", "feFuncA"],
    ["fefuncb", "feFuncB"],
    ["fefuncg", "feFuncG"],
    ["fefuncr", "feFuncR"],
    ["fegaussianblur", "feGaussianBlur"],
    ["feimage", "feImage"],
    ["femerge", "feMerge"],
    ["femergenode", "feMergeNode"],
    ["femorphology", "feMorphology"],
    ["feoffset", "feOffset"],
    ["fepointlight", "fePointLight"],
    ["fespecularlighting", "feSpecularLighting"],
    ["fespotlight", "feSpotLight"],
    ["fetile", "feTile"],
    ["feturbulence", "feTurbulence"],
    ["foreignobject", "foreignObject"],
    ["glyphref", "glyphRef"],
    ["lineargradient", "linearGradient"],
    ["radialgradient", "radialGradient"],
    ["textpath", "textPath"],
]);

function getContextNamespace(
    startingForeignContext: ParserOptions["startingForeignContext"],
): Namespace {
    switch (startingForeignContext) {
        case "svg":
            return "svg";
        case "math":
            return "math";
        default:
            return "html";
    }
}

/**
 * Options for the streaming HTML/XML parser.
 */
export interface ParserOptions {
    /**
     * Indicates whether special tags (`<script>`, `<style>`, and `<title>`) should get special treatment
     * and if "empty" tags (eg. `<br>`) can have children.  If `false`, the content of special tags
     * will be text only. For feeds and other XML content (documents that don't consist of HTML),
     * set this to `true`.
     * @default false
     */
    xmlMode?: boolean;

    /**
     * Decode entities within the document.
     * @default true
     */
    decodeEntities?: boolean;

    /**
     * If set to true, all tags will be lowercased.
     * @default !xmlMode
     */
    lowerCaseTags?: boolean;

    /**
     * If set to `true`, all attribute names will be lowercased. This has noticeable impact on speed.
     * @default !xmlMode
     */
    lowerCaseAttributeNames?: boolean;

    /**
     * If set to true, CDATA sections will be recognized as text even if the xmlMode option is not enabled.
     * NOTE: If xmlMode is set to `true` then CDATA sections will always be recognized as text.
     * @default xmlMode
     */
    recognizeCDATA?: boolean;

    /**
     * If set to `true`, self-closing tags will trigger the onclosetag event even if xmlMode is not set to `true`.
     * NOTE: If xmlMode is set to `true` then self-closing tags will always be recognized.
     * @default xmlMode
     */
    recognizeSelfClosing?: boolean;

    /**
     * Seeds the parser's foreign-context stack so a chunk of markup can be
     * parsed as though it were already inside an `<svg>` or `<math>` element.
     *
     * `"html"` (the default, equivalent to omitting the option) parses as
     * regular HTML with no foreign context.
     *
     * Scramjet addition: fragment parsing (`innerHTML` on an SVG element).
     * @default "html"
     */
    startingForeignContext?: "svg" | "math" | "html";

    /**
     * Whether HTML parsing treats `<noscript>` as a raw-text element.
     *
     * Scramjet addition: `DOMParser` parses with scripting disabled.
     * @default true
     */
    scriptingEnabled?: boolean;
}

/**
 * Parser callback interface used by the tokenizer.
 */
export interface Handler {
    onparserinit(parser: Parser): void;

    /**
     * Resets the handler back to starting state
     */
    onreset(): void;

    /**
     * Signals the handler that parsing is done
     */
    onend(): void;
    onerror(error: Error): void;
    onclosetag(name: string, isImplied: boolean): void;
    onopentagname(name: string): void;
    /**
     *
     * @param name Name of the attribute
     * @param value Value of the attribute.
     * @param quote Quotes used around the attribute. `null` if the attribute has no quotes around the value, `undefined` if the attribute has no value.
     */
    onattribute(
        name: string,
        value: string,
        quote?: string | undefined | null,
    ): void;
    onopentag(
        name: string,
        attribs: { [s: string]: string },
        isImplied: boolean,
    ): void;
    ontext(data: string): void;
    oncomment(data: string): void;
    oncdatastart(): void;
    oncdataend(): void;
    oncommentend(): void;
    onprocessinginstruction(name: string, data: string): void;
}

const reNameEnd = /\s|\//;

/**
 * Incremental parser implementation.
 */
export class Parser implements Callbacks {
    /** The start index of the last event. */
    startIndex = 0;
    /** The end index of the last event. */
    endIndex = 0;
    /**
     * Store the start index of the current open tag,
     * so we can update the start index for attributes.
     */
    private openTagStart = 0;

    private tagname = "";
    private attribname = "";
    private attribvalue = "";
    private attribs: null | NullRecord<string> = null;
    private readonly stack: NullArray<string> = nullArray();
    /** The namespace of each element on `stack`, at the same index. */
    private readonly namespaces: NullArray<Namespace> = nullArray();
    /** Whether each element on `stack` is an integration point. */
    private readonly integrations: NullArray<Integration> = nullArray();
    /**
     * The namespace of the element markup is parsed in the context of: of
     * the fragment's context element, standing in for the current node while
     * nothing is open.
     */
    private readonly contextNamespace: Namespace;
    /** The namespace of the tag being opened. */
    private tagnamespace: Namespace = "html";
    private readonly cbs: Partial<Handler>;
    private readonly lowerCaseTagNames: boolean;
    private readonly lowerCaseAttributeNames: boolean;
    private readonly recognizeSelfClosing: boolean;
    /** We are parsing HTML. Inverse of the `xmlMode` option. */
    private readonly htmlMode: boolean;
    private readonly tokenizer: Tokenizer;

    private readonly buffers: NullArray<string> = nullArray();
    private bufferOffset = 0;
    /** The index of the last written buffer. Used when resuming after a `pause()`. */
    private writeIndex = 0;
    /** Indicates whether the parser has finished running / `.end` has been called. */
    private ended = false;

    /*
     * Copied onto a null-prototype record: an option the caller left out must
     * read as `undefined`, not as whatever the page put on `Object.prototype`.
     */
    private readonly options: ParserOptions;

    constructor(cbs?: Partial<Handler> | null, options: ParserOptions = {}) {
        this.cbs = cbs ?? Object_create(null);
        this.options = options = toNullRecord<unknown>(
            options as NullRecord<unknown>,
        ) as ParserOptions;
        this.htmlMode = !this.options.xmlMode;
        this.lowerCaseTagNames = options.lowerCaseTags ?? this.htmlMode;
        this.lowerCaseAttributeNames =
            options.lowerCaseAttributeNames ?? this.htmlMode;
        this.recognizeSelfClosing =
            options.recognizeSelfClosing ?? !this.htmlMode;
        this.tokenizer = new Tokenizer(this.options, this);
        this.contextNamespace = getContextNamespace(
            options.startingForeignContext,
        );
        this.cbs.onparserinit?.(this);
    }

    // Tokenizer event handlers

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    ontext(start: number, endIndex: number): void {
        const data = this.getSlice(start, endIndex);
        this.endIndex = endIndex - 1;
        this.cbs.ontext?.(data);
        this.startIndex = endIndex;
    }

    /**
     * @param cp Current Unicode code point.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    ontextentity(cp: number, endIndex: number): void {
        this.endIndex = endIndex - 1;
        this.cbs.ontext?.(fromCodePoint(cp));
        this.startIndex = endIndex;
    }

    /**
     * Whether a start tag here is processed by the rules for foreign content:
     * the current node is a foreign element, and not an integration point.
     * The tokenizer asks, to know whether `<script>`, `<style>` and the
     * others start raw text.
     * @internal
     */
    isInForeignContext(): boolean {
        if (!this.htmlMode) return false;
        if (this.stack.length === 0) return this.contextNamespace !== "html";

        return (
            this.namespaces[0] !== "html" &&
            this.integrations[0] === Integration.None
        );
    }

    /**
     * The namespace of the current node - of the context element while
     * nothing is open. A CDATA section is one, and a self-closing tag closes,
     * outside HTML.
     */
    private currentNamespace(): Namespace {
        return this.stack.length === 0 ? this.contextNamespace : this.namespaces[0];
    }

    /**
     * The namespace a start tag named `name` creates its element in, here.
     * @see https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
     */
    private namespaceFor(name: string): Namespace {
        if (!this.htmlMode) return "html";

        const current = this.currentNamespace();
        const integration =
            this.stack.length === 0 ? Integration.None : this.integrations[0];
        const htmlRules =
            current === "html" ||
            integration === Integration.Html ||
            (integration === Integration.MathMLText &&
                name !== "mglyph" &&
                name !== "malignmark") ||
            (current === "math" &&
                this.stack[0] === "annotation-xml" &&
                name === "svg");

        if (!htmlRules) return current;

        return name === "svg" ? "svg" : name === "math" ? "math" : "html";
    }

    /** Whether an element named `name` in `namespace` is an integration point. */
    private integrationOf(name: string, namespace: Namespace): Integration {
        if (namespace === "math" && mathmlTextIntegrationPoints.has(name)) {
            return Integration.MathMLText;
        }
        if (namespace === "svg" && svgHtmlIntegrationPoints.has(name)) {
            return Integration.Html;
        }

        // `annotation-xml` is decided once its attributes are in, in
        // `endOpenTag`
        return Integration.None;
    }

    /**
     * The namespace of the element the last `onopentag` was for - recorded on
     * it by `DomBuilder`.
     */
    get openTagNamespace(): Namespace {
        return this.tagnamespace;
    }

    /** @internal */
    isScriptingEnabled(): boolean {
        return this.options.scriptingEnabled ?? true;
    }

    /**
     * Checks if the current tag is a void element. Override this if you want
     * to specify your own additional void elements.
     * @param name Name of the pseudo selector.
     */
    protected isVoidElement(name: string, namespace: Namespace = "html"): boolean {
        // only an HTML element is void: an SVG one named `base` has children
        return this.htmlMode && namespace === "html" && voidElements.has(name);
    }

    /**
     * Read a tag name from the buffer.
     *
     * When `lowerCaseTagNames` is enabled (the default in HTML mode), the name
     * is lowercased and may be adjusted for SVG casing or the `image` → `img`
     * alias.
     * @param start Start index of the tag name in the buffer.
     * @param endIndex End index of the tag name in the buffer.
     */
    private readTagName(start: number, endIndex: number): string {
        const name = this.lowerCaseTagNames
            ? String_toLowerCase(this.getSlice(start, endIndex))
            : this.getSlice(start, endIndex);

        if (!(this.lowerCaseTagNames && this.htmlMode)) {
            return name;
        }

        if (this.isInForeignContext() && this.currentNamespace() === "svg") {
            return svgTagNameAdjustments.get(name) ?? name;
        }

        /*
         * Closing tags for SVG elements inside HTML integration points
         * (e.g. </foreignObject> while inside its own content) need case
         * adjustment so the name matches what was pushed to the stack.
         */
        if (Array_includes(this.namespaces, "svg")) {
            const adjusted = svgTagNameAdjustments.get(name);
            if (adjusted !== undefined && Array_includes(this.stack, adjusted)) {
                return adjusted;
            }
        }

        if (!this.isInForeignContext()) {
            return name === "image" ? "img" : name;
        }

        return name;
    }

    /**
     * Read a start tag's name: lowercased, then adjusted by the namespace its
     * element is created in - SVG's mixed casing, or the `image` → `img`
     * alias for an HTML one.
     */
    private readOpenTagName(start: number, endIndex: number): string {
        const name = this.lowerCaseTagNames
            ? String_toLowerCase(this.getSlice(start, endIndex))
            : this.getSlice(start, endIndex);

        if (!(this.lowerCaseTagNames && this.htmlMode)) {
            return name;
        }

        const namespace = this.namespaceFor(name);
        if (namespace === "svg") return svgTagNameAdjustments.get(name) ?? name;
        if (namespace === "html" && name === "image") return "img";

        return name;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onopentagname(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        this.emitOpenTag(this.readOpenTagName(start, endIndex));
    }

    private emitOpenTag(name: string) {
        this.openTagStart = this.startIndex;

        /*
         * Scramjet: a start tag that breaks out of foreign content closes the
         * foreign elements around it, and is an HTML element where that
         * leaves off. With nothing left open, the fragment's context is the
         * current node, and the element is HTML all the same.
         */
        let namespace = this.namespaceFor(name);
        if (
            this.htmlMode &&
            namespace !== "html" &&
            this.isInForeignContext() &&
            foreignBreakoutTags.has(name)
        ) {
            while (this.stack.length > 0 && this.isInForeignContext()) {
                this.popElement(true);
            }
            namespace = "html";
        }

        this.tagname = name;
        this.tagnamespace = namespace;

        /*
         * The spec ignores a second <form> when one is already open.
         * Setting tagname to "" suppresses all downstream effects: attribs
         * stays null so endOpenTag is a no-op, and closeCurrentTag can't
         * match "" on the stack.
         */
        if (this.htmlMode && name === "form" && Array_includes(this.stack, "form")) {
            this.tagname = "";
            return;
        }

        const impliesClose = this.htmlMode && openImpliesClose.get(name);

        if (impliesClose) {
            while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
                this.popElement(true);
            }
        }
        if (!this.isVoidElement(name, namespace)) {
            Array_unshift(this.stack, name);
            Array_unshift(this.namespaces, namespace);
            Array_unshift(this.integrations, this.integrationOf(name, namespace));
        }
        this.cbs.onopentagname?.(name);
        if (this.cbs.onopentag) this.attribs = Object_create(null);
    }

    private endOpenTag(isImplied: boolean) {
        this.startIndex = this.openTagStart;

        /*
         * Scramjet: `font` breaks out of foreign content too, when it has one
         * of these attributes - known only now. Nothing has been told about
         * the element yet but its name, so it is moved out before it is
         * built: off the stack, the foreign elements around it closed, and
         * back on as an HTML element.
         */
        if (
            this.htmlMode &&
            this.attribs &&
            this.tagname === "font" &&
            this.tagnamespace !== "html" &&
            this.stack[0] === "font" &&
            ("color" in this.attribs ||
                "face" in this.attribs ||
                "size" in this.attribs)
        ) {
            Array_shift(this.stack);
            Array_shift(this.namespaces);
            Array_shift(this.integrations);
            while (this.stack.length > 0 && this.isInForeignContext()) {
                this.popElement(true);
            }
            this.tagnamespace = "html";
            Array_unshift(this.stack, "font");
            Array_unshift(this.namespaces, "html");
            Array_unshift(this.integrations, Integration.None);
        }

        // MathML's `annotation-xml` is an HTML integration point when its
        // encoding says it holds HTML
        if (
            this.htmlMode &&
            this.attribs &&
            this.tagname === "annotation-xml" &&
            this.tagnamespace === "math" &&
            this.stack[0] === "annotation-xml"
        ) {
            const encoding = this.attribs["encoding"];
            const lowered =
                encoding === undefined ? "" : String_toLowerCase(encoding);
            if (lowered === "text/html" || lowered === "application/xhtml+xml") {
                this.integrations[0] = Integration.Html;
            }
        }

        if (this.attribs) {
            this.cbs.onopentag?.(this.tagname, this.attribs, isImplied);
            this.attribs = null;
        }
        if (
            this.cbs.onclosetag &&
            this.isVoidElement(this.tagname, this.tagnamespace)
        ) {
            this.cbs.onclosetag(this.tagname, true);
        }

        this.tagname = "";
    }

    /**
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onopentagend(endIndex: number): void {
        this.endIndex = endIndex;
        this.endOpenTag(false);

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onclosetag(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        const name = this.readTagName(start, endIndex);

        /*
         * Scramjet: HTML end tags for <p> and <br> break out of foreign
         * content, per the foreign-content parsing rules in the HTML Standard.
         */
        if (
            this.htmlMode &&
            this.isInForeignContext() &&
            (name === "p" || name === "br")
        ) {
            while (this.stack.length > 0 && this.isInForeignContext()) {
                this.popElement(true);
            }
        }

        const closesVoid =
            this.isVoidElement(name) && !this.isInForeignContext();
        if (!closesVoid) {
            const pos = Array_indexOf(this.stack, name);
            if (pos !== -1) {
                for (let index = 0; index < pos; index++) {
                    this.popElement(true);
                }
                this.popElement(false);
            } else if (this.htmlMode && name === "p") {
                // Implicit open before close
                this.emitOpenTag("p");
                this.closeCurrentTag(true);
            }
        } else if (this.htmlMode && name === "br") {
            // We can't use `emitOpenTag` for implicit open, as `br` would be implicitly closed.
            this.cbs.onopentagname?.("br");
            this.cbs.onopentag?.("br", {}, true);
            this.cbs.onclosetag?.("br", false);
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /**
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onselfclosingtag(endIndex: number): void {
        this.endIndex = endIndex;
        if (this.recognizeSelfClosing || this.currentNamespace() !== "html") {
            this.closeCurrentTag(false);

            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        } else {
            // Ignore the fact that the tag is self-closing.
            this.onopentagend(endIndex);
        }
    }

    /**
     * Pop the top element off the stack, emit a close event, and maintain
     * the foreign context stack.
     * @param implied Whether this close is implied (not from an explicit end tag).
     */
    private popElement(implied: boolean): void {
        // biome-ignore lint/style/noNonNullAssertion: The element is guaranteed to exist.
        const element = Array_shift(this.stack)!;
        Array_shift(this.namespaces);
        Array_shift(this.integrations);
        this.cbs.onclosetag?.(element, implied);
    }

    private closeCurrentTag(isOpenImplied: boolean) {
        const name = this.tagname;
        this.endOpenTag(isOpenImplied);

        // Self-closing tags will be on the top of the stack
        if (this.stack[0] === name) {
            this.popElement(!isOpenImplied);
        }
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onattribname(start: number, endIndex: number): void {
        this.startIndex = start;
        const name = this.getSlice(start, endIndex);

        this.attribname = this.lowerCaseAttributeNames
            ? String_toLowerCase(name)
            : name;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onattribdata(start: number, endIndex: number): void {
        this.attribvalue += this.getSlice(start, endIndex);
    }

    /**
     * @param cp Current Unicode code point.
     * @internal
     */
    onattribentity(cp: number): void {
        this.attribvalue += fromCodePoint(cp);
    }

    /**
     * @param quote Quote type used for the current attribute.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onattribend(quote: QuoteType, endIndex: number): void {
        this.endIndex = endIndex;

        this.cbs.onattribute?.(
            this.attribname,
            this.attribvalue,
            quote === QuoteType.Double
                ? '"'
                : quote === QuoteType.Single
                  ? "'"
                  : quote === QuoteType.NoValue
                    ? undefined
                    : null,
        );

        if (this.attribs && !Object_hasOwn(this.attribs, this.attribname)) {
            this.attribs[this.attribname] = this.attribvalue;
        }
        this.attribvalue = "";
    }

    private getInstructionName(value: string) {
        const match = RegExp_exec(reNameEnd, value);
        let name = match === null ? value : String_slice(value, 0, match.index);

        if (this.lowerCaseTagNames) {
            name = String_toLowerCase(name);
        }

        return name;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    ondeclaration(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);

        if (this.cbs.onprocessinginstruction) {
            /*
             * In HTML mode, ondeclaration is only reached for DOCTYPE
             * (the tokenizer routes everything else to bogus comments).
             */
            const name = this.htmlMode
                ? this.lowerCaseTagNames
                    ? DOCUMENT_TYPE
                    : String_slice(value, 0, DOCUMENT_TYPE.length)
                : this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @internal
     */
    onprocessinginstruction(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);

        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @param offset Offset applied when computing parser indices.
     * @internal
     */
    oncomment(start: number, endIndex: number, offset: number): void {
        this.endIndex = endIndex;

        this.cbs.oncomment?.(this.getSlice(start, endIndex - offset));
        this.cbs.oncommentend?.();

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /**
     * @param start Start index for the current parser event.
     * @param endIndex End index for the current parser event.
     * @param offset Offset applied when computing parser indices.
     * @internal
     */
    oncdata(start: number, endIndex: number, offset: number): void {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex - offset);

        if (!this.htmlMode || this.options.recognizeCDATA) {
            this.cbs.oncdatastart?.();
            this.cbs.ontext?.(value);
            this.cbs.oncdataend?.();
        } else if (this.currentNamespace() !== "html") {
            this.cbs.ontext?.(value);
        } else {
            this.cbs.oncomment?.(`[CDATA[${value}]]`);
            this.cbs.oncommentend?.();
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /** @internal */
    onend(): void {
        if (this.cbs.onclosetag) {
            // Set the end index for all remaining tags
            this.endIndex = this.startIndex;
            for (let index = 0; index < this.stack.length; index++) {
                this.cbs.onclosetag(this.stack[index], true);
            }
        }
        this.cbs.onend?.();
    }

    /**
     * Resets the parser to a blank state, ready to parse a new HTML document
     */
    reset(): void {
        this.cbs.onreset?.();
        this.tokenizer.reset();
        this.tagname = "";
        this.attribname = "";
        this.attribvalue = "";
        this.attribs = null;
        this.stack.length = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.cbs.onparserinit?.(this);
        this.buffers.length = 0;
        this.namespaces.length = 0;
        this.integrations.length = 0;
        this.bufferOffset = 0;
        this.writeIndex = 0;
        this.ended = false;
    }

    /**
     * Resets the parser, then parses a complete document and
     * pushes it to the handler.
     * @param data Document to parse.
     */
    parseComplete(data: string): void {
        this.reset();
        this.end(data);
    }

    private getSlice(start: number, end: number) {
        if (start === end) {
            return "";
        }

        while (start - this.bufferOffset >= this.buffers[0].length) {
            this.shiftBuffer();
        }

        let slice = String_slice(
            this.buffers[0],
            start - this.bufferOffset,
            end - this.bufferOffset,
        );

        while (end - this.bufferOffset > this.buffers[0].length) {
            this.shiftBuffer();
            slice += String_slice(this.buffers[0], 0, end - this.bufferOffset);
        }

        return slice;
    }

    private shiftBuffer(): void {
        this.bufferOffset += this.buffers[0].length;
        this.writeIndex--;
        Array_shift(this.buffers);
    }

    /**
     * Parses a chunk of data and calls the corresponding callbacks.
     * @param chunk Chunk to parse.
     */
    write(chunk: string): void {
        if (this.ended) {
            this.cbs.onerror?.(new Error(".write() after done!"));
            return;
        }

        Array_push(this.buffers, chunk);
        if (this.tokenizer.running) {
            this.tokenizer.write(chunk);
            this.writeIndex++;
        }
    }

    /**
     * Parses the end of the buffer and clears the stack, calls onend.
     * @param chunk Optional final chunk to parse.
     */
    end(chunk?: string): void {
        if (this.ended) {
            this.cbs.onerror?.(new Error(".end() after done!"));
            return;
        }

        if (chunk) this.write(chunk);
        this.ended = true;
        this.tokenizer.end();
    }

    /**
     * Pauses parsing. The parser won't emit events until `resume` is called.
     */
    pause(): void {
        this.tokenizer.pause();
    }

    /**
     * Resumes parsing after `pause` was called.
     */
    resume(): void {
        this.tokenizer.resume();

        while (
            this.tokenizer.running &&
            this.writeIndex < this.buffers.length
        ) {
            this.tokenizer.write(this.buffers[this.writeIndex++]);
        }

        if (this.ended) this.tokenizer.end();
    }
}

Object_setPrototypeOf(Parser.prototype, null);
