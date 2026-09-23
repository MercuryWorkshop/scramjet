import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Differential cover for every member the element layer intercepts
// (`client/dom/{element,attr,node,reflect,markup,frames,fragments,css}.ts`),
// and for the typed OM / CSSOM paths `dom/css.ts` rewrites.
//
// Every value is compared against an unproxied browser, so nothing here states
// an expectation of its own: the bare harness is the oracle. What is
// snapshotted is everything a page can observe about a member without knowing
// what scramjet is:
//
//   - its shape: which prototype owns it and where in that prototype's key
//     order, its descriptor flags, and the name / length / source text /
//     constructability / own keys of each function
//   - its receiver checks: {}, null, undefined, the prototype, a bare
//     Object.create of it, and an instance of a neighbouring interface
//   - the order of the receiver check against argument conversion - Web IDL
//     brand-checks first, so an invalid receiver must run no page `toString`
//   - argument conversion, return values and the values read back afterwards
//
// The table-driven tests report one assertConsistent label per member, so a
// failure names the member that diverged.

type Members = Record<string, string[]>;

// `static x` marks a static operation. Every member listed is intercepted by
// the element layer, except where a comment says otherwise.
const MEMBERS: Members = {
	Element: [
		// dom/element.ts
		"hasAttributes",
		"getAttributeNames",
		"getAttribute",
		"getAttributeNS",
		"setAttribute",
		"setAttributeNS",
		"removeAttribute",
		"removeAttributeNS",
		"toggleAttribute",
		"hasAttribute",
		"hasAttributeNS",
		"getAttributeNode",
		"getAttributeNodeNS",
		"setAttributeNode",
		"setAttributeNodeNS",
		"removeAttributeNode",
		// dom/attr.ts
		"attributes",
		// dom/node.ts
		"append",
		"prepend",
		"replaceChildren",
		"after",
		"before",
		"replaceWith",
		"insertAdjacentText",
		"moveBefore",
		// dom/markup.ts
		"innerHTML",
		"outerHTML",
		"setHTMLUnsafe",
		"setHTML",
		"getHTML",
		"insertAdjacentHTML",
	],
	NamedNodeMap: [
		"length",
		"item",
		"getNamedItem",
		"getNamedItemNS",
		"setNamedItem",
		"setNamedItemNS",
		"removeNamedItem",
		"removeNamedItemNS",
	],
	Attr: ["name", "localName", "value"],
	Node: [
		"nodeValue",
		"nodeName",
		"textContent",
		"appendChild",
		"insertBefore",
		"replaceChild",
		"removeChild",
		"normalize",
		"baseURI",
	],
	CharacterData: [
		"data",
		"length",
		"substringData",
		"appendData",
		"insertData",
		"deleteData",
		"replaceData",
		"after",
		"before",
		"replaceWith",
		"remove",
	],
	Text: ["wholeText", "splitText"],
	HTMLElement: [
		"innerText",
		"outerText",
		"nonce",
		"style",
		"attributeStyleMap",
	],
	HTMLScriptElement: ["textContent", "innerText", "text", "src", "integrity"],
	HTMLImageElement: ["src", "srcset", "currentSrc", "lowsrc", "longDesc"],
	HTMLSourceElement: ["src", "srcset"],
	HTMLMediaElement: ["src", "currentSrc"],
	HTMLVideoElement: ["poster"],
	HTMLTrackElement: ["src"],
	HTMLIFrameElement: [
		"src",
		"srcdoc",
		"csp",
		"credentialless",
		"longDesc",
		"sandbox",
		"contentWindow",
		"contentDocument",
		"getSVGDocument",
	],
	DOMTokenList: [
		"add",
		"remove",
		"toggle",
		"replace",
		"value",
		// not intercepted, the neighbours a patch would disturb
		"contains",
		"supports",
		"item",
		"length",
		"toString",
	],
	HTMLFrameElement: ["src", "longDesc", "contentWindow", "contentDocument"],
	HTMLEmbedElement: ["src", "getSVGDocument"],
	HTMLObjectElement: [
		"data",
		"codeBase",
		"contentWindow",
		"contentDocument",
		"getSVGDocument",
	],
	HTMLLinkElement: ["href", "integrity", "imageSrcset"],
	HTMLFormElement: ["action", "target"],
	HTMLInputElement: ["src", "formAction"],
	HTMLButtonElement: ["formAction"],
	HTMLQuoteElement: ["cite"],
	HTMLModElement: ["cite"],
	SVGElement: ["nonce", "style", "attributeStyleMap"],
	MathMLElement: ["nonce", "style", "attributeStyleMap"],
	HTMLAnchorElement: [
		"href",
		"toString",
		"target",
		"origin",
		"protocol",
		"username",
		"password",
		"host",
		"hostname",
		"port",
		"pathname",
		"search",
		"hash",
	],
	HTMLAreaElement: [
		"href",
		"toString",
		"target",
		"origin",
		"protocol",
		"username",
		"password",
		"host",
		"hostname",
		"port",
		"pathname",
		"search",
		"hash",
	],
	HTMLBaseElement: ["href", "target"],
	// client.Trap, not client.Intercept - reflect.ts SVG_URI_REFERENCES
	SVGUseElement: ["href"],
	SVGImageElement: ["href"],
	SVGScriptElement: ["href"],
	SVGAElement: ["href"],
	SVGTextPathElement: ["href"],
	SVGPatternElement: ["href"],
	SVGGradientElement: ["href"],
	SVGFEImageElement: ["href"],
	SVGMPathElement: ["href"],
	SVGFilterElement: ["href"],
	SVGAnimatedString: ["baseVal", "animVal"],
	ShadowRoot: ["innerHTML", "setHTMLUnsafe", "setHTML", "getHTML"],
	DOMParser: ["parseFromString"],
	Range: ["createContextualFragment", "insertNode", "surroundContents"],
	CSSStyleDeclaration: [
		"getPropertyValue",
		"removeProperty",
		"setProperty",
		"cssText",
		// not intercepted
		"getPropertyPriority",
		"item",
		"length",
	],
	CSSStyleSheet: ["insertRule", "addRule", "replace", "replaceSync"],
	CSSRule: ["cssText"],
	CSSStyleValue: ["static parse", "static parseAll", "toString"],
	StylePropertyMap: ["set", "append", "delete", "clear"],
	StylePropertyMapReadOnly: ["get", "getAll", "has", "size"],
	CSSStyleRule: ["style"],
	CSSPageRule: ["style"],
	CSSMarginRule: ["style"],
	CSSNestedDeclarations: ["style"],
	CSSKeyframeRule: ["style"],
	CSSFontFaceRule: ["style"],
	CSSPositionTryRule: ["style"],
};

// An instance of a neighbouring interface: one that shares an ancestor with
// the member's owner but does not implement it.
const SVG_G = `document.createElementNS("http://www.w3.org/2000/svg", "g")`;
const MEDIA_RULE = `(() => { const s = new CSSStyleSheet(); s.replaceSync("@media all {}"); return s.cssRules[0]; })()`;
const FOREIGN: Record<string, string> = {
	Element: `document.createTextNode("t")`,
	NamedNodeMap: `document.createElement("div").classList`,
	Attr: `document.createTextNode("t")`,
	Node: `new EventTarget()`,
	CharacterData: `document.createElement("div")`,
	Text: `document.createComment("c")`,
	HTMLElement: SVG_G,
	HTMLAnchorElement: `document.createElement("area")`,
	HTMLAreaElement: `document.createElement("a")`,
	HTMLVideoElement: `document.createElement("audio")`,
	DOMTokenList: `document.createElement("div").attributes`,
	SVGElement: `document.createElement("div")`,
	MathMLElement: `document.createElement("div")`,
	SVGAnimatedString: `document.body`,
	ShadowRoot: `document.createDocumentFragment()`,
	DOMParser: `new XMLSerializer()`,
	Range: `new StaticRange({ startContainer: document.body, startOffset: 0, endContainer: document.body, endOffset: 0 })`,
	CSSStyleDeclaration: `document.body`,
	CSSStyleSheet: `document.body`,
	CSSRule: `document.body`,
	CSSStyleValue: `document.body`,
	StylePropertyMap: `document.body.computedStyleMap()`,
	StylePropertyMapReadOnly: `document.body`,
	CSSStyleRule: MEDIA_RULE,
	CSSPageRule: MEDIA_RULE,
	CSSMarginRule: MEDIA_RULE,
	CSSNestedDeclarations: MEDIA_RULE,
	CSSKeyframeRule: MEDIA_RULE,
	CSSFontFaceRule: MEDIA_RULE,
	CSSPositionTryRule: MEDIA_RULE,
};
const foreignFor = (iface: string) =>
	FOREIGN[iface] ??
	(iface.startsWith("SVG") ? SVG_G : `document.createElement("div")`);

// Browser-side helpers, prepended to every test.
const HELPERS = `
	const H = {
		norm(v) {
			if (typeof v === "string") {
				// the test server's port is picked per run
				if (v === location.port) return "PORT";
				return v
					.split(location.origin).join("ORIGIN")
					.split(location.host).join("HOST")
					.replace(/#runway_token=[^\\s"')]*/g, "#TOKEN");
			}
			if (Array.isArray(v)) return v.map(H.norm);
			if (v && typeof v === "object") {
				const o = {};
				for (const k of Object.keys(v)) o[k] = H.norm(v[k]);
				return o;
			}
			return v;
		},
		resolve(iface, key) {
			const C = self[iface];
			if (typeof C !== "function") return null;
			const isStatic = key.startsWith("static ");
			const k = isStatic ? key.slice(7) : key;
			let o = isStatic ? C : C.prototype;
			while (o) {
				const d = Object.getOwnPropertyDescriptor(o, k);
				if (d) return { C, o, d, k, isStatic };
				o = Object.getPrototypeOf(o);
			}
			return { C, o: null, d: null, k, isStatic };
		},
		label(o) {
			if (o === self) return "self";
			if (typeof o === "function") return "ctor:" + o.name;
			const own = Object.getOwnPropertyDescriptor(o, "constructor");
			return own && typeof own.value === "function" ? own.value.name + ".prototype" : "?";
		},
		fn(f) {
			if (typeof f !== "function") return typeof f;
			let construct;
			try { Reflect.construct(f, []); construct = "constructed"; }
			catch (e) { construct = e && e.name; }
			return {
				name: f.name,
				length: f.length,
				str: Function.prototype.toString.call(f),
				prototype: typeof f.prototype,
				hasOwnPrototype: Object.prototype.hasOwnProperty.call(f, "prototype"),
				construct,
				fnProto: Object.getPrototypeOf(f) === Function.prototype,
				keys: Reflect.ownKeys(f).map(String),
				tag: Object.prototype.toString.call(f),
			};
		},
		shape(iface, key) {
			const r = H.resolve(iface, key);
			if (!r) return "absent-interface";
			if (!r.d) return "absent";
			const names = Object.getOwnPropertyNames(r.o);
			return {
				owner: H.label(r.o),
				index: names.indexOf(r.k),
				ownCount: names.length,
				kind: "value" in r.d ? "data" : "accessor",
				enumerable: r.d.enumerable,
				configurable: r.d.configurable,
				writable: r.d.writable,
				get: r.d.get ? H.fn(r.d.get) : typeof r.d.get,
				set: r.d.set ? H.fn(r.d.set) : typeof r.d.set,
				value: "value" in r.d ? H.fn(r.d.value) : "none",
			};
		},
		err(f) {
			try {
				const v = f();
				if (v && typeof v.then === "function") {
					v.catch(() => {});
					return "ok:promise";
				}
				return "ok:" + (v === null ? "null" : typeof v);
			} catch (e) {
				return "throw:" + (e && e.name);
			}
		},
		// the same, settling a promise: a promise-returning operation rejects
		// for a bad receiver rather than throwing
		async errAsync(f) {
			let v;
			try { v = f(); }
			catch (e) { return "throw:" + (e && e.name); }
			if (v && typeof v.then === "function") {
				try { await v; return "resolved"; }
				catch (e) { return "rejected:" + (e && e.name); }
			}
			return "ok:" + (v === null ? "null" : typeof v);
		},
		// the returned value, or the error's name
		v(f) {
			try { return { v: f() }; }
			catch (e) { return { e: e && e.name }; }
		},
		async va(f) {
			try { return { v: await f() }; }
			catch (e) { return { e: e && e.name }; }
		},
		// an argument whose conversion is counted, and logged under tag
		counter() {
			const c = { n: 0, log: [] };
			c.arg = (ret = "x", tag = "") => ({
				toString() { c.n++; c.log.push(tag + ":s"); return ret; },
				valueOf() { c.n++; c.log.push(tag + ":v"); return ret; },
			});
			return c;
		},
		svg(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); },
		math(tag) { return document.createElementNS("http://www.w3.org/1998/Math/MathML", tag); },
		wait(target, events, ms = 3000) {
			return new Promise((resolve) => {
				const t = setTimeout(() => resolve("TIMEOUT"), ms);
				for (const e of events) target.addEventListener(e, () => { clearTimeout(t); resolve(e); }, { once: true });
			});
		},
	};
`;

/** One test, one label. */
const differential = (name: string, js: string) =>
	basicTest({
		name: `elshape-${name}`,
		js: `
			${HELPERS}
			const snapshot = async () => {
				try { return { value: H.norm(await (${js})) }; }
				catch (error) { return { error: error && error.name }; }
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

/** One test, one label per entry - so a failure names the entry. */
const grouped = (
	name: string,
	setup: string,
	entries: [label: string, expr: string][]
) =>
	basicTest({
		name: `elshape-${name}`,
		js: `
			${HELPERS}
			${setup}
			const entries = [
				${entries
					.map(
						([label, expr]) =>
							`[${JSON.stringify(label)}, async () => (${expr})]`
					)
					.join(",\n")}
			];
			for (const [label, run] of entries) {
				let result;
				try { result = { value: H.norm(await run()) }; }
				catch (error) { result = { error: error && error.name }; }
				assertConsistent(label, result);
			}
		`,
	});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const q = (s: string) => JSON.stringify(s);

// --- shape, receiver checks, conversion order ---------------------------

// One test per interface, three labels per member:
//
//   shape:    where the member lives and what its functions look like
//   recv:     what each half does when called on a receiver that is not an
//             instance - every one of them a TypeError natively
//   order:    how many page conversions ran before that TypeError.
//             https://webidl.spec.whatwg.org/#dfn-create-operation-function
//             brand-checks the receiver (step 2) before converting any
//             argument (step 4), so natively this is always zero
const memberTests = Object.entries(MEMBERS).map(([iface, keys]) =>
	grouped(
		`members-${slug(iface)}`,
		`
			const receivers = {
				empty: () => ({}),
				nul: () => null,
				undef: () => undefined,
				proto: () => self[${q(iface)}].prototype,
				created: () => Object.create(self[${q(iface)}].prototype),
				foreign: () => ${foreignFor(iface)},
			};
			const probeReceivers = async (key) => {
				const r = H.resolve(${q(iface)}, key);
				if (!r) return "absent-interface";
				if (!r.d) return "absent";
				// a static ignores its receiver, so it gets arguments that work
				const args = r.isStatic ? ["color", "red"] : ["x", "x", "x"];
				const out = {};
				for (const [rn, mk] of Object.entries(receivers)) {
					for (const part of ["get", "set", "value"]) {
						const f = r.d[part];
						if (typeof f !== "function") continue;
						out[rn + "." + part] = await H.errAsync(() =>
							part === "get" ? f.call(mk())
							: part === "set" ? f.call(mk(), "x")
							: f.call(mk(), ...args));
					}
				}
				return out;
			};
			const probeOrder = async (key) => {
				const r = H.resolve(${q(iface)}, key);
				if (!r) return "absent-interface";
				if (!r.d) return "absent";
				if (r.isStatic) return "static";
				const out = {};
				for (const rn of ["empty", "nul", "foreign"]) {
					for (const part of ["set", "value"]) {
						const f = r.d[part];
						if (typeof f !== "function") continue;
						const c = H.counter();
						const result = await H.errAsync(() =>
							part === "set" ? f.call(receivers[rn](), c.arg())
							: f.call(receivers[rn](), c.arg(), c.arg(), c.arg()));
						out[rn + "." + part] = { result, conversions: c.n };
					}
				}
				return out;
			};
		`,
		[
			[
				`keys:${iface}`,
				`typeof self[${q(iface)}] !== "function" ? "absent-interface" : {
					proto: Object.getOwnPropertyNames(self[${q(iface)}].prototype),
					statics: Object.getOwnPropertyNames(self[${q(iface)}]),
					symbols: Object.getOwnPropertySymbols(self[${q(iface)}].prototype).map(String),
				}`,
			],
			...keys.flatMap((key): [string, string][] => [
				[`shape:${iface}.${key}`, `H.shape(${q(iface)}, ${q(key)})`],
				[`recv:${iface}.${key}`, `probeReceivers(${q(key)})`],
				[`order:${iface}.${key}`, `probeOrder(${q(key)})`],
			]),
		]
	)
);

// --- Element: attributes by name ----------------------------------------

const XLINK = "http://www.w3.org/1999/xlink";

const elementTests = [
	differential(
		"setattribute-tostring-once",
		`(() => {
			const el = document.createElement("div");
			const c = H.counter();
			const r = el.setAttribute(c.arg("data-a", "name"), c.arg("/v.png", "value"));
			return { r: String(r), n: c.n, log: c.log, attr: el.getAttribute("data-a"), names: el.getAttributeNames() };
		})()`
	),

	differential(
		"setattribute-url-tostring-once",
		`(() => {
			const img = document.createElement("img");
			const c = H.counter();
			img.setAttribute(c.arg("src", "name"), c.arg("/i.png?a#b", "value"));
			return { n: c.n, log: c.log, attr: img.getAttribute("src"), src: img.src, html: img.outerHTML };
		})()`
	),

	differential(
		"setattribute-value-types",
		`(() => {
			const el = document.createElement("div");
			el.setAttribute("a", null);
			el.setAttribute("b", undefined);
			el.setAttribute("c", 1.5);
			el.setAttribute("d", true);
			el.setAttribute("e", [1, 2]);
			el.setAttribute("f", "");
			return { names: el.getAttributeNames(), values: el.getAttributeNames().map((n) => el.getAttribute(n)), html: el.outerHTML };
		})()`
	),

	differential(
		"setattribute-argument-errors",
		`(() => {
			const el = document.createElement("div");
			return {
				none: H.err(() => el.setAttribute()),
				one: H.err(() => el.setAttribute("a")),
				symName: H.err(() => el.setAttribute(Symbol("s"), "v")),
				symValue: H.err(() => el.setAttribute("a", Symbol("s"))),
				throwing: H.err(() => el.setAttribute({ toString() { throw new RangeError("page"); } }, "v")),
				after: el.getAttributeNames(),
			};
		})()`
	),

	differential(
		"attribute-name-validity",
		`(() => {
			const names = ["", "a b", "a>b", "1a", "a=b", "a/b", "a\\u0000b", "-a", "a:b", ":a", "\\u00e9", "a\\tb", "<a", "a\\"b", "a'b"];
			return names.map((n) => {
				const el = document.createElement("div");
				return [
					H.err(() => el.setAttribute(n, "v")),
					H.err(() => el.toggleAttribute(n)),
					H.err(() => el.getAttribute(n)),
					H.err(() => el.removeAttribute(n)),
					H.err(() => el.setAttributeNS(null, n, "v")),
					el.getAttributeNames(),
				];
			});
		})()`
	),

	differential(
		"attribute-name-case",
		`(() => {
			const div = document.createElement("div");
			div.setAttribute("DATA-X", "1");
			div.setAttribute("SRC", "/u");
			const svg = H.svg("svg");
			svg.setAttribute("viewBox", "0 0 1 1");
			svg.setAttribute("DATA-Y", "2");
			return {
				div: [div.getAttributeNames(), div.getAttribute("data-x"), div.getAttribute("DATA-X"), div.hasAttribute("Data-X"), div.getAttributeNode("SRC") && div.getAttributeNode("SRC").name],
				svg: [svg.getAttributeNames(), svg.getAttribute("viewbox"), svg.getAttribute("viewBox"), svg.getAttribute("data-y"), svg.getAttribute("DATA-Y")],
				toggled: [div.toggleAttribute("HIDDEN"), div.getAttributeNames()],
				removed: [div.removeAttribute("Data-X"), div.getAttributeNames()],
			};
		})()`
	),

	differential(
		"setattributens-namespaces",
		`(() => {
			const el = document.createElement("div");
			el.setAttributeNS(null, "a", "1");
			el.setAttributeNS(undefined, "b", "2");
			el.setAttributeNS("", "c", "3");
			el.setAttributeNS("urn:x", "p:d", "4");
			el.setAttributeNS(${q(XLINK)}, "xlink:href", "/u?x");
			el.setAttributeNS(null, "src", "/s.png");
			return {
				attrs: [...el.attributes].map((a) => [a.namespaceURI, a.prefix, a.localName, a.name, a.value]),
				get: [el.getAttributeNS(null, "a"), el.getAttributeNS("", "c"), el.getAttributeNS(undefined, "b"), el.getAttributeNS("urn:x", "d"), el.getAttributeNS("urn:x", "p:d")],
				xlink: [el.getAttribute("xlink:href"), el.getAttributeNS(${q(XLINK)}, "href"), el.hasAttributeNS(${q(XLINK)}, "href"), el.hasAttributeNS(null, "xlink:href")],
				node: [el.getAttributeNodeNS("urn:x", "d") && el.getAttributeNodeNS("urn:x", "d").name, el.getAttributeNodeNS(null, "zz")],
				src: [el.getAttributeNS(null, "src"), el.getAttribute("src")],
				html: el.outerHTML,
			};
		})()`
	),

	differential(
		"setattributens-errors-and-counts",
		`(() => {
			const el = document.createElement("div");
			const c = H.counter();
			const r = el.setAttributeNS(c.arg("urn:x", "ns"), c.arg("p:q", "qname"), c.arg("/v", "value"));
			return {
				r: String(r), n: c.n, log: c.log, value: el.getAttributeNS("urn:x", "q"),
				prefixNoNs: H.err(() => el.setAttributeNS(null, "p:a", "1")),
				xmlnsWrongNs: H.err(() => el.setAttributeNS("urn:x", "xmlns", "1")),
				xmlPrefix: H.err(() => el.setAttributeNS("urn:x", "xml:a", "1")),
				badName: H.err(() => el.setAttributeNS(null, "1a", "")),
				twoColons: H.err(() => el.setAttributeNS("urn:x", "a:b:c", "")),
				none: H.err(() => el.setAttributeNS()),
				two: H.err(() => el.setAttributeNS(null, "a")),
				sym: H.err(() => el.setAttributeNS(null, "a", Symbol())),
				after: el.getAttributeNames(),
			};
		})()`
	),

	differential(
		"removeattributens",
		`(() => {
			const el = document.createElement("div");
			el.setAttributeNS("urn:x", "p:a", "1");
			el.setAttributeNS(null, "b", "2");
			el.setAttribute("src", "/s");
			const out = [];
			out.push(el.removeAttributeNS("urn:x", "p:a"), el.getAttributeNames());
			out.push(el.removeAttributeNS("urn:x", "a"), el.getAttributeNames());
			out.push(el.removeAttributeNS(null, "b"), el.getAttributeNames());
			out.push(el.removeAttributeNS("", "src"), el.getAttributeNames());
			out.push(H.err(() => el.removeAttributeNS(null)), H.err(() => el.removeAttributeNS()));
			return out;
		})()`
	),

	differential(
		"toggleattribute-force",
		`(() => {
			const el = document.createElement("div");
			const seq = [];
			const step = (...args) => { seq.push([el.toggleAttribute(...args), el.hasAttribute("t"), el.getAttribute("t")]); };
			step("t"); step("t");
			step("t", 0); step("t", 1); step("t", 1); step("t", ""); step("t", {}); step("t", undefined);
			step("t", undefined); step("t", null); step("t", "false"); step("t", NaN);
			const c = H.counter();
			const counted = [el.toggleAttribute(c.arg("u", "name"), c.arg("", "force")), c.n, c.log];
			return { seq, counted, none: H.err(() => el.toggleAttribute()), html: el.outerHTML };
		})()`
	),

	differential(
		"attribute-queries-counts",
		`(() => {
			const el = document.createElement("div");
			el.setAttribute("a", "1");
			const c = H.counter();
			const out = [
				el.getAttribute(c.arg("a")),
				el.hasAttribute(c.arg("a")),
				el.getAttributeNode(c.arg("a")) && "node",
				el.getAttributeNS(c.arg("", "ns"), c.arg("a", "local")),
				el.hasAttributeNS(null, c.arg("a")),
				el.removeAttribute(c.arg("zz")),
				el.hasAttributes(1, 2),
				el.getAttributeNames(1),
			];
			return {
				out, n: c.n, log: c.log,
				missing: [H.err(() => el.getAttribute()), H.err(() => el.hasAttribute()), H.err(() => el.getAttributeNS(null)), H.err(() => el.getAttributeNode()), H.err(() => el.removeAttribute())],
				nullName: [el.getAttribute(null), el.hasAttribute(undefined)],
			};
		})()`
	),

	differential(
		"attribute-node-identity",
		`(() => {
			const el = document.createElement("div");
			const a = document.createAttribute("title");
			a.value = "v1";
			const r1 = el.setAttributeNode(a);
			const b = document.createAttribute("title");
			b.value = "v2";
			const r2 = el.setAttributeNode(b);
			const same = el.setAttributeNode(b);
			const other = document.createElement("div");
			const out = {
				r1, r2IsA: r2 === a, sameIsNull: same, aOwner: a.ownerElement, bOwner: b.ownerElement === el,
				getNode: el.getAttributeNode("title") === b, mapNode: el.attributes.title === b, item: el.attributes.item(0) === b,
				value: el.getAttribute("title"),
				inUse: H.err(() => other.setAttributeNode(b)),
				notAttr: H.err(() => el.setAttributeNode({})),
				nul: H.err(() => el.setAttributeNode(null)),
				none: H.err(() => el.setAttributeNode()),
				nsNull: H.err(() => el.setAttributeNodeNS(null)),
			};
			const removed = el.removeAttributeNode(b);
			out.removedIsB = removed === b;
			out.bOwnerAfter = b.ownerElement;
			out.notFound = H.err(() => el.removeAttributeNode(b));
			out.removeNone = H.err(() => el.removeAttributeNode());
			const ns = document.createAttributeNS("urn:x", "p:t");
			out.ns = [el.setAttributeNodeNS(ns), el.getAttributeNames(), el.attributes.length];
			out.after = el.getAttributeNames();
			return out;
		})()`
	),

	differential(
		"attribute-node-url",
		`(() => {
			const img = document.createElement("img");
			const a = document.createAttribute("src");
			a.value = "/one.png";
			img.setAttributeNode(a);
			const first = [img.getAttribute("src"), a.value, img.src, img.attributes.src.value, a.nodeValue, a.textContent, img.outerHTML];
			a.value = "/two.png";
			const second = [img.getAttribute("src"), a.value, img.src, img.outerHTML];
			a.nodeValue = "/three.png";
			const third = [img.getAttribute("src"), img.src];
			a.textContent = "/four.png";
			const fourth = [img.getAttribute("src"), img.src];
			const detached = img.removeAttributeNode(a);
			return { first, second, third, fourth, detached: [detached.value, img.src, img.getAttribute("src")] };
		})()`
	),

	differential(
		"attr-members",
		`(() => {
			const el = document.createElement("div");
			el.setAttributeNS("urn:x", "p:loc", "1");
			el.setAttribute("href", "/h");
			const a = el.getAttributeNodeNS("urn:x", "loc");
			const h = el.getAttributeNode("href");
			const c = H.counter();
			h.value = c.arg("/counted");
			const nul = document.createAttribute("n");
			nul.value = null;
			return {
				a: [a.name, a.localName, a.prefix, a.namespaceURI, a.nodeName, a.value],
				h: [h.name, h.localName, h.value, h.nodeName, el.getAttribute("href"), c.n],
				nul: nul.value,
				spec: [h.specified, h.ownerElement === el],
			};
		})()`
	),

	differential(
		"namednodemap-conversions",
		`(() => {
			const el = document.createElement("div");
			el.setAttribute("a", "1");
			el.setAttribute("src", "/s");
			const m = el.attributes;
			const c = H.counter();
			const name = (x) => (x ? x.name : x);
			return {
				item: [name(m.item(-1)), name(m.item(2 ** 32)), name(m.item(2 ** 32 + 1)), name(m.item(NaN)), name(m.item("1")), name(m.item(1.9)), name(m.item(c.arg(1)))],
				n: c.n,
				errs: [H.err(() => m.item()), H.err(() => m.getNamedItem()), H.err(() => m.removeNamedItem("nope")), H.err(() => m.removeNamedItemNS(null, "nope")), H.err(() => m.setNamedItem("a")), H.err(() => m.setNamedItem(null))],
				named: [name(m.getNamedItem("a")), name(m.getNamedItem("A")), name(m.getNamedItem("zz")), name(m.getNamedItemNS(null, "src")), name(m.getNamedItemNS("", "a")), name(m.getNamedItemNS("urn:x", "a"))],
				length: m.length,
				keys: Object.keys(m),
				names: Object.getOwnPropertyNames(m),
				has: ["0" in m, "1" in m, "2" in m, "a" in m, "src" in m, "length" in m, "zz" in m],
				idx: [m[0] === m.item(0), m.a === m.getNamedItem("a"), m[2], m.zz],
				descs: [Object.getOwnPropertyDescriptor(m, "0"), Object.getOwnPropertyDescriptor(m, "a") && Object.keys(Object.getOwnPropertyDescriptor(m, "a"))],
				iter: [...m].map((x) => x.name + "=" + x.value),
				tag: Object.prototype.toString.call(m),
				same: el.attributes === el.attributes,
				proto: Object.getPrototypeOf(m) === NamedNodeMap.prototype,
				inst: m instanceof NamedNodeMap,
				methodIdentity: m.getNamedItem === NamedNodeMap.prototype.getNamedItem,
				protoCall: NamedNodeMap.prototype.item.call(m, 0) === m[0],
				lengthCall: Object.getOwnPropertyDescriptor(NamedNodeMap.prototype, "length").get.call(m),
			};
		})()`
	),

	differential(
		"namednodemap-mutators",
		`(() => {
			const el = document.createElement("div");
			el.setAttribute("title", "t1");
			const m = el.attributes;
			const old = m.getNamedItem("title");
			const fresh = document.createAttribute("title");
			fresh.value = "t2";
			const r1 = m.setNamedItem(fresh);
			const img = document.createAttribute("src");
			img.value = "/p.png";
			const r2 = m.setNamedItem(img);
			const nsAttr = document.createAttributeNS("urn:x", "p:k");
			const r3 = m.setNamedItemNS(nsAttr);
			const removed = m.removeNamedItem("TITLE");
			const removedNs = m.removeNamedItemNS("urn:x", "k");
			return {
				r1IsOld: r1 === old, r2, r3, removedIsFresh: removed === fresh, removedNs: removedNs === nsAttr,
				after: [...m].map((a) => a.name + "=" + a.value), attr: el.getAttribute("src"), html: el.outerHTML,
				inUse: H.err(() => document.createElement("p").attributes.setNamedItem(img)),
			};
		})()`
	),
];

// --- Node, CharacterData, Text ------------------------------------------

const nodeTests = [
	differential(
		"legacy-null-to-empty",
		`(() => {
			const div = document.createElement("div");
			div.textContent = "x"; div.textContent = null;
			const t = document.createTextNode("x");
			t.nodeValue = null;
			const t2 = document.createTextNode("x");
			t2.data = null;
			const t3 = document.createTextNode("x");
			t3.textContent = null;
			const el = document.createElement("div");
			el.nodeValue = "ignored";
			const inner = document.createElement("div");
			inner.innerHTML = "<b>x</b>"; inner.innerHTML = null;
			const it = document.createElement("div");
			it.innerText = null;
			const script = document.createElement("script");
			script.textContent = null;
			const s2 = document.createElement("script");
			s2.text = null;
			const s3 = document.createElement("script");
			s3.innerText = null;
			const style = document.createElement("style");
			style.textContent = null;
			const attr = document.createAttribute("a");
			attr.nodeValue = null;
			const attr2 = document.createAttribute("a");
			attr2.textContent = null;
			const attr3 = document.createAttribute("a");
			attr3.value = null;
			return {
				div: [div.textContent, div.childNodes.length], t: t.data, t2: t2.data, t3: t3.data, el: [el.nodeValue, el.childNodes.length],
				inner: [inner.innerHTML, inner.childNodes.length], it: it.innerHTML,
				script: [script.textContent, script.childNodes.length], s2: [s2.text, s2.textContent], s3: s3.textContent, style: style.textContent,
				attrs: [attr.value, attr2.value, attr3.value],
			};
		})()`
	),

	differential(
		"textcontent-tostring-once",
		`(() => {
			const targets = {
				div: document.createElement("div"),
				text: document.createTextNode("x"),
				comment: document.createComment("x"),
				attr: document.createAttribute("a"),
				script: document.createElement("script"),
				style: document.createElement("style"),
				fragment: document.createDocumentFragment(),
			};
			const out = {};
			for (const [k, node] of Object.entries(targets)) {
				const c = H.counter();
				node.textContent = c.arg("v");
				const c2 = H.counter();
				node.nodeValue = c2.arg("w");
				out[k] = [c.n, c2.n, node.textContent, node.nodeValue];
			}
			return out;
		})()`
	),

	differential(
		"node-insertion-returns",
		`(() => {
			const p = document.createElement("div");
			const a = document.createElement("a"), b = document.createElement("b"), i = document.createElement("i");
			const out = {
				append: p.appendChild(a) === a,
				insertNull: p.insertBefore(b, null) === b,
				insertUndef: p.insertBefore(i, undefined) === i,
				order: [...p.childNodes].map((n) => n.nodeName),
				replace: p.replaceChild(document.createElement("u"), a) === a,
				remove: p.removeChild(b) === b,
				order2: [...p.childNodes].map((n) => n.nodeName),
			};
			const frag = document.createDocumentFragment();
			frag.append("t1", document.createElement("s"));
			out.fragReturn = p.appendChild(frag) === frag;
			out.fragEmpty = frag.childNodes.length;
			out.errs = {
				appendNone: H.err(() => p.appendChild()),
				appendString: H.err(() => p.appendChild("x")),
				appendNull: H.err(() => p.appendChild(null)),
				insertOne: H.err(() => p.insertBefore(document.createElement("x"))),
				insertNotChild: H.err(() => p.insertBefore(document.createElement("x"), document.createElement("y"))),
				replaceOne: H.err(() => p.replaceChild(document.createElement("x"))),
				replaceNotChild: H.err(() => p.replaceChild(document.createElement("x"), document.createElement("y"))),
				removeOrphan: H.err(() => p.removeChild(document.createElement("x"))),
				removeNone: H.err(() => p.removeChild()),
				ancestor: H.err(() => i.appendChild(p)),
				self: H.err(() => p.appendChild(p)),
				doc: H.err(() => p.appendChild(document)),
				textParent: H.err(() => document.createTextNode("t").appendChild(document.createElement("x"))),
				doctype: H.err(() => p.appendChild(document.implementation.createDocumentType("html", "", ""))),
			};
			out.normalize = (() => { const d = document.createElement("div"); d.append("a", "b", "", "c"); const r = d.normalize(); return [r, d.childNodes.length, d.textContent]; })();
			return out;
		})()`
	),

	differential(
		"node-insertion-into-script",
		`(() => {
			const s = document.createElement("script");
			s.type = "text/plain";
			const t1 = document.createTextNode("var a = 1;");
			const t2 = document.createTextNode("var b = location.href;");
			const out = [s.appendChild(t1) === t1, s.insertBefore(t2, t1) === t2, s.textContent, s.text, s.innerHTML, s.childNodes.length];
			out.push(s.replaceChild(document.createTextNode("var c;"), t2) === t2, t2.data, s.textContent);
			out.push(s.removeChild(t1) === t1, t1.data, s.textContent);
			s.append("x1;", "x2;");
			out.push(s.textContent, s.childNodes.length);
			s.normalize();
			out.push(s.textContent, s.childNodes.length, s.firstChild.data, s.firstChild.length);
			out.push(H.err(() => s.appendChild("x")), H.err(() => s.removeChild(document.createTextNode("x"))));
			return out;
		})()`
	),

	differential(
		"parentnode-variadic",
		`(() => {
			const p = document.createElement("div");
			const c = H.counter();
			const out = {};
			out.append = [p.append("a", c.arg("b"), document.createElement("i")), c.n, p.innerHTML];
			out.prepend = [p.prepend(c.arg("z"), null, undefined, 1), c.n, p.innerHTML];
			out.replaceChildren = [p.replaceChildren(c.arg("r"), "s"), c.n, p.innerHTML, p.childNodes.length];
			const child = p.firstChild;
			out.after = [child.after(c.arg("A")), c.n, p.innerHTML];
			out.before = [child.before(c.arg("B")), c.n, p.innerHTML];
			out.replaceWith = [child.replaceWith(c.arg("W")), c.n, p.innerHTML];
			const orphan = document.createElement("span");
			out.orphan = [orphan.after("x"), orphan.before("y"), orphan.replaceWith("z"), c.n];
			const e = document.createElement("em");
			p.append(e);
			out.elAfter = [e.after(c.arg("E")), e.before(c.arg("F")), c.n, p.innerHTML];
			out.errs = [H.err(() => p.append(Symbol())), H.err(() => p.prepend(Symbol())), H.err(() => p.replaceChildren(p)), H.err(() => e.after(Symbol())), H.err(() => e.replaceWith(p))];
			out.empty = [p.append(), p.prepend(), p.childNodes.length];
			return out;
		})()`
	),

	differential(
		"characterdata-variadic",
		`(() => {
			const p = document.createElement("div");
			const t = document.createTextNode("t");
			p.append(t);
			const c = H.counter();
			const out = [t.after(c.arg("A"), "B"), t.before(c.arg("C")), c.n, p.innerHTML];
			out.push(t.replaceWith(c.arg("R")), c.n, p.innerHTML, t.parentNode);
			const t2 = p.firstChild;
			out.push(t2.remove(), p.innerHTML, t2.parentNode, t2.remove());
			out.push(H.err(() => p.firstChild.after(Symbol())));
			const com = document.createComment("c");
			p.append(com);
			out.push(com.after("x"), com.replaceWith("y"), p.innerHTML);
			return out;
		})()`
	),

	differential(
		"insertadjacenttext",
		`(() => {
			const wrap = document.createElement("div");
			const el = document.createElement("p");
			wrap.append(el);
			const c = H.counter();
			const out = [];
			for (const pos of ["beforebegin", "afterbegin", "beforeend", "afterend", "BeforeEnd", "AFTERBEGIN"]) {
				out.push(el.insertAdjacentText(pos, pos));
			}
			out.push(wrap.innerHTML);
			out.push(el.insertAdjacentText(c.arg("beforeend", "pos"), c.arg("counted", "data")), c.n, c.log, el.innerHTML);
			const orphan = document.createElement("p");
			out.push(orphan.insertAdjacentText("beforebegin", "x"), orphan.insertAdjacentText("afterend", "x"), orphan.innerHTML);
			out.push(H.err(() => el.insertAdjacentText("middle", "x")), H.err(() => el.insertAdjacentText("beforeend")), H.err(() => el.insertAdjacentText()), H.err(() => el.insertAdjacentText("beforeend", Symbol())));
			const s = document.createElement("script");
			s.type = "text/plain";
			s.insertAdjacentText("beforeend", "var x = 1;");
			s.insertAdjacentText("afterbegin", "var y = 2;");
			out.push(s.textContent, s.childNodes.length);
			return out;
		})()`
	),

	...(["div", "script"] as const).map((host) =>
		differential(
			`characterdata-offsets-${host}`,
			`(() => {
				const host = document.createElement(${q(host)});
				if (${q(host)} === "script") host.type = "text/plain";
				const t = document.createTextNode("abcdef");
				host.append(t);
				const reset = () => { t.data = "abcdef"; };
				const c = H.counter();
				const sub = [
					H.v(() => t.substringData(-1, 1)),
					H.v(() => t.substringData(2 ** 32 + 1, 2)),
					H.v(() => t.substringData(NaN, 2)),
					H.v(() => t.substringData("3", 2)),
					H.v(() => t.substringData(1, -1)),
					H.v(() => t.substringData(7, 1)),
					H.v(() => t.substringData(6, 1)),
					H.v(() => t.substringData(Infinity, 1)),
					H.v(() => t.substringData(1.9, 2.9)),
					H.v(() => t.substringData(c.arg(1, "off"), c.arg(2, "count"))),
					H.v(() => t.substringData(1)),
					H.v(() => t.substringData()),
					H.v(() => t.substringData(Symbol(), 1)),
				];
				const n1 = [c.n, c.log];
				const mut = [];
				const step = (f) => { reset(); mut.push([H.v(f), t.data, t.length]); };
				step(() => t.appendData(null));
				step(() => t.appendData(c.arg("Z")));
				step(() => t.appendData());
				step(() => t.insertData(-1, "x"));
				step(() => t.insertData(2 ** 32 + 2, "x"));
				step(() => t.insertData(6, "x"));
				step(() => t.insertData(7, "x"));
				step(() => t.insertData(c.arg(1, "off"), c.arg("Q", "data")));
				step(() => t.insertData(1));
				step(() => t.deleteData(1, 2 ** 32 + 1));
				step(() => t.deleteData(1, -1));
				step(() => t.deleteData(9, 1));
				step(() => t.deleteData(c.arg(0, "off"), c.arg(2, "count")));
				step(() => t.replaceData(0, -1, "Z"));
				step(() => t.replaceData(2, 2, "__"));
				step(() => t.replaceData(7, 0, "x"));
				step(() => t.replaceData(c.arg(1, "off"), c.arg(1, "count"), c.arg("R", "data")));
				step(() => t.replaceData(1, 1));
				return { sub, n1, mut, n: c.n, log: c.log, text: host.textContent };
			})()`
		)
	),

	...(["div", "script"] as const).map((host) =>
		differential(
			`text-splittext-${host}`,
			`(() => {
				const host = document.createElement(${q(host)});
				if (${q(host)} === "script") host.type = "text/plain";
				const t = document.createTextNode("abcdef");
				host.append(t, "ghi");
				const out = [];
				out.push(H.v(() => t.splitText(-1)));
				const c = H.counter();
				const n = t.splitText(c.arg(2));
				out.push(c.n, n === t.nextSibling, t.data, n.data, n.parentNode === host, t.wholeText, n.wholeText, host.childNodes.length);
				const n2 = t.splitText(2 ** 32 + 1);
				out.push(t.data, n2.data, n2 === t.nextSibling);
				out.push(H.v(() => t.splitText(9)), H.v(() => t.splitText()), t.splitText(1).data);
				out.push(t.length, n.length, host.textContent);
				const orphan = document.createTextNode("xy");
				const o2 = orphan.splitText(1);
				out.push(orphan.data, o2.data, o2.parentNode, orphan.wholeText);
				return out;
			})()`
		)
	),

	differential(
		"innertext-outertext",
		`(() => {
			const wrap = document.createElement("div");
			const el = document.createElement("p");
			wrap.append(el);
			const c = H.counter();
			el.innerText = c.arg("a\\nb");
			const inner = [c.n, el.innerHTML, el.innerText];
			const child = document.createElement("i");
			el.append(child);
			child.outerText = c.arg("o\\np");
			const outer = [c.n, el.innerHTML, child.parentNode];
			const orphan = document.createElement("i");
			const s = document.createElement("script");
			s.type = "text/plain";
			s.innerText = c.arg("var a = 1;");
			const sc = [c.n, s.innerText, s.outerText, s.textContent, s.innerHTML];
			const sChild = document.createElement("b");
			return {
				inner, outer, sc,
				orphanOuter: H.err(() => { orphan.outerText = "x"; }),
				outerGet: [el.outerText, wrap.outerText],
				scriptChild: H.v(() => { s.append(sChild); sChild.outerText = "var q;"; return [s.textContent, s.childNodes.length]; }),
			};
		})()`
	),

	differential(
		"script-text-members",
		`(() => {
			const s = document.createElement("script");
			s.type = "text/plain";
			const c = H.counter();
			const out = [];
			s.text = c.arg("var a = location.href;");
			out.push(c.n, s.text, s.textContent, s.innerText, s.innerHTML, s.childNodes.length);
			s.textContent = c.arg("import('/x.js');");
			out.push(c.n, s.text, s.textContent, s.firstChild.data, s.firstChild.nodeValue, s.firstChild.length);
			s.innerText = c.arg("postMessage(1, '*');");
			out.push(c.n, s.text, s.innerHTML, s.outerHTML);
			s.text = undefined;
			out.push(s.text);
			return out;
		})()`
	),
];

// --- markup -------------------------------------------------------------

const markupTests = [
	differential(
		"insertadjacenthtml-args",
		`(() => {
			const wrap = document.createElement("div");
			const el = document.createElement("p");
			wrap.append(el);
			const c = H.counter();
			const out = [];
			out.push(el.insertAdjacentHTML(c.arg("BeforeEnd", "pos"), c.arg("<img src='/a.png'>", "html")), c.n, c.log);
			for (const pos of ["beforebegin", "afterbegin", "afterend"]) out.push(el.insertAdjacentHTML(pos, "<a href='rel/" + pos + "'>x</a>"));
			out.push(wrap.innerHTML, el.querySelector("img").src, wrap.querySelector("a").href);
			const orphan = document.createElement("p");
			out.push(H.err(() => orphan.insertAdjacentHTML("beforebegin", "x")), H.err(() => orphan.insertAdjacentHTML("afterend", "x")), orphan.insertAdjacentHTML("afterbegin", "<b>in</b>"), orphan.innerHTML);
			out.push(H.err(() => el.insertAdjacentHTML("middle", "x")), H.err(() => el.insertAdjacentHTML("beforeend")), H.err(() => el.insertAdjacentHTML()), H.err(() => el.insertAdjacentHTML("beforeend", Symbol())));
			out.push(el.insertAdjacentHTML("beforeend", null), el.insertAdjacentHTML("beforeend", undefined), el.innerHTML);
			return out;
		})()`
	),

	differential(
		"innerhtml-url-roundtrip",
		`(() => {
			const el = document.createElement("div");
			const c = H.counter();
			el.innerHTML = c.arg('<img src="/a.png" srcset="/b.png 2x"><a href="rel?x#y">t</a><div style="background:url(/c.png)"></div><form action="/f"></form><iframe src="/fr" sandbox="allow-forms"></iframe><script src="/s.js" integrity="sha256-x" nonce="n1"></script>');
			const img = el.querySelector("img"), a = el.querySelector("a"), div = el.querySelector("div"), form = el.querySelector("form"), iframe = el.querySelector("iframe"), script = el.querySelector("script");
			return {
				n: c.n,
				inner: el.innerHTML,
				outer: el.outerHTML,
				img: [img.getAttribute("src"), img.src, img.srcset, img.outerHTML],
				a: [a.getAttribute("href"), a.href, a.pathname, a.search, a.hash],
				div: [div.getAttribute("style"), div.style.backgroundImage, div.style.cssText, div.outerHTML],
				form: [form.getAttribute("action"), form.action],
				iframe: [iframe.getAttribute("src"), iframe.src, iframe.getAttribute("sandbox"), iframe.sandbox.value],
				script: [script.getAttribute("src"), script.src, script.integrity, script.getAttribute("integrity"), script.nonce, script.getAttribute("nonce"), script.hasAttribute("nonce")],
				getHTML: typeof el.getHTML === "function" ? el.getHTML() : "absent",
			};
		})()`
	),

	differential(
		"outerhtml-args",
		`(() => {
			const wrap = document.createElement("div");
			const el = document.createElement("p");
			wrap.append(el);
			const c = H.counter();
			el.outerHTML = c.arg("<img src='/o.png'><b>x</b>");
			const out = [c.n, wrap.innerHTML, wrap.firstChild.src, el.parentNode];
			const orphan = document.createElement("p");
			out.push(H.err(() => { orphan.outerHTML = "<i></i>"; }), orphan.outerHTML);
			const b = wrap.querySelector("b");
			b.outerHTML = null;
			out.push(wrap.innerHTML);
			const svg = H.svg("svg");
			const g = H.svg("g");
			svg.append(g);
			g.outerHTML = "<image href='/i.svg'></image><style>a{}</style>";
			out.push(svg.innerHTML, svg.firstChild.namespaceURI, svg.lastChild && svg.lastChild.namespaceURI);
			return out;
		})()`
	),

	differential(
		"gethtml-sethtml",
		`(() => {
			const el = document.createElement("div");
			const out = {};
			if (typeof el.setHTMLUnsafe === "function") {
				const c = H.counter();
				out.unsafe = [el.setHTMLUnsafe(c.arg("<img src='/u.png'><a href='x'>a</a>")), c.n, el.innerHTML, el.getHTML(), el.firstChild.src];
				out.unsafeErr = [H.err(() => el.setHTMLUnsafe()), H.err(() => el.setHTMLUnsafe(Symbol())), H.err(() => el.setHTMLUnsafe("x", 1))];
			}
			if (typeof el.getHTML === "function") {
				const host = document.createElement("div");
				host.attachShadow({ mode: "open", serializable: true }).innerHTML = "<img src='/sh.png'>";
				host.append(document.createElement("i"));
				out.getHTML = [el.getHTML(), host.getHTML(), host.getHTML({ serializableShadowRoots: true }), H.err(() => host.getHTML(1)), host.getHTML(undefined)];
			}
			if (typeof el.setHTML === "function") {
				const c = H.counter();
				out.safe = [H.v(() => el.setHTML(c.arg("<script>x()</script><img src='/s.png' onerror='x()'><b>ok</b>"))), c.n, el.innerHTML];
				out.safeErr = [H.err(() => el.setHTML()), H.err(() => el.setHTML(Symbol()))];
				const s = document.createElement("style");
				out.safeStyle = [H.v(() => s.setHTML("a{background:url(/x.png)}")), s.textContent];
			}
			return out;
		})()`
	),

	differential(
		"shadowroot-markup",
		`(() => {
			const host = document.createElement("div");
			const sr = host.attachShadow({ mode: "open", serializable: true });
			const c = H.counter();
			sr.innerHTML = c.arg("<img src='/a.png'><a href='rel'>x</a>");
			const out = [c.n, sr.innerHTML, sr.querySelector("img").src, sr.querySelector("a").href];
			sr.innerHTML = null;
			out.push(sr.innerHTML, sr.childNodes.length);
			if (typeof sr.setHTMLUnsafe === "function") out.push(sr.setHTMLUnsafe("<img src='/b.png'>"), sr.innerHTML, H.err(() => sr.setHTMLUnsafe()));
			if (typeof sr.getHTML === "function") out.push(sr.getHTML(), H.err(() => sr.getHTML(1)));
			if (typeof sr.setHTML === "function") out.push(H.v(() => sr.setHTML("<script>x</script><b>b</b>")), sr.innerHTML);
			const svgHost = H.svg("svg");
			return out;
		})()`
	),

	differential(
		"domparser-args",
		`(() => {
			const p = new DOMParser();
			const c = H.counter();
			const doc = p.parseFromString(c.arg("<img src='/d.png'><a href='rel'>x</a>", "string"), c.arg("text/html", "type"));
			return {
				n: c.n,
				log: c.log,
				body: doc.body.innerHTML,
				img: doc.querySelector("img").getAttribute("src"),
				url: doc.URL,
				bogus: H.err(() => p.parseFromString("<p>", "bogus/type")),
				bogusCount: (() => { const c2 = H.counter(); H.err(() => p.parseFromString(c2.arg("<p>", "string"), c2.arg("bogus", "type"))); return [c2.n, c2.log]; })(),
				none: H.err(() => p.parseFromString()),
				one: H.err(() => p.parseFromString("<p>")),
				xml: (() => { const x = p.parseFromString("<r><i href='/x'/></r>", "application/xml"); return [x.documentElement.outerHTML, x.contentType]; })(),
				svg: (() => { const x = p.parseFromString("<svg xmlns='http://www.w3.org/2000/svg'><image href='/i.png'/></svg>", "image/svg+xml"); return [x.documentElement.outerHTML, x.contentType]; })(),
				xhtml: (() => { const x = p.parseFromString("<html xmlns='http://www.w3.org/1999/xhtml'><body><img src='/x.png'/></body></html>", "application/xhtml+xml"); return [x.documentElement.outerHTML, x.contentType]; })(),
			};
		})()`
	),

	differential(
		"range-members",
		`(() => {
			const host = document.createElement("div");
			host.innerHTML = "<p>one</p><p>two</p>";
			document.body.append(host);
			const r = document.createRange();
			r.selectNodeContents(host.firstChild);
			const c = H.counter();
			const frag = r.createContextualFragment(c.arg("<img src='/r.png'><b>b</b>"));
			const out = { n: c.n, frag: [frag instanceof DocumentFragment, frag.childNodes.length, frag.firstChild.getAttribute("src"), frag.firstChild.src] };
			out.fragErr = [H.err(() => r.createContextualFragment()), H.err(() => r.createContextualFragment(Symbol()))];
			const i = document.createElement("i");
			out.insert = [r.insertNode(i), host.innerHTML, H.err(() => r.insertNode("x")), H.err(() => r.insertNode()), H.err(() => r.insertNode(document))];
			const r2 = document.createRange();
			r2.setStart(host.firstChild.lastChild, 1);
			r2.setEnd(host.lastChild.firstChild, 1);
			out.surroundPartial = H.err(() => r2.surroundContents(document.createElement("u")));
			const r3 = document.createRange();
			r3.setStart(host.lastChild.firstChild, 0);
			r3.setEnd(host.lastChild.firstChild, 2);
			const u = document.createElement("u");
			out.surround = [r3.surroundContents(u), host.innerHTML, r3.toString(), H.err(() => r3.surroundContents()), H.err(() => r3.surroundContents(document))];
			const s = document.createElement("script");
			s.type = "text/plain";
			s.textContent = "var abc = 1;";
			const r4 = document.createRange();
			r4.setStart(s.firstChild, 4);
			out.intoScript = [H.v(() => r4.insertNode(document.createTextNode("Q"))), s.textContent, s.childNodes.length];
			host.remove();
			return out;
		})()`
	),

	differential(
		"trusted-types-sinks",
		`(() => {
			if (typeof trustedTypes === "undefined") return "absent";
			const pol = trustedTypes.createPolicy("elshape-" + Math.random(), { createHTML: (s) => s, createScript: (s) => s, createScriptURL: (s) => s });
			const html = pol.createHTML("<img src='/t.png'>");
			const scr = pol.createScript("var t = 1;");
			const url = pol.createScriptURL("/t.js");
			const div = document.createElement("div");
			div.innerHTML = html;
			const out = { inner: [div.innerHTML, div.firstChild.src] };
			div.setAttribute("title", html);
			div.setAttribute("data-s", scr);
			div.setAttributeNS(null, "data-u", url);
			out.attrs = [div.getAttribute("title"), div.getAttribute("data-s"), div.getAttribute("data-u")];
			const s = document.createElement("script");
			s.type = "text/plain";
			s.src = url;
			s.text = scr;
			out.script = [s.src, s.getAttribute("src"), s.text];
			s.textContent = scr;
			s.innerText = scr;
			out.script2 = [s.textContent, s.innerText];
			const iframe = document.createElement("iframe");
			iframe.srcdoc = html;
			out.srcdoc = [iframe.srcdoc, iframe.getAttribute("srcdoc")];
			div.insertAdjacentHTML("beforeend", html);
			out.adjacent = div.innerHTML;
			out.parsed = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
			out.fragment = document.createRange().createContextualFragment(html).firstChild.getAttribute("src");
			if (typeof div.setHTMLUnsafe === "function") { div.setHTMLUnsafe(html); out.unsafe = div.innerHTML; }
			const sr = document.createElement("div").attachShadow({ mode: "open" });
			sr.innerHTML = html;
			out.shadow = sr.innerHTML;
			const c = document.createElement("div");
			c.outerHTML;
			return out;
		})()`
	),
];

// --- reflected IDL attributes -------------------------------------------

// [tag (namespace-prefixed for svg/math), IDL name, content attribute, setter value]
const REFLECTED: [string, string, string, string][] = [
	["img", "src", "src", "rel/p?q#h"],
	["img", "srcset", "srcset", "rel/a.png 2x, /b.png 3x"],
	["img", "lowsrc", "lowsrc", "rel/low"],
	["img", "longDesc", "longdesc", "rel/long"],
	["source", "src", "src", "rel/src"],
	["source", "srcset", "srcset", "rel/s.png 1x"],
	["audio", "src", "src", "rel/a.mp3"],
	["video", "src", "src", "rel/v.mp4"],
	["video", "poster", "poster", "rel/poster.png"],
	["track", "src", "src", "rel/t.vtt"],
	["iframe", "src", "src", "rel/f"],
	["iframe", "srcdoc", "srcdoc", "<img src='/sd.png'>"],
	["iframe", "csp", "csp", "script-src 'none'"],
	["iframe", "longDesc", "longdesc", "rel/ld"],
	["frame", "src", "src", "rel/frame"],
	["frame", "longDesc", "longdesc", "rel/fld"],
	["embed", "src", "src", "rel/e.swf"],
	["object", "data", "data", "rel/o.bin"],
	["object", "codeBase", "codebase", "rel/cb/"],
	["script", "src", "src", "rel/s.js"],
	["script", "integrity", "integrity", "sha384-abc"],
	["link", "href", "href", "rel/l.css"],
	["link", "integrity", "integrity", "sha256-def"],
	["link", "imageSrcset", "imagesrcset", "rel/i.png 2x"],
	["form", "action", "action", "rel/submit?x=1"],
	["form", "target", "target", "_blank"],
	["input", "src", "src", "rel/in.png"],
	["input", "formAction", "formaction", "rel/fa"],
	["button", "formAction", "formaction", "rel/ba"],
	["q", "cite", "cite", "rel/q"],
	["blockquote", "cite", "cite", "rel/bq"],
	["del", "cite", "cite", "rel/del"],
	["ins", "cite", "cite", "rel/ins"],
	["a", "href", "href", "rel/a?x#y"],
	["a", "target", "target", "_top"],
	["area", "href", "href", "rel/area"],
	["area", "target", "target", "frame1"],
	["base", "target", "target", "_self"],
	["div", "nonce", "nonce", "n-div"],
	["script", "nonce", "nonce", "n-script"],
	["style", "nonce", "nonce", "n-style"],
	["svg:script", "nonce", "nonce", "n-svg"],
	["math:math", "nonce", "nonce", "n-math"],
];

const makeEl = (tag: string) =>
	tag.startsWith("svg:")
		? `H.svg(${q(tag.slice(4))})`
		: tag.startsWith("math:")
			? `H.math(${q(tag.slice(5))})`
			: `document.createElement(${q(tag)})`;

const reflectTests = [
	grouped(
		"reflect-roundtrip",
		"",
		REFLECTED.map(([tag, prop, attr, value]): [string, string] => [
			`${tag}.${prop}`,
			`(() => {
				const fresh = ${makeEl(tag)};
				const absent = [fresh[${q(prop)}], fresh.getAttribute(${q(attr)})];
				const el = ${makeEl(tag)};
				const c = H.counter();
				el[${q(prop)}] = c.arg(${q(value)});
				const set = [c.n, el[${q(prop)}], el.getAttribute(${q(attr)}), el.hasAttribute(${q(attr)}), el.outerHTML];
				el.setAttribute(${q(attr)}, "/via-attr");
				const viaAttr = [el[${q(prop)}], el.getAttribute(${q(attr)})];
				el.removeAttribute(${q(attr)});
				const removed = [el[${q(prop)}], el.getAttribute(${q(attr)})];
				el[${q(prop)}] = "";
				const empty = [el[${q(prop)}], el.getAttribute(${q(attr)})];
				el[${q(prop)}] = null;
				const nul = [el[${q(prop)}], el.getAttribute(${q(attr)})];
				const sym = H.err(() => { el[${q(prop)}] = Symbol(); });
				return { absent, set, viaAttr, removed, empty, nul, sym };
			})()`,
		])
	),

	differential(
		"reflect-absolute-and-odd-urls",
		`(() => {
			const vals = ["https://example.com/x?y#z", "//cdn.example/p", "data:text/plain,hi", "javascript:void(0)", "blob:" + location.origin + "/abc", "http://[::1", " /spaced ", "about:blank", "#frag", "?q", "", ".", "\\u00e9/\\ud800"];
			return vals.map((v) => {
				const img = document.createElement("img");
				img.src = v;
				const a = document.createElement("a");
				a.href = v;
				const f = document.createElement("form");
				f.action = v;
				return [img.src, img.getAttribute("src"), a.href, a.getAttribute("href"), a.protocol, a.host, a.origin, a.pathname, String(a), f.action];
			});
		})()`
	),

	differential(
		"iframe-reflected-members",
		`(() => {
			const f = document.createElement("iframe");
			const c = H.counter();
			f.srcdoc = c.arg("<p>x</p>");
			f.csp = c.arg("default-src 'self'");
			const out = [c.n, f.srcdoc, f.getAttribute("srcdoc"), f.csp, f.getAttribute("csp"), f.outerHTML];
			const creds = [];
			for (const v of [1, 0, "x", "", {}, null]) { f.credentialless = v; creds.push([f.credentialless, f.getAttribute("credentialless")]); }
			f.setAttribute("credentialless", "false");
			creds.push(f.credentialless);
			out.push(creds);
			return out;
		})()`
	),

	differential(
		"nonce-slot",
		`(() => {
			const make = [() => document.createElement("div"), () => document.createElement("script"), () => H.svg("svg"), () => H.math("math")];
			return make.map((mk) => {
				const el = mk();
				const out = [el.nonce];
				el.setAttribute("nonce", "abc");
				out.push(el.nonce, el.getAttribute("nonce"), el.hasAttribute("nonce"));
				el.nonce = "def";
				out.push(el.nonce, el.getAttribute("nonce"), el.outerHTML);
				el.removeAttribute("nonce");
				out.push(el.nonce, el.getAttribute("nonce"));
				el.nonce = null;
				out.push(el.nonce);
				const parsed = document.createElement("div");
				parsed.innerHTML = "<p nonce='pn'></p>";
				out.push(parsed.firstChild.nonce, parsed.firstChild.getAttribute("nonce"), parsed.innerHTML);
				return out;
			});
		})()`
	),

	differential(
		"submit-target-defaults",
		`(() => {
			const form = document.createElement("form");
			const input = document.createElement("input");
			const button = document.createElement("button");
			const out = [form.action, input.formAction, button.formAction];
			form.action = "";
			input.formAction = "";
			out.push(form.action, form.getAttribute("action"), input.formAction);
			document.body.append(form);
			out.push(form.action);
			form.remove();
			const doc = document.implementation.createHTMLDocument("x");
			const f2 = doc.createElement("form");
			out.push(f2.action, doc.createElement("a").href, doc.createElement("base").href);
			return out;
		})()`
	),

	differential(
		"hyperlink-decomposition",
		`(() => {
			const out = {};
			for (const tag of ["a", "area"]) {
				const a = document.createElement(tag);
				const parts = ["href", "origin", "protocol", "username", "password", "host", "hostname", "port", "pathname", "search", "hash"];
				const read = () => parts.map((p) => a[p]).concat([String(a), a.toString(), a.getAttribute("href")]);
				const r = { empty: read() };
				a.protocol = "https:"; a.host = "x.example"; a.pathname = "p";
				r.noHrefSet = read();
				a.href = "https://user:pw@example.com:8080/p/q?s=1#h";
				r.full = read();
				const c = H.counter();
				const setters = [["protocol", "http"], ["username", "u2"], ["password", "p2"], ["host", "h.example:81"], ["hostname", "h2.example"], ["port", "99"], ["pathname", "/np"], ["search", "k=v"], ["hash", "frag"], ["port", ""], ["search", ""], ["hash", ""], ["protocol", "bogus scheme"], ["host", ""], ["port", "abc"], ["pathname", "a b"]];
				r.steps = setters.map(([p, v]) => { a[p] = c.arg(v); return [p, a.href]; });
				r.n = c.n;
				a.href = "/relative?x#y";
				r.relative = read();
				r.relHostIsSite = [a.host === location.host, a.origin === location.origin];
				a.href = "mailto:x@y.z";
				r.mailto = read();
				a.host = "nope";
				r.mailtoHost = a.href;
				a.href = "http://[::1";
				r.invalid = read();
				a.pathname = "/x";
				r.invalidSet = a.getAttribute("href");
				out[tag] = r;
			}
			return out;
		})()`
	),

	differential(
		"base-element-resolution",
		`(() => {
			const out = [];
			const base = document.createElement("base");
			out.push(base.href, base.target);
			base.href = "/sub/dir/";
			out.push(base.href, base.getAttribute("href"));
			document.head.append(base);
			const img = document.createElement("img");
			img.src = "rel.png";
			const a = document.createElement("a");
			a.href = "rel?x";
			out.push(img.src, a.href, document.baseURI, document.body.baseURI, img.baseURI, base.href);
			base.href = "https://example.com/elsewhere/";
			out.push(img.src, a.href, a.origin, document.baseURI, base.href);
			base.href = "../up/";
			out.push(base.href, img.src, document.baseURI);
			const second = document.createElement("base");
			second.href = "/second/";
			document.head.append(second);
			out.push(img.src, second.href);
			second.remove();
			base.removeAttribute("href");
			out.push(base.href, img.src, document.baseURI);
			base.remove();
			out.push(img.src, a.href, document.baseURI);
			return out;
		})()`
	),

	differential(
		"baseuri-nodes",
		`(() => {
			const t = document.createTextNode("t");
			const attr = document.createAttribute("a");
			const frag = document.createDocumentFragment();
			const doc = document.implementation.createHTMLDocument("x");
			const xml = document.implementation.createDocument(null, "r");
			document.body.append(t);
			const out = [document.baseURI, document.body.baseURI, t.baseURI, attr.baseURI, frag.baseURI, document.createElement("p").baseURI, doc.baseURI, doc.body.baseURI, xml.baseURI, document.documentElement.baseURI];
			t.remove();
			return out;
		})()`
	),

	differential(
		"svg-href",
		`(() => {
			const out = {};
			for (const tag of ["use", "image", "a", "script", "pattern", "linearGradient", "radialGradient", "feImage", "filter", "textPath", "mpath"]) {
				const el = H.svg(tag);
				const h = el.href;
				const r = [h === el.href, Object.prototype.toString.call(h), h.baseVal, h.animVal];
				const c = H.counter();
				h.baseVal = c.arg("/sprite.svg#i");
				r.push(c.n, h.baseVal, h.animVal, el.getAttribute("href"), el.outerHTML);
				const x = H.svg(tag);
				x.setAttributeNS(${q(XLINK)}, "xlink:href", "/x.svg#x");
				r.push(x.href.baseVal, x.href.animVal, x.getAttribute("xlink:href"));
				x.href.baseVal = "/y.svg";
				r.push(x.getAttribute("href"), x.getAttribute("xlink:href"), x.outerHTML);
				out[tag] = r;
			}
			const svg = H.svg("svg");
			svg.className.baseVal = "cls";
			out.className = [svg.className.baseVal, svg.getAttribute("class"), svg.className.animVal];
			const a = H.svg("a");
			a.target.baseVal = "_blank";
			out.target = [a.target.baseVal, a.getAttribute("target")];
			return out;
		})()`
	),

	differential(
		"currentsrc",
		`(async () => {
			const img = document.createElement("img");
			const out = [img.currentSrc];
			img.src = "/elshape-missing.png";
			out.push(await H.wait(img, ["load", "error"]), img.currentSrc, img.src);
			const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
			const img2 = document.createElement("img");
			img2.src = gif;
			out.push(await H.wait(img2, ["load", "error"]), img2.currentSrc === gif, img2.complete);
			const v = document.createElement("video");
			out.push(v.currentSrc);
			return out;
		})()`
	),
];

// --- frames -------------------------------------------------------------

const frameTests = [
	differential(
		"frame-accessors-detached",
		`(() => {
			const f = document.createElement("iframe");
			const o = document.createElement("object");
			const e = document.createElement("embed");
			const fr = document.createElement("frame");
			return [f.contentWindow, f.contentDocument, f.getSVGDocument(), o.contentWindow, o.contentDocument, o.getSVGDocument(), e.getSVGDocument(), fr.contentWindow, fr.contentDocument, "contentWindow" in e];
		})()`
	),

	differential(
		"frame-accessors-attached",
		`(async () => {
			const f = document.createElement("iframe");
			document.body.append(f);
			const w = f.contentWindow;
			const out = [w === f.contentWindow, f.contentDocument === w.document, f.contentDocument.URL, w.location.href, f.getSVGDocument(), w.parent === window, w.frameElement === f, window[window.length - 1] === w];
			f.srcdoc = "<p>x</p>";
			out.push(await H.wait(f, ["load"]));
			out.push(f.contentDocument.body.innerHTML, f.contentWindow.location.href, f.contentDocument.baseURI);
			const img = f.contentDocument.createElement("img");
			img.src = "rel.png";
			out.push(img.src);
			f.remove();
			out.push(f.contentWindow, f.contentDocument);
			return out;
		})()`
	),
];

// --- DOMTokenList -------------------------------------------------------

const tokenListTests = [
	differential(
		"classlist-returns-and-errors",
		`(() => {
			const el = document.createElement("div");
			const cl = el.classList;
			const out = {};
			out.add = [cl.add("a", "b"), cl.add(), cl.value, el.className];
			out.toggle = [cl.toggle("c"), cl.toggle("c"), cl.toggle("a", 0), cl.toggle("a", 1), cl.toggle("z", undefined), cl.toggle("z", null), cl.value];
			out.replace = [cl.replace("a", "q"), cl.replace("nope", "x"), cl.replace("q", "q"), cl.value];
			out.remove = [cl.remove("b", "nope"), cl.remove(), cl.value];
			out.errors = [
				H.err(() => cl.add("")), H.err(() => cl.add("a b")), H.err(() => cl.add("a\\tb")), H.err(() => cl.remove("")), H.err(() => cl.remove(" ")),
				H.err(() => cl.toggle("")), H.err(() => cl.toggle(" x")), H.err(() => cl.toggle()), H.err(() => cl.replace("", "b")), H.err(() => cl.replace("a", " ")),
				H.err(() => cl.replace("a")), H.err(() => cl.replace()), H.err(() => cl.contains()), H.err(() => cl.supports("x")), H.err(() => cl.add(Symbol())),
				H.err(() => cl.replace("", " ")),
			];
			el.setAttribute("class", "  x  y x ");
			out.parse = [cl.length, cl.value, cl.toString(), String(cl), cl.item(0), cl.item(1), cl.item(9), cl.item(-1), cl[0], cl[1], cl[2], [...cl], [...cl.keys()], [...cl.values()], [...cl.entries()], Object.keys(cl), JSON.stringify(cl)];
			const each = [];
			cl.forEach((v, i, list) => each.push([v, i, list === cl]));
			out.each = each;
			out.dedupe = [cl.add("x"), el.getAttribute("class")];
			cl.value = "m  n";
			out.value = [cl.value, el.className, cl.length];
			cl.value = null;
			out.valueNull = [cl.value, el.getAttribute("class")];
			out.same = [el.classList === cl, Object.getPrototypeOf(cl) === DOMTokenList.prototype, Object.prototype.toString.call(cl)];
			el.classList = "via putforwards";
			out.putForwards = [cl.value, el.className, el.classList === cl];
			return out;
		})()`
	),

	differential(
		"classlist-conversion-counts",
		`(() => {
			const el = document.createElement("div");
			const cl = el.classList;
			const c = H.counter();
			cl.add(c.arg("a", "add1"), c.arg("b", "add2"));
			const n1 = c.n;
			const t = cl.toggle(c.arg("c", "tok"), c.arg("", "force"));
			const n2 = c.n;
			const r = cl.replace(c.arg("a", "old"), c.arg("d", "new"));
			const n3 = c.n;
			cl.remove(c.arg("b", "rm"));
			const n4 = c.n;
			cl.value = c.arg("v1 v2", "value");
			const has = cl.contains(c.arg("v1", "has"));
			return { counts: [n1, n2, n3, n4, c.n], log: c.log, t, r, has, value: cl.value };
		})()`
	),

	differential(
		"rellist-supports",
		`(() => {
			const link = document.createElement("link");
			const a = document.createElement("a");
			const area = document.createElement("area");
			const form = document.createElement("form");
			const out = [];
			for (const t of ["stylesheet", "STYLESHEET", "preload", "modulepreload", "noopener", "noreferrer", "bogus", "", "icon", "prefetch", "opener"]) {
				out.push([t, H.v(() => link.relList.supports(t)), H.v(() => a.relList.supports(t)), H.v(() => area.relList.supports(t)), H.v(() => form.relList.supports(t))]);
			}
			link.relList.add("preload", "stylesheet");
			a.relList.value = "noopener";
			out.push(link.getAttribute("rel"), link.rel, a.rel, a.getAttribute("rel"), link.relList === link.relList, H.err(() => link.relList.supports()));
			return out;
		})()`
	),

	differential(
		"iframe-sandbox-list",
		`(() => {
			const f = document.createElement("iframe");
			const s = f.sandbox;
			const out = {};
			out.initial = [s.value, s.length, f.hasAttribute("sandbox"), f.getAttribute("sandbox"), s === f.sandbox, Object.getPrototypeOf(s) === DOMTokenList.prototype];
			out.supports = ["allow-scripts", "allow-same-origin", "allow-forms", "allow-popups-to-escape-sandbox", "allow-top-navigation-by-user-activation", "allow-downloads", "allow-bogus", "ALLOW-SCRIPTS", ""].map((t) => H.v(() => s.supports(t)));
			out.add = [s.add("allow-forms", "allow-scripts"), s.value, s.length, f.getAttribute("sandbox"), f.hasAttribute("sandbox"), f.outerHTML];
			out.toggle = [s.toggle("allow-modals"), s.toggle("allow-forms"), s.toggle("allow-popups", false), s.value, f.getAttribute("sandbox")];
			out.replace = [s.replace("allow-scripts", "allow-same-origin"), s.replace("nope", "x"), s.value, f.getAttribute("sandbox")];
			out.remove = [s.remove("allow-modals"), s.value, f.getAttribute("sandbox")];
			s.value = "allow-downloads  allow-downloads";
			out.value = [s.value, s.length, f.getAttribute("sandbox"), [...s], s[0], s.item(1), s.contains("allow-downloads")];
			f.sandbox = "allow-popups";
			out.putForwards = [s.value, f.sandbox === s, f.getAttribute("sandbox"), f.outerHTML];
			f.setAttribute("sandbox", "allow-same-origin allow-forms");
			out.live = [s.value, s.length, s.contains("allow-forms"), [...s]];
			f.removeAttribute("sandbox");
			out.removed = [s.value, s.length, f.hasAttribute("sandbox"), f.outerHTML];
			f.setAttribute("sandbox", "");
			out.emptyAttr = [s.value, s.length, f.hasAttribute("sandbox"), f.getAttribute("sandbox")];
			DOMTokenList.prototype.add.call(f.sandbox, "allow-orientation-lock");
			out.protoCall = [s.value, f.getAttribute("sandbox")];
			Object.getOwnPropertyDescriptor(DOMTokenList.prototype, "value").set.call(s, "allow-pointer-lock");
			out.protoValue = [s.value, f.getAttribute("sandbox")];
			out.errors = [H.err(() => s.add("")), H.err(() => s.add("a b")), H.err(() => s.replace("", "x")), H.err(() => s.toggle(" "))];
			out.afterErrors = [s.value, f.getAttribute("sandbox")];
			const holder = document.createElement("div");
			holder.innerHTML = "<iframe sandbox='allow-forms allow-scripts'></iframe>";
			const parsed = holder.firstChild;
			out.parsed = [parsed.sandbox.value, parsed.sandbox.length, parsed.getAttribute("sandbox"), holder.innerHTML];
			parsed.sandbox.remove("allow-scripts");
			out.parsedRemove = [parsed.sandbox.value, parsed.getAttribute("sandbox"), holder.innerHTML];
			const f2 = document.createElement("iframe");
			f2.setAttribute("sandbox", "allow-modals");
			out.attrFirst = [f2.sandbox.value, f2.sandbox.contains("allow-modals")];
			return out;
		})()`
	),
];

// --- CSSOM --------------------------------------------------------------

const cssTests = [
	differential(
		"style-mirror-sync",
		`(() => {
			const el = document.createElement("div");
			const snap = () => [el.getAttribute("style"), el.style.cssText, el.attributes.style && el.attributes.style.value, el.getAttributeNode("style") && el.getAttributeNode("style").value, el.outerHTML];
			const out = [];
			el.setAttribute("style", "color: red; background-image: url(/a.png)");
			out.push(snap(), el.style.backgroundImage, el.style.getPropertyValue("background-image"));
			el.style.color = "blue";
			out.push(snap());
			el.style.setProperty("background-image", 'url("/b.png")');
			out.push(snap(), el.style.backgroundImage);
			out.push(el.style.removeProperty("color"), snap());
			out.push(el.style.removeProperty("background-image"), snap());
			el.style.cssText = "margin: 1px; background: url('/c.png') no-repeat";
			out.push(snap(), el.style.background, el.style.backgroundImage);
			el.style = "padding: 2px; list-style-image: url(/d.png)";
			out.push(snap(), el.style.listStyleImage);
			el.style.cssText = "";
			out.push(snap(), el.hasAttribute("style"));
			el.removeAttribute("style");
			out.push(snap(), el.hasAttribute("style"));
			el.style.backgroundImage = "url(/e.png)";
			out.push(snap(), el.hasAttribute("style"));
			el.style["background-image"] = "url(/f.png)";
			out.push(snap());
			el.style.webkitMaskImage = "url(/g.png)";
			out.push(snap(), el.style.webkitMaskImage, el.style.WebkitMaskImage);
			return out;
		})()`
	),

	differential(
		"style-url-quoting",
		`(() => {
			const vals = ['url("/a b.png")', "url('/q\\\\'x.png')", "url(/p\\\\(1\\\\).png)", 'url("data:image/png;base64,AAAA")', 'url("https://example.com/x.png")', 'url("#frag")', 'url("")', "url()", 'image-set("/i.png" 1x, url(/j.png) 2x)', 'url("rel/k.png"), url(/l.png)', "linear-gradient(red, blue), url(/m.png)", 'url("\\\\2f n.png")', "URL(/upper.png)", "url(  /ws.png  )"];
			return vals.map((v) => {
				const el = document.createElement("div");
				el.style.setProperty("background-image", v);
				const a = [el.style.getPropertyValue("background-image"), el.style.backgroundImage, el.style.cssText, el.getAttribute("style")];
				const el2 = document.createElement("div");
				el2.style.backgroundImage = v;
				const b = [el2.style.backgroundImage, el2.getAttribute("style")];
				const el3 = document.createElement("div");
				el3.setAttribute("style", "background-image: " + v);
				const c = [el3.style.backgroundImage, el3.getAttribute("style"), el3.style.cssText];
				return [v, a, b, c];
			});
		})()`
	),

	differential(
		"style-declaration-object",
		`(() => {
			const el = document.createElement("div");
			const st = el.style;
			st.backgroundImage = 'url("/d.png")';
			const desc = Object.getOwnPropertyDescriptor(st, "backgroundImage");
			const dashed = Object.getOwnPropertyDescriptor(st, "background-image");
			return {
				same: el.style === st,
				proto: Object.getPrototypeOf(st) === CSSStyleDeclaration.prototype,
				inst: st instanceof CSSStyleDeclaration,
				tag: Object.prototype.toString.call(st),
				desc, dashed,
				idx: [st[0], st.length, st.item(0), Object.getOwnPropertyDescriptor(st, "0")],
				keysLen: Object.keys(st).length,
				ownLen: Reflect.ownKeys(st).length,
				has: ["backgroundImage" in st, "background-image" in st, Object.hasOwn(st, "color"), "setProperty" in st, Object.hasOwn(st, "setProperty")],
				methodIdentity: [st.setProperty === CSSStyleDeclaration.prototype.setProperty, st.getPropertyValue === CSSStyleDeclaration.prototype.getPropertyValue, st.item === CSSStyleDeclaration.prototype.item, st.setProperty === el.style.setProperty],
				methodShape: [st.setProperty.name, st.setProperty.length, Function.prototype.toString.call(st.setProperty), Function.prototype.toString.call(st.getPropertyValue), typeof st.setProperty.prototype],
				cssTextDesc: Object.getOwnPropertyDescriptor(st, "cssText"),
				parentRule: st.parentRule,
			};
		})()`
	),

	differential(
		"style-method-receivers",
		`(() => {
			const a = document.createElement("div");
			const b = document.createElement("div");
			const f = a.style.setProperty;
			const out = {};
			out.otherReceiver = [H.v(() => f.call(b.style, "color", "red")), a.style.color, b.style.color];
			out.emptyReceiver = H.err(() => a.style.setProperty.call({}, "color", "red"));
			out.afterEmpty = a.style.color;
			out.nullReceiver = H.err(() => a.style.getPropertyValue.call(null, "color"));
			a.style.color = "green";
			out.protoOnProxy = [
				H.v(() => CSSStyleDeclaration.prototype.getPropertyValue.call(a.style, "color")),
				H.v(() => CSSStyleDeclaration.prototype.item.call(a.style, 0)),
				H.v(() => Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "cssText").get.call(a.style)),
				H.v(() => Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "length").get.call(a.style)),
				H.v(() => Reflect.get(CSSStyleDeclaration.prototype, "cssText", a.style)),
			];
			out.protoSetOnProxy = [
				H.v(() => CSSStyleDeclaration.prototype.setProperty.call(a.style, "margin", "3px")),
				H.v(() => Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "cssText").set.call(a.style, "padding: 4px")),
				a.getAttribute("style"),
			];
			const detached = a.style.removeProperty;
			a.style.color = "red";
			out.detachedCall = [H.v(() => detached("color")), a.style.color];
			out.bind = H.v(() => { const g = a.style.getPropertyValue.bind(b.style); return g("color"); });
			return out;
		})()`
	),

	differential(
		"style-expandos",
		`(() => {
			const el = document.createElement("div");
			el.style.mine = "url(/x.png)";
			const r1 = el.style.mine;
			const r2 = el.style.mine;
			el.style.mine = "url(/y.png)";
			const r3 = el.style.mine;
			Object.defineProperty(el.style, "other", { value: "url(/z.png)", configurable: true, writable: true, enumerable: true });
			Object.defineProperty(el.style, "backgroundImage", { value: "url(/dp.png)", configurable: true, writable: true, enumerable: true });
			return [r1, r2, r3, el.style.other, Object.keys(el.style).includes("mine"), el.getAttribute("style"), el.style.backgroundImage, delete el.style.mine, el.style.mine];
		})()`
	),

	differential(
		"style-setproperty-args",
		`(() => {
			const el = document.createElement("div");
			const st = el.style;
			const c = H.counter();
			const out = [st.setProperty(c.arg("color", "prop"), c.arg("red", "value"), c.arg("important", "prio")), c.n, c.log, st.getPropertyPriority("color"), el.getAttribute("style")];
			st.setProperty("color", null);
			out.push(st.color, el.getAttribute("style"));
			st.setProperty("color", "blue", null);
			out.push(st.getPropertyPriority("color"), el.getAttribute("style"));
			st.setProperty("color", "green", "bogus");
			out.push(st.color);
			st.setProperty("color", "green", undefined);
			out.push(st.color, st.getPropertyPriority("color"));
			st.setProperty("--custom", " url(/cv.png) ");
			out.push(st.getPropertyValue("--custom"), el.getAttribute("style"));
			st.setProperty("COLOR", "purple");
			out.push(st.color);
			out.push(H.err(() => st.setProperty()), H.err(() => st.setProperty("color")), H.err(() => st.removeProperty()), H.err(() => st.getPropertyValue()), H.err(() => st.setProperty(Symbol(), "x")));
			const c2 = H.counter();
			out.push(st.getPropertyValue(c2.arg("color")), st.removeProperty(c2.arg("--custom")), c2.n);
			st.cssText = null;
			out.push(st.cssText, el.getAttribute("style"));
			const c3 = H.counter();
			st.cssText = c3.arg("color: red; background: url(/cc.png)");
			out.push(c3.n, st.cssText, el.getAttribute("style"));
			st.cssText = "color: bogus-value; width: 10px";
			out.push(st.cssText, el.getAttribute("style"));
			return out;
		})()`
	),

	differential(
		"style-computed",
		`(async () => {
			const el = document.createElement("div");
			el.style.backgroundImage = "url(/computed.png)";
			el.style.color = "red";
			document.body.append(el);
			const cs = getComputedStyle(el);
			const out = [cs.backgroundImage, cs.getPropertyValue("background-image"), cs.color, cs.cssText, H.err(() => cs.setProperty("color", "blue")), H.err(() => { cs.color = "blue"; }), cs.color];
			out.push(getComputedStyle(el) === cs, Object.prototype.toString.call(cs));
			if (typeof el.computedStyleMap === "function") {
				const m = el.computedStyleMap();
				out.push(String(m.get("background-image")), m.get("color").toString(), m.has("color"), typeof m.size);
			}
			el.remove();
			return out;
		})()`
	),

	differential(
		"attributestylemap",
		`(() => {
			const el = document.createElement("div");
			if (!("attributeStyleMap" in el)) return "absent";
			const m = el.attributeStyleMap;
			const val = (x) => (x == null ? x : [x.constructor.name, String(x)]);
			const out = { same: [m === el.attributeStyleMap, Object.prototype.toString.call(m), m instanceof StylePropertyMap, Object.getPrototypeOf(m) === StylePropertyMap.prototype] };
			out.set = [m.set("color", "red"), el.getAttribute("style"), m.size, m.has("color"), val(m.get("color"))];
			out.setUrl = [m.set("background-image", "url(/a.png)"), el.getAttribute("style"), val(m.get("background-image")), m.getAll("background-image").map(String), el.style.backgroundImage];
			out.append = [m.append("background-image", "url(/b.png)"), el.getAttribute("style"), m.getAll("background-image").map(String), el.style.backgroundImage];
			const parsed = CSSStyleValue.parse("background-image", "url(/c.png)");
			out.parsed = [val(parsed), m.set("background-image", parsed), el.getAttribute("style"), String(m.get("background-image"))];
			out.typed = [m.set("width", CSS.px(10)), m.set("height", "5em"), val(m.get("width")), val(m.get("height")), el.getAttribute("style")];
			out.entries = [...m].map(([k, v]) => [k, v.map(String)]);
			out.keys = [...m.keys()];
			out.delete = [m.delete("color"), el.getAttribute("style"), m.has("color"), m.get("color"), m.delete("color")];
			out.errors = [H.err(() => m.set("bogus-prop", "x")), H.err(() => m.set("color", "not-a-color")), H.err(() => m.set()), H.err(() => m.set("color")), H.err(() => m.append("color", "red")), H.err(() => m.get()), H.err(() => m.delete()), H.err(() => m.set("width", CSS.px(1), CSS.px(2))), H.err(() => m.set("color", {}))];
			out.afterErrors = el.getAttribute("style");
			const c = H.counter();
			out.counted = [m.set(c.arg("margin-top", "prop"), c.arg("3px", "value")), c.n, c.log, el.getAttribute("style")];
			out.countedDelete = [m.delete(c.arg("margin-top")), c.n];
			out.clear = [m.clear(), el.getAttribute("style"), el.hasAttribute("style"), m.size, el.style.cssText];
			el.setAttribute("style", "background-image: url(/attr.png); color: blue");
			out.fromAttr = [m.size, String(m.get("background-image")), val(m.get("color")), m.getAll("background-image").map(String)];
			el.style.setProperty("background-image", "url(/cssom.png)");
			out.fromCssom = [String(m.get("background-image")), el.getAttribute("style")];
			const svg = H.svg("rect");
			if (svg.attributeStyleMap) { svg.attributeStyleMap.set("fill", "url(#grad)"); svg.attributeStyleMap.set("mask-image", "url(/mask.svg)"); out.svg = [svg.getAttribute("style"), String(svg.attributeStyleMap.get("mask-image")), svg.attributeStyleMap === svg.attributeStyleMap]; }
			const math = H.math("mi");
			if (math.attributeStyleMap) { math.attributeStyleMap.set("background-image", "url(/mi.png)"); out.math = [math.getAttribute("style"), String(math.attributeStyleMap.get("background-image"))]; }
			return out;
		})()`
	),

	differential(
		"cssstylevalue-parse",
		`(() => {
			if (typeof CSSStyleValue === "undefined") return "absent";
			const c = H.counter();
			const v = CSSStyleValue.parse(c.arg("background-image", "prop"), c.arg("url(/p.png)", "text"));
			const all = CSSStyleValue.parseAll("background-image", "url(/a.png), url('/b.png')");
			return {
				v: [v.constructor.name, String(v), v.toString(), c.n, c.log],
				all: all.map((x) => [x.constructor.name, String(x)]),
				color: [CSSStyleValue.parse("color", "red").constructor.name, String(CSSStyleValue.parse("color", "red"))],
				unparsed: [String(CSSStyleValue.parse("--x", " url(/u.png) ")), CSSStyleValue.parse("--x", "url(/u.png)").constructor.name],
				errors: [H.err(() => CSSStyleValue.parse("bogus", "x")), H.err(() => CSSStyleValue.parse("color", "")), H.err(() => CSSStyleValue.parse("color")), H.err(() => CSSStyleValue.parse()), H.err(() => CSSStyleValue.parseAll("color")), H.err(() => new CSSStyleValue())],
				receiver: [H.err(() => CSSStyleValue.parse.call({}, "color", "red")), H.err(() => CSSStyleValue.parse.call(null, "color", "red")), H.err(() => CSSStyleValue.parse.call(CSSKeywordValue, "color", "red"))],
				subclass: typeof CSSKeywordValue === "function" ? [CSSKeywordValue.parse === CSSStyleValue.parse, H.v(() => String(CSSKeywordValue.parse("color", "red")))] : "absent",
				tostr: CSSStyleValue.prototype.toString.call(v),
			};
		})()`
	),

	differential(
		"cssstylesheet-rules",
		`(async () => {
			const s = new CSSStyleSheet();
			const c = H.counter();
			const out = {};
			out.insert = [s.insertRule(c.arg(".a { background: url(/a.png) }", "rule"), c.arg(0, "index")), c.n, c.log];
			const r = s.cssRules[0];
			out.rule = [r.cssText, r.style.backgroundImage, r.style.cssText, r.style.getPropertyValue("background-image"), r.selectorText, r.style === r.style, r.constructor.name, r.style.parentRule === r];
			out.insertErrors = [H.err(() => s.insertRule(".c{}", 5)), H.err(() => s.insertRule("bogus")), H.err(() => s.insertRule()), H.err(() => s.insertRule(".d{}", -1)), H.err(() => s.insertRule(Symbol()))];
			out.insertDefault = [s.insertRule(".e { color: red }"), s.cssRules[0].cssText, s.insertRule(".f{}", undefined), s.cssRules.length];
			s.replaceSync(".b { background-image: url('/b.png') } .q { list-style: url(\\"/q.png\\") inside }");
			out.replaceSync = [s.cssRules.length, s.cssRules[0].cssText, s.cssRules[1].cssText, s.cssRules[0].style.backgroundImage];
			out.replaceSyncErrors = [H.err(() => s.replaceSync()), H.v(() => s.replaceSync("@import url(/x.css); .z{}")), s.cssRules.length, s.cssRules[0].cssText];
			if (typeof s.addRule === "function") {
				out.addRule = [s.addRule(".g", "background: url(/g.png)"), s.cssRules[s.cssRules.length - 1].cssText, s.addRule(".h", "color: red", 0), s.cssRules[0].cssText, s.addRule(), s.cssRules[s.cssRules.length - 1].cssText, H.err(() => s.addRule(".i", "", 99)), H.err(() => s.addRule("{", "x"))];
			}
			const p = s.replace(".r { background: url(/r.png) }");
			out.replace = [p instanceof Promise, (await p) === s, s.cssRules[0].cssText];
			out.replaceReject = await s.replace(Symbol()).then(() => "resolved", (e) => e && e.name).catch((e) => "sync:" + e.name);
			out.replaceNone = await (async () => { try { return await s.replace(); } catch (e) { return e.name; } })().then((v) => (v === s ? "sheet" : v));
			out.deleteRule = [s.deleteRule(0), s.cssRules.length];
			const el = document.createElement("style");
			el.textContent = ".t { background: url(/t.png) } @media all { .u { background-image: url('/u.png') } }";
			document.head.append(el);
			out.styleElement = [el.sheet.cssRules[0].cssText, el.sheet.cssRules[1].cssText, el.sheet.cssRules[1].cssRules[0].style.backgroundImage, el.textContent, el.sheet.insertRule(".v{background:url(/v.png)}", 2), el.sheet.cssRules[2].cssText, el.textContent];
			el.remove();
			return out;
		})()`
	),

	differential(
		"cssrule-style-kinds",
		`(() => {
			const s = new CSSStyleSheet();
			const src = [
				"@page { margin: 1px; background: url(/p.png) }",
				"@keyframes k { from { background: url(/k.png) } }",
				"@font-face { font-family: x; src: url(/f.woff) format('woff') }",
				".n { color: red; &:hover { color: blue } background: url(/n.png) }",
				"@position-try --p { top: 1px }",
				"@page { @top-left { content: 'x'; background: url(/m.png) } }",
				"@media screen { .m { background-image: url(/mm.png) } }",
				"@supports (display: grid) { .s { background-image: url(/s.png) } }",
			];
			const out = [];
			for (const text of src) {
				try { s.replaceSync(text); } catch (e) { out.push(["replaceSync", e.name]); continue; }
				const walk = (rules, depth) => {
					for (const r of rules) {
						const entry = [depth, r.constructor.name, r.cssText];
						if (r.style) {
							entry.push(r.style === r.style, r.style.cssText, r.style.getPropertyValue("background-image"), r.style.getPropertyValue("src"), r.style.backgroundImage, r.style.src, Object.prototype.toString.call(r.style), Object.getPrototypeOf(r.style) && Object.getPrototypeOf(r.style).constructor.name);
							r.style.setProperty("background-image", "url(/set.png)");
							entry.push(r.style.backgroundImage, r.cssText);
						}
						if (r.keyText !== undefined) entry.push(r.keyText);
						out.push(entry);
						if (r.cssRules) walk(r.cssRules, depth + 1);
					}
				};
				walk(s.cssRules, 0);
			}
			return out;
		})()`
	),

	differential(
		"svg-mathml-style",
		`(() => {
			const out = [];
			for (const el of [H.svg("rect"), H.math("mi")]) {
				const st = el.style;
				st.setProperty("background-image", "url(/sm.png)");
				out.push([st === el.style, st.backgroundImage, el.getAttribute("style"), st.cssText, Object.getPrototypeOf(st) === CSSStyleDeclaration.prototype]);
				el.setAttribute("style", "mask: url(/mask.svg#m)");
				out.push([st.cssText, st.maskImage, el.getAttribute("style")]);
				el.style = "background: url('/pf.png')";
				out.push([st.cssText, el.getAttribute("style"), el.outerHTML]);
			}
			return out;
		})()`
	),
];

export default [
	...memberTests,
	...elementTests,
	...nodeTests,
	...markupTests,
	...reflectTests,
	...frameTests,
	...tokenListTests,
	...cssTests,
];
