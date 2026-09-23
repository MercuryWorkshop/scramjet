/**
 * Reflected IDL attributes - `img.src`, `a.href`, `iframe.srcdoc`, and the
 * thirty-odd others that are a view onto a content attribute.
 *
 * Every one of them is one of four shapes, which is what makes this file a
 * table rather than thirty special cases:
 *
 *   [Reflect]     the content attribute's value, or "" when it is absent
 *   [ReflectURL]  the same, parsed against the element's document base URL
 *   boolean       whether the content attribute is there at all
 *   custom        a getter the spec spells out, which for the ones here means
 *                 falling back to the document's URL (`action`, `formAction`)
 *                 or to the raw attribute (`a.href`, `base.href`)
 *
 * https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes
 *
 * The setters are all "set the content attribute", which is `dom/element.ts`'s
 * write path, so a rewrite rule applies exactly as it does to `setAttribute`.
 * The getters never read the document directly: they read the mirror, which is
 * what the page wrote, and resolve it against the *site's* base URL rather than
 * the proxy's. An absolute proxy URL answered here would be the plainest leak
 * there is - `img.src` is the first thing a fingerprint reads.
 */

import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type, idlUSVString } from "@client/webidl";
import { unrewriteUrl } from "@rewriters/url";
import { XLINK_NAMESPACE } from "@client/attributes";
import { String, String_startsWith, _URL } from "@/shared/snapshot";

export default function (client: ScramjetClient, self: Self) {
	const attrs = client.attributes;

	const DOCUMENT_NODE = 9;

	/**
	 * A URL as the site should see it. Only a URL that is actually the proxy's
	 * is unrewritten - anything else is already what the page wrote, and handing
	 * it to `unrewriteUrl` would only earn a "unexpected url" in the console.
	 */
	const siteUrl = (url: string): string =>
		String_startsWith(url, client.context.prefix.href)
			? unrewriteUrl(url, client.context)
			: url;

	/**
	 * The URL of `node`'s document, as the site's - the document's fallback base
	 * URL, which is what a `base` element's own href is resolved against.
	 */
	const documentURL = (node: Node): string => {
		const owner =
			new client.native.Node(node).nodeType === DOCUMENT_NODE
				? (node as Document)
				: new client.native.Node(node).ownerDocument;
		if (!owner) return client.url.href;

		return siteUrl(new client.native.Document(owner).URL);
	};

	const ownerDocumentOf = (node: Node): Document | null =>
		new client.native.Node(node).nodeType === DOCUMENT_NODE
			? (node as Document)
			: new client.native.Node(node).ownerDocument;

	/**
	 * https://html.spec.whatwg.org/multipage/urls-and-fetching.html#fallback-base-url -
	 * what a document's relative URLs resolve against when it has no base
	 * element, and what a base element's own href is resolved against.
	 *
	 * An `about:srcdoc` document has no URL of its own to resolve against, and
	 * takes its container's document base URL; so does an `about:blank` one,
	 * whose creator is (for the frames a page can reach) the document holding
	 * the frame.
	 */
	const fallbackBaseURL = (node: Node): string => {
		const url = documentURL(node);
		if (url !== "about:srcdoc" && url !== "about:blank") return url;

		const owner = ownerDocumentOf(node);
		if (!owner) return url;

		try {
			const view = new client.native.Document(owner).defaultView;
			const container: Element | null = view
				? new client.native.window(view).frameElement
				: null;
			if (container) return baseURL(container);
		} catch {
			// a cross-origin container: the frame has nothing to inherit
		}

		return url;
	};

	/** Whether `url` parses on its own, with no base to lean on. */
	const isAbsolute = (url: string): boolean => {
		try {
			new _URL(url);

			return true;
		} catch {
			return false;
		}
	};

	/**
	 * The document base URL of `node`'s document, as the site's.
	 *
	 * The browser has already resolved the whole chain, so `baseURI` answers
	 * this for free in the two cases that are not scramjet's business: a
	 * `base` element with an absolute href, which scramjet leaves alone and
	 * which is therefore already the site's, and anything off the proxy's
	 * origin altogether. And when the native base *is* the document's own URL,
	 * no base element is in effect and un-rewriting it is the whole answer -
	 * the common case, and the one every `img.src` read takes.
	 *
	 * Anything else on the proxy's origin means a *relative* base href. The
	 * browser resolved it against the document's real URL, the proxy's, and the
	 * result may well still start with the prefix - `static/` resolved against
	 * `/~/sj/<encoded url>` is `/~/sj/static/` - while un-rewriting to nothing
	 * the site ever had. That is the case resolved by hand, from the base
	 * element and the site's own URL.
	 */
	const baseURL = (node: Node): string => {
		const native: string = new client.native.Node(node).baseURI;
		if (!String_startsWith(native, client.context.prefix.origin)) return native;

		const owner = ownerDocumentOf(node);
		if (
			owner &&
			String_startsWith(native, client.context.prefix.href) &&
			native === new client.native.Document(owner).URL
		) {
			const site = unrewriteUrl(native, client.context);
			if (isAbsolute(site)) return site;
		}

		return resolveBaseElement(node);
	};

	/** https://html.spec.whatwg.org/multipage/urls-and-fetching.html#document-base-url */
	const resolveBaseElement = (node: Node): string => {
		const fallback = fallbackBaseURL(node);
		const owner = ownerDocumentOf(node);
		if (!owner) return fallback;

		// the first base element with an href, in tree order
		const base: Element | null = new client.native.Document(
			owner
		).querySelector("base[href]");
		if (!base) return fallback;

		const href = attrs.get(base, "href");
		if (!href) return fallback;

		try {
			return new _URL(href, fallback).href;
		} catch {
			return fallback;
		}
	};

	/** "encoding-parse and serialize a URL", against the site's base. */
	const resolve = (element: Element, value: string, base?: string): string => {
		try {
			return siteUrl(new _URL(value, base ?? baseURL(element)).href);
		} catch {
			// a URL that does not parse is returned as it was written
			return idlUSVString(value);
		}
	};

	/** The getter steps for a `USVString` reflected IDL attribute treated as a URL. */
	const reflectURL = (element: Element, attribute: string): string => {
		const value = attrs.get(element, attribute);
		if (value === null) return "";

		return resolve(element, value);
	};

	/** The getter steps for a `DOMString` or `USVString` reflected IDL attribute. */
	const reflect = (element: Element, attribute: string): string => {
		const value = attrs.get(element, attribute);

		return value === null ? "" : value;
	};

	/** The setter steps shared by every reflected IDL attribute. */
	const set = (element: Element, attribute: string, value: unknown): void => {
		attrs.set(element, attribute, String(value));
	};

	/** The setter steps for a `boolean` reflected IDL attribute. */
	const setBoolean = (
		element: Element,
		attribute: string,
		value: boolean
	): void => {
		if (value) attrs.set(element, attribute, "");
		else attrs.remove(element, attribute);
	};

	/**
	 * The getter steps `action` and `formAction` share: an absent or empty
	 * attribute means the document's own URL.
	 *
	 * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#dom-fs-action
	 */
	const reflectSubmitTarget = (element: Element, attribute: string): string => {
		const value = attrs.get(element, attribute);
		if (value === null || value === "") return documentURL(element);

		return resolve(element, value);
	};

	// --- images and media ---------------------------------------------------

	client.Intercept(class extends HTMLImageElement {
		@Type("USVString")
		get src(): string {
			void super.complete;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.complete;

			set(this, "src", value);
		}

		@Type("USVString")
		get srcset(): string {
			void super.complete;

			return reflect(this, "srcset");
		}

		@Type("USVString")
		set srcset(value: string) {
			void super.complete;

			set(this, "srcset", value);
		}

		// the URL the browser actually picked out of src/srcset, so it is a proxy
		// URL rather than a mirrored attribute
		@Type("USVString")
		get currentSrc(): string {
			const current = super.currentSrc;
			if (!current) return current;

			return siteUrl(current);
		}

		@Type("USVString")
		get lowsrc(): string {
			void super.complete;

			return reflectURL(this, "lowsrc");
		}

		@Type("USVString")
		set lowsrc(value: string) {
			void super.complete;

			set(this, "lowsrc", value);
		}

		@Type("USVString")
		get longDesc(): string {
			void super.complete;

			return reflectURL(this, "longdesc");
		}

		@Type("USVString")
		set longDesc(value: string) {
			void super.complete;

			set(this, "longdesc", value);
		}
	});

	client.Intercept(class extends HTMLSourceElement {
		@Type("USVString")
		get src(): string {
			void super.media;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.media;

			set(this, "src", value);
		}

		@Type("USVString")
		get srcset(): string {
			void super.media;

			return reflect(this, "srcset");
		}

		@Type("USVString")
		set srcset(value: string) {
			void super.media;

			set(this, "srcset", value);
		}
	});

	client.Intercept(class extends HTMLMediaElement {
		@Type("USVString")
		get src(): string {
			void super.readyState;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.readyState;

			set(this, "src", value);
		}

		@Type("USVString")
		get currentSrc(): string {
			const current = super.currentSrc;
			if (!current) return current;

			return siteUrl(current);
		}
	});

	client.Intercept(class extends HTMLVideoElement {
		@Type("USVString")
		get poster(): string {
			void super.videoWidth;

			return reflectURL(this, "poster");
		}

		@Type("USVString")
		set poster(value: string) {
			void super.videoWidth;

			set(this, "poster", value);
		}
	});

	client.Intercept(class extends HTMLTrackElement {
		@Type("USVString")
		get src(): string {
			void super.kind;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.kind;

			set(this, "src", value);
		}
	});

	// --- embedded content ---------------------------------------------------

	client.Intercept(class extends HTMLIFrameElement {
		@Type("USVString")
		get src(): string {
			void super.name;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.name;

			set(this, "src", value);
		}

		@Type("(TrustedHTML or DOMString)")
		get srcdoc(): string {
			void super.name;

			return reflect(this, "srcdoc");
		}

		@Type("(TrustedHTML or DOMString)")
		set srcdoc(value: string) {
			void super.name;

			set(this, "srcdoc", value);
		}

		// stripped from the document, so the mirror is the only thing left that
		// remembers what the page asked for
		@Type("DOMString")
		get csp(): string {
			void super.name;

			return reflect(this, "csp");
		}

		@Type("DOMString")
		set csp(value: string) {
			void super.name;

			set(this, "csp", value);
		}

		@Type("boolean")
		get credentialless(): boolean {
			void super.name;

			return attrs.has(this, "credentialless");
		}

		@Type("boolean")
		set credentialless(value: boolean) {
			void super.name;

			setBoolean(this, "credentialless", !!value);
		}

		@Type("USVString")
		get longDesc(): string {
			void super.name;

			return reflectURL(this, "longdesc");
		}

		@Type("USVString")
		set longDesc(value: string) {
			void super.name;

			set(this, "longdesc", value);
		}

		// [PutForwards=value], which the native setter implements as a script-
		// level Get of this attribute and a Set of `value` on what it returns -
		// so `iframe.sandbox = "..."` lands on the stand-in's list too, and on
		// the `value` interceptor below
		@Type("DOMTokenList")
		get sandbox(): DOMTokenList {
			void super.name;

			return sandboxList(this);
		}
	});

	// --- iframe.sandbox, over a stand-in -------------------------------------

	/** The token list handed out as `iframe.sandbox`: the stand-in's own. */
	const sandboxList = (element: Element): DOMTokenList => {
		let standIn = client.box.sandboxStandIns.get(element);
		if (!standIn) {
			const owner = ownerDocumentOf(element) ?? client.global.document;
			standIn = new client.native.Document(owner).createElement(
				"iframe"
			) as Element;
			const value = attrs.get(element, "sandbox");
			if (value !== null) attrs.raw.set(standIn, "sandbox", value);

			client.box.sandboxStandIns.set(element, standIn);
			client.box.sandboxLists.set(
				new client.native.HTMLIFrameElement(standIn).sandbox,
				element
			);
		}

		return new client.native.HTMLIFrameElement(standIn).sandbox;
	};

	/**
	 * After a write through the stand-in's list, carry its value over to the
	 * iframe it stands in for - through the ordinary write path, so the rule
	 * strips it from the live frame and the mirror records it.
	 */
	const syncSandbox = (list: DOMTokenList) => {
		const element = client.box.sandboxLists.get(list);
		if (!element) return;

		const standIn = client.box.sandboxStandIns.get(element)!;
		const value = attrs.raw.get(standIn, "sandbox");
		if (value === null) attrs.remove(element, "sandbox");
		else attrs.set(element, "sandbox", value);
	};

	// https://dom.spec.whatwg.org/#interface-domtokenlist - only the members
	// that write, and only to notice a write to a stand-in's list. every
	// other list in the document passes straight through
	client.Intercept(class extends DOMTokenList {
		@Arguments("DOMString...")
		@Returns("undefined")
		add(...tokens: string[]): void {
			super.add(...tokens);
			syncSandbox(this);
		}

		@Arguments("DOMString...")
		@Returns("undefined")
		remove(...tokens: string[]): void {
			super.remove(...tokens);
			syncSandbox(this);
		}

		@Arguments("DOMString", "optional boolean")
		@Returns("boolean")
		toggle(token: string, force?: boolean): boolean {
			const result =
				force === undefined ? super.toggle(token) : super.toggle(token, force);
			syncSandbox(this);

			return result;
		}

		@Arguments("DOMString", "DOMString")
		@Returns("boolean")
		replace(token: string, newToken: string): boolean {
			const result = super.replace(token, newToken);
			syncSandbox(this);

			return result;
		}

		@Type("DOMString")
		set value(value: string) {
			void super.length;
			super.value = value;
			syncSandbox(this);
		}
	});

	// a frameset's frame. still shipped by every engine
	if ("HTMLFrameElement" in self) {
		client.Intercept(class extends HTMLFrameElement {
			@Type("USVString")
			get src(): string {
				void super.name;

				return reflectURL(this, "src");
			}

			@Type("USVString")
			set src(value: string) {
				void super.name;

				set(this, "src", value);
			}

			@Type("USVString")
			get longDesc(): string {
				void super.name;

				return reflectURL(this, "longdesc");
			}

			@Type("USVString")
			set longDesc(value: string) {
				void super.name;

				set(this, "longdesc", value);
			}
		});
	}

	client.Intercept(class extends HTMLEmbedElement {
		@Type("USVString")
		get src(): string {
			void super.type;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.type;

			set(this, "src", value);
		}
	});

	client.Intercept(class extends HTMLObjectElement {
		@Type("USVString")
		get data(): string {
			void super.type;

			return reflectURL(this, "data");
		}

		@Type("USVString")
		set data(value: string) {
			void super.type;

			set(this, "data", value);
		}

		@Type("DOMString")
		get codeBase(): string {
			void super.type;

			return reflectURL(this, "codebase");
		}

		@Type("DOMString")
		set codeBase(value: string) {
			void super.type;

			set(this, "codebase", value);
		}
	});

	// --- scripts and stylesheets --------------------------------------------

	client.Intercept(class extends HTMLScriptElement {
		@Type("DOMString")
		get type(): string {
			void super.type;

			return reflect(this, "type");
		}

		@Type("DOMString")
		set type(value: string) {
			void super.type;

			set(this, "type", value);
		}

		@Type("USVString")
		get src(): string {
			void super.type;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.type;

			set(this, "src", value);
		}

		// blanked in the document - the proxy serves a rewritten body, which can
		// never match the digest the page computed
		@Type("DOMString")
		get integrity(): string {
			void super.type;

			return reflect(this, "integrity");
		}

		@Type("DOMString")
		set integrity(value: string) {
			void super.type;

			set(this, "integrity", value);
		}
	});

	client.Intercept(class extends HTMLLinkElement {
		@Type("USVString")
		get href(): string {
			void super.rel;

			return reflectURL(this, "href");
		}

		@Type("USVString")
		set href(value: string) {
			void super.rel;

			set(this, "href", value);
		}

		@Type("DOMString")
		get integrity(): string {
			void super.rel;

			return reflect(this, "integrity");
		}

		@Type("DOMString")
		set integrity(value: string) {
			void super.rel;

			set(this, "integrity", value);
		}

		// the IDL name is `imageSrcset`; the content attribute is `imagesrcset`.
		// reflecting the IDL name would write an attribute nothing reads
		@Type("USVString")
		get imageSrcset(): string {
			void super.rel;

			return reflect(this, "imagesrcset");
		}

		@Type("USVString")
		set imageSrcset(value: string) {
			void super.rel;

			set(this, "imagesrcset", value);
		}
	});

	// --- forms --------------------------------------------------------------

	client.Intercept(class extends HTMLFormElement {
		@Type("USVString")
		get action(): string {
			void super.method;

			return reflectSubmitTarget(this, "action");
		}

		@Type("USVString")
		set action(value: string) {
			void super.method;

			set(this, "action", value);
		}

		@Type("DOMString")
		get target(): string {
			void super.method;

			return reflect(this, "target");
		}

		@Type("DOMString")
		set target(value: string) {
			void super.method;

			set(this, "target", value);
		}
	});

	client.Intercept(class extends HTMLInputElement {
		@Type("USVString")
		get src(): string {
			void super.type;

			return reflectURL(this, "src");
		}

		@Type("USVString")
		set src(value: string) {
			void super.type;

			set(this, "src", value);
		}

		@Type("USVString")
		get formAction(): string {
			void super.type;

			return reflectSubmitTarget(this, "formaction");
		}

		@Type("USVString")
		set formAction(value: string) {
			void super.type;

			set(this, "formaction", value);
		}
	});

	client.Intercept(class extends HTMLButtonElement {
		@Type("USVString")
		get formAction(): string {
			void super.type;

			return reflectSubmitTarget(this, "formaction");
		}

		@Type("USVString")
		set formAction(value: string) {
			void super.type;

			set(this, "formaction", value);
		}
	});

	// --- quotes and edits ---------------------------------------------------

	client.Intercept(class extends HTMLQuoteElement {
		@Type("USVString")
		get cite(): string {
			void super.cite;

			return reflectURL(this, "cite");
		}

		@Type("USVString")
		set cite(value: string) {
			void super.cite;

			set(this, "cite", value);
		}
	});

	client.Intercept(class extends HTMLModElement {
		@Type("USVString")
		get cite(): string {
			void super.dateTime;

			return reflectURL(this, "cite");
		}

		@Type("USVString")
		set cite(value: string) {
			void super.dateTime;

			set(this, "cite", value);
		}
	});

	// --- the nonce, which is not in the document at all ---------------------

	// https://html.spec.whatwg.org/multipage/urls-and-fetching.html#dom-noncedelement-nonce -
	// the IDL attribute is the element's [[CryptographicNonce]] slot, not the
	// content attribute: setting it leaves `getAttribute("nonce")` alone. The
	// slot follows the content attribute through `dom/element.ts`'s change
	// steps; an element that never had either written by script (a parsed
	// one) falls back to the mirror, which is what the parser saw. The content
	// attribute itself is stripped by the rewriter, because the proxy's CSP is
	// not the site's.
	const nonceOf = (element: Element): string => {
		const slot = client.box.nonces.get(element);
		if (slot !== undefined) return slot;

		return reflect(element, "nonce");
	};

	client.Intercept(class extends HTMLElement {
		@Type("DOMString")
		get nonce(): string {
			void super.title;

			return nonceOf(this);
		}

		@Type("DOMString")
		set nonce(value: string) {
			void super.title;

			client.box.nonces.set(this, String(value));
		}
	});

	client.Intercept(class extends SVGElement {
		@Type("DOMString")
		get nonce(): string {
			void super.ownerSVGElement;

			return nonceOf(this);
		}

		@Type("DOMString")
		set nonce(value: string) {
			void super.ownerSVGElement;

			client.box.nonces.set(this, String(value));
		}
	});

	// MathML mixes in HTMLOrSVGElement too, and its nonce is stripped by the
	// same `"*"` rule
	if ("MathMLElement" in self && "nonce" in self.MathMLElement.prototype) {
		client.Intercept(class extends MathMLElement {
			@Type("DOMString")
			get nonce(): string {
				void super.tabIndex;

				return nonceOf(this);
			}

			@Type("DOMString")
			set nonce(value: string) {
				void super.tabIndex;

				client.box.nonces.set(this, String(value));
			}
		});
	}

	// --- hyperlinks ---------------------------------------------------------

	/**
	 * https://html.spec.whatwg.org/multipage/links.html#reinitialise-url - the
	 * element's URL, which is its href content attribute parsed against its
	 * document, or null when there is no href or it does not parse.
	 */
	const hyperlinkURL = (element: Element): URL | null => {
		const href = attrs.get(element, "href");
		if (href === null) return null;

		try {
			return new _URL(href, baseURL(element));
		} catch {
			return null;
		}
	};

	/** https://html.spec.whatwg.org/multipage/links.html#update-href */
	const updateHref = (element: Element, url: URL): void => {
		attrs.set(element, "href", url.href);
	};

	const hyperlinkHref = (element: Element): string => {
		const url = hyperlinkURL(element);
		if (url) return url.href;

		// no href at all is the empty string; an href that does not parse is
		// itself, unresolved
		const href = attrs.get(element, "href");

		return href === null ? "" : idlUSVString(href);
	};

	/**
	 * The ten URL decomposition members.
	 *
	 * Every one of them is defined as "basic URL parse the value with this's url
	 * as url and <x> state as state override", which is exactly what the URL
	 * object's own setter does - so the algorithm is borrowed rather than
	 * reimplemented, and it stays correct as the URL parser moves.
	 */
	type Decomposed =
		| "protocol"
		| "username"
		| "password"
		| "host"
		| "hostname"
		| "port"
		| "pathname"
		| "search"
		| "hash";

	const getPart = (
		element: Element,
		part: Decomposed | "origin",
		absent: string
	): string => {
		const url = hyperlinkURL(element);
		if (!url) return absent;

		return url[part];
	};

	const setPart = (
		element: Element,
		part: Decomposed,
		value: unknown
	): void => {
		const url = hyperlinkURL(element);
		// "if this's url is null, then return" - a hyperlink with no href is not
		// a URL to decompose
		if (!url) return;

		url[part] = String(value);
		updateHref(element, url);
	};

	client.Intercept(class extends HTMLAnchorElement {
		@Type("USVString")
		get href(): string {
			void super.rel;

			return hyperlinkHref(this);
		}

		@Type("USVString")
		set href(value: string) {
			void super.rel;

			set(this, "href", value);
		}

		// [stringifier] on href, so it is the same getter under another name
		toString(): string {
			void super.rel;

			return hyperlinkHref(this);
		}

		@Type("DOMString")
		get target(): string {
			void super.rel;

			return reflect(this, "target");
		}

		@Type("DOMString")
		set target(value: string) {
			void super.rel;

			set(this, "target", value);
		}

		@Type("USVString")
		get origin(): string {
			void super.rel;

			return getPart(this, "origin", "");
		}

		@Type("USVString")
		get protocol(): string {
			void super.rel;

			return getPart(this, "protocol", ":");
		}

		@Type("USVString")
		set protocol(value: string) {
			void super.rel;

			setPart(this, "protocol", value);
		}

		@Type("USVString")
		get username(): string {
			void super.rel;

			return getPart(this, "username", "");
		}

		@Type("USVString")
		set username(value: string) {
			void super.rel;

			setPart(this, "username", value);
		}

		@Type("USVString")
		get password(): string {
			void super.rel;

			return getPart(this, "password", "");
		}

		@Type("USVString")
		set password(value: string) {
			void super.rel;

			setPart(this, "password", value);
		}

		@Type("USVString")
		get host(): string {
			void super.rel;

			return getPart(this, "host", "");
		}

		@Type("USVString")
		set host(value: string) {
			void super.rel;

			setPart(this, "host", value);
		}

		@Type("USVString")
		get hostname(): string {
			void super.rel;

			return getPart(this, "hostname", "");
		}

		@Type("USVString")
		set hostname(value: string) {
			void super.rel;

			setPart(this, "hostname", value);
		}

		@Type("USVString")
		get port(): string {
			void super.rel;

			return getPart(this, "port", "");
		}

		@Type("USVString")
		set port(value: string) {
			void super.rel;

			setPart(this, "port", value);
		}

		@Type("USVString")
		get pathname(): string {
			void super.rel;

			return getPart(this, "pathname", "");
		}

		@Type("USVString")
		set pathname(value: string) {
			void super.rel;

			setPart(this, "pathname", value);
		}

		@Type("USVString")
		get search(): string {
			void super.rel;

			return getPart(this, "search", "");
		}

		@Type("USVString")
		set search(value: string) {
			void super.rel;

			setPart(this, "search", value);
		}

		@Type("USVString")
		get hash(): string {
			void super.rel;

			return getPart(this, "hash", "");
		}

		@Type("USVString")
		set hash(value: string) {
			void super.rel;

			setPart(this, "hash", value);
		}
	});

	client.Intercept(class extends HTMLAreaElement {
		@Type("USVString")
		get href(): string {
			void super.rel;

			return hyperlinkHref(this);
		}

		@Type("USVString")
		set href(value: string) {
			void super.rel;

			set(this, "href", value);
		}

		toString(): string {
			void super.rel;

			return hyperlinkHref(this);
		}

		@Type("DOMString")
		get target(): string {
			void super.rel;

			return reflect(this, "target");
		}

		@Type("DOMString")
		set target(value: string) {
			void super.rel;

			set(this, "target", value);
		}

		@Type("USVString")
		get origin(): string {
			void super.rel;

			return getPart(this, "origin", "");
		}

		@Type("USVString")
		get protocol(): string {
			void super.rel;

			return getPart(this, "protocol", ":");
		}

		@Type("USVString")
		set protocol(value: string) {
			void super.rel;

			setPart(this, "protocol", value);
		}

		@Type("USVString")
		get username(): string {
			void super.rel;

			return getPart(this, "username", "");
		}

		@Type("USVString")
		set username(value: string) {
			void super.rel;

			setPart(this, "username", value);
		}

		@Type("USVString")
		get password(): string {
			void super.rel;

			return getPart(this, "password", "");
		}

		@Type("USVString")
		set password(value: string) {
			void super.rel;

			setPart(this, "password", value);
		}

		@Type("USVString")
		get host(): string {
			void super.rel;

			return getPart(this, "host", "");
		}

		@Type("USVString")
		set host(value: string) {
			void super.rel;

			setPart(this, "host", value);
		}

		@Type("USVString")
		get hostname(): string {
			void super.rel;

			return getPart(this, "hostname", "");
		}

		@Type("USVString")
		set hostname(value: string) {
			void super.rel;

			setPart(this, "hostname", value);
		}

		@Type("USVString")
		get port(): string {
			void super.rel;

			return getPart(this, "port", "");
		}

		@Type("USVString")
		set port(value: string) {
			void super.rel;

			setPart(this, "port", value);
		}

		@Type("USVString")
		get pathname(): string {
			void super.rel;

			return getPart(this, "pathname", "");
		}

		@Type("USVString")
		set pathname(value: string) {
			void super.rel;

			setPart(this, "pathname", value);
		}

		@Type("USVString")
		get search(): string {
			void super.rel;

			return getPart(this, "search", "");
		}

		@Type("USVString")
		set search(value: string) {
			void super.rel;

			setPart(this, "search", value);
		}

		@Type("USVString")
		get hash(): string {
			void super.rel;

			return getPart(this, "hash", "");
		}

		@Type("USVString")
		set hash(value: string) {
			void super.rel;

			setPart(this, "hash", value);
		}
	});

	// the document base URL, which every relative URL in the document is
	// resolved against - and which the base element does not take part in, by
	// its own algorithm
	client.Intercept(class extends HTMLBaseElement {
		// https://html.spec.whatwg.org/multipage/semantics.html#dom-base-href -
		// the attribute parsed against the fallback base URL. With no attribute
		// Blink answers the fallback base URL as it is, fragment and all, where
		// parsing "" against it would drop the fragment - and matching the
		// engine is the point
		@Type("USVString")
		get href(): string {
			void super.target;

			const value = attrs.get(this, "href");
			const fallback = fallbackBaseURL(this);
			if (value === null) return fallback;

			return resolve(this, value, fallback);
		}

		@Type("USVString")
		set href(value: string) {
			void super.target;

			set(this, "href", value);
		}

		@Type("DOMString")
		get target(): string {
			void super.target;

			return reflect(this, "target");
		}

		@Type("DOMString")
		set target(value: string) {
			void super.target;

			set(this, "target", value);
		}
	});

	// --- SVG ----------------------------------------------------------------

	/**
	 * Every interface that mixes in `SVGURIReference`, which is the only place
	 * an `SVGAnimatedString` reflects a URL.
	 *
	 * A loop rather than a class each: the getter is identical twelve times
	 * over, and half of these interfaces are missing from one engine or another
	 * - naming them in a class heritage would throw at module evaluation rather
	 * than being skipped.
	 */
	const SVG_URI_REFERENCES = [
		"SVGUseElement",
		"SVGImageElement",
		"SVGScriptElement",
		"SVGAElement",
		"SVGTextPathElement",
		"SVGPatternElement",
		// the linear and radial gradients inherit this one's href rather than
		// having their own, so naming them too would patch it three times
		"SVGGradientElement",
		"SVGFEImageElement",
		"SVGMPathElement",
		"SVGFilterElement",
	];

	for (const name of SVG_URI_REFERENCES) {
		client.Trap(`${name}.prototype.href`, {
			get(ctx) {
				const animated = ctx.get() as SVGAnimatedString;
				// [SameObject], so one recording answers for every later read.
				// the element is only ever stored, never read through, which is
				// what the rule below is there to stop
				// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
				if (animated) client.box.svgHrefs.set(animated, ctx.this);

				return animated;
			},
		});
	}

	/**
	 * The XLink `href` an SVG element's `href` falls back to, under whatever
	 * prefix it was set with - `p:href` in the XLink namespace is the same
	 * attribute as `xlink:href`. Null when the plain `href` is there to answer,
	 * or when there is no XLink one either.
	 *
	 * https://svgwg.org/svg2-draft/types.html#__svg__SVGURIReference__href
	 */
	const svgXlinkHref = (element: Element): Attr | null => {
		if (attrs.has(element, "href")) return null;

		return new client.native.Element(element).getAttributeNodeNS(
			XLINK_NAMESPACE,
			"href"
		);
	};

	/** The page's value for an SVG element's `href`, or null when unset. */
	const svgHref = (element: Element): string | null => {
		const xlink = svgXlinkHref(element);
		if (xlink) return attrs.visibleValue(xlink);

		return attrs.get(element, "href");
	};

	client.Intercept(class extends SVGAnimatedString {
		@Type("DOMString")
		get baseVal(): string {
			const native = super.baseVal;
			const owner = client.box.svgHrefs.get(this);
			// className and target are SVGAnimatedStrings too, and neither is a
			// URL - only the ones recorded above are
			if (!owner) return native;

			const value = svgHref(owner);

			return value === null ? native : value;
		}

		@Type("DOMString")
		set baseVal(value: string) {
			void super.baseVal;

			const owner = client.box.svgHrefs.get(this);
			if (!owner) {
				super.baseVal = value;

				return;
			}

			// the attribute the getter reads is the one written: an existing
			// XLink href keeps its prefix, and no plain one appears beside it
			const xlink = svgXlinkHref(owner);
			if (xlink) attrs.setVisibleValue(xlink, String(value));
			else attrs.set(owner, "href", String(value));
		}

		// no setter - an animated value is the animation's to write
		@Type("DOMString")
		get animVal(): string {
			const native = super.animVal;
			const owner = client.box.svgHrefs.get(this);
			if (!owner) return native;

			const value = svgHref(owner);

			return value === null ? native : value;
		}
	});

	// --- the document base URL ----------------------------------------------

	client.Intercept(class extends Node {
		@Type("USVString")
		get baseURI(): string {
			void super.baseURI;

			return baseURL(this as Node);
		}
	});
}
