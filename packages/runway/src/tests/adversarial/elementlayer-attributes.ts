import { basicTest } from "../../testcommon.ts";

// The attribute API over the attribute layer (#112): `client/attributes.ts`,
// `client/dom/element.ts` and `client/dom/attr.ts`.
//
// Scramjet rewrites URL attributes, strips `nonce` / `sandbox` / `csp` /
// `credentialless`, blanks `integrity`, CSS-rewrites `style`, JS-rewrites
// `on*` handlers and HTML-rewrites `srcdoc` - keeping the page's own value in
// a `scramjet-attr-<name>` mirror. None of that may be observable, so almost
// every test here is *differential*: it snapshots everything the page can see
// and the runner fails it when the bare browser and the proxied page disagree.
//
// The exception is the internal prefix. Natively `scramjet-attr-src` is an
// attribute like any other; under scramjet it is deliberately unreachable.
// Differential tests over those names would only ever measure that choice, so
// the prefix tests below assert invariants that hold both ways instead: a page
// writing, reading or removing an internal name cannot change or see what it
// reads under the real one.

const PRELUDE = `
	const SVG = "http://www.w3.org/2000/svg";
	const XLINK = "http://www.w3.org/1999/xlink";
	const MATHML = "http://www.w3.org/1998/Math/MathML";
	const XHTML = "http://www.w3.org/1999/xhtml";
	const XMLNS = "http://www.w3.org/2000/xmlns/";
	const XMLNSP = "http://www.w3.org/XML/1998/namespace";
	const html = (tag) => document.createElement(tag);
	const svg = (tag) => document.createElementNS(SVG, tag);
	const math = (tag) => document.createElementNS(MATHML, tag);
	const attempt = (fn) => {
		try {
			const v = fn();
			return v === undefined ? "undefined" : v;
		} catch (e) {
			return { threw: e && e.name };
		}
	};
	const attrInfo = (a) =>
		a === null
			? null
			: a === undefined
				? "undefined"
				: {
						name: a.name,
						localName: a.localName,
						prefix: a.prefix,
						ns: a.namespaceURI,
						value: a.value,
						nodeName: a.nodeName,
						nodeValue: a.nodeValue,
						textContent: a.textContent,
						owner: a.ownerElement ? a.ownerElement.localName : null,
						specified: a.specified,
					};
	const listed = (el) => Array.from(el.attributes, (a) => [a.name, a.value]);
	const state = (el) => ({
		names: el.getAttributeNames(),
		list: listed(el),
		length: el.attributes.length,
		hasAttributes: el.hasAttributes(),
		html: el.outerHTML,
	});
	const probe = (el, name) => ({
		get: el.getAttribute(name),
		has: el.hasAttribute(name),
		node: attrInfo(el.getAttributeNode(name)),
		named: attrInfo(el.attributes.getNamedItem(name)),
		prop: attrInfo(el.attributes[name]),
		getNS: el.getAttributeNS(null, name),
		hasNS: el.hasAttributeNS(null, name),
	});
	const records = (mo) =>
		mo.takeRecords().map((r) => [r.type, r.attributeName, r.attributeNamespace, r.oldValue]);
`;

/** Snapshot whatever `body` returns, in both runs, and compare. */
const differential = (name: string, body: string) =>
	basicTest({
		name: `elattr-${name}`,
		js: `
			const snapshot = async () => {
				try {
					return { value: await (async () => { ${PRELUDE}
						${body}
					})() };
				} catch (error) {
					return { error: error && error.name };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

/** Hand-written assertions, which must hold in both runs. */
const invariant = (name: string, body: string) =>
	basicTest({
		name: `elattr-${name}`,
		js: `${PRELUDE}
			${body}
		`,
	});

/** Every element / attribute pair the rule table rewrites as a URL. */
const URL_PAIRS = `[
	["html", "img", "src"],
	["html", "img", "srcset"],
	["html", "a", "href"],
	["html", "area", "href"],
	["html", "link", "href"],
	["html", "link", "imagesrcset"],
	["html", "script", "src"],
	["html", "iframe", "src"],
	["html", "frame", "src"],
	["html", "embed", "src"],
	["html", "video", "src"],
	["html", "video", "poster"],
	["html", "audio", "src"],
	["html", "source", "src"],
	["html", "source", "srcset"],
	["html", "track", "src"],
	["html", "input", "src"],
	["html", "input", "formaction"],
	["html", "button", "formaction"],
	["html", "object", "data"],
	["html", "form", "action"],
	["svg", "a", "href"],
	["svg", "image", "href"],
	["svg", "script", "href"],
	["svg", "use", "href"],
	["svg", "feImage", "href"],
	["svg", "textPath", "href"],
	["svg", "linearGradient", "href"],
	["svg", "pattern", "href"],
	["html", "div", "src"],
	["html", "span", "href"],
]`;

const urlSweep = (name: string, value: string) =>
	differential(
		`url-sweep-${name}`,
		`
			const out = {};
			for (const [kind, tag, attr] of ${URL_PAIRS}) {
				const el = kind === "svg" ? svg(tag) : html(tag);
				el.setAttribute(attr, ${JSON.stringify(value)});
				out[kind + ":" + tag + "@" + attr] = [
					el.getAttribute(attr),
					el.hasAttribute(attr),
					el.getAttributeNode(attr).value,
					el.attributes[attr].value,
					el.getAttributeNames(),
					el.outerHTML,
				];
			}
			return out;
		`
	);

export default [
	// --- every URL attribute, a range of values ------------------------------

	urlSweep("relative", "sub/a b.png?x=1#h"),
	urlSweep("absolute", "https://example.test/a.png"),
	urlSweep("protocol-relative", "//example.test/p"),
	urlSweep("root-relative", "/root/p?q"),
	urlSweep("javascript", "javascript:void 0"),
	urlSweep("data", "data:text/plain,hello"),
	urlSweep("about", "about:blank"),
	urlSweep("empty", ""),
	urlSweep("whitespace", "  \n spaced.png \t"),
	urlSweep("fragment", "#frag"),
	urlSweep("srcset-like", "a.png 1x, b.png 2x"),

	// written, then overwritten: the second value has to replace the first
	// everywhere, the mirror included
	differential(
		"url-overwrite",
		`
			const img = html("img");
			img.setAttribute("src", "one.png");
			img.setAttribute("src", "two.png");
			const a = html("a");
			a.setAttribute("href", "https://example.test/1");
			a.setAttribute("href", "");
			return { img: [probe(img, "src"), state(img)], a: [probe(a, "href"), state(a)] };
		`
	),

	// the IDL attributes read the page's value back, resolved
	differential(
		"url-idl-after-setattribute",
		`
			const img = html("img");
			img.setAttribute("src", "i.png");
			const a = html("a");
			a.setAttribute("href", "p?q#h");
			const form = html("form");
			form.setAttribute("action", "go");
			const script = html("script");
			script.setAttribute("src", "s.js");
			const video = html("video");
			video.setAttribute("poster", "p.jpg");
			const object = html("object");
			object.setAttribute("data", "d.bin");
			return {
				img: img.src,
				a: [a.href, a.pathname, a.search, a.hash, a.host],
				form: form.action,
				script: script.src,
				poster: video.poster,
				object: object.data,
			};
		`
	),

	// --- stripped and blanked attributes ------------------------------------

	differential(
		"nonce-everywhere",
		`
			const out = {};
			for (const el of [html("div"), html("script"), html("style"), html("link"), svg("script"), svg("rect"), math("mi")]) {
				el.setAttribute("nonce", "n0nce");
				out[el.namespaceURI + " " + el.localName] = [probe(el, "nonce"), state(el), el.nonce];
			}
			return out;
		`
	),
	differential(
		"integrity-blanked",
		`
			const out = {};
			for (const tag of ["script", "link", "img", "div"]) {
				const el = html(tag);
				el.setAttribute("integrity", "sha384-abc");
				out[tag] = [probe(el, "integrity"), state(el), el.integrity === undefined ? "none" : el.integrity];
			}
			return out;
		`
	),
	differential(
		"iframe-stripped-attributes",
		`
			const f = html("iframe");
			f.setAttribute("sandbox", "allow-scripts allow-forms");
			f.setAttribute("csp", "default-src 'none'");
			f.setAttribute("credentialless", "");
			f.setAttribute("name", "x");
			return {
				sandbox: probe(f, "sandbox"),
				csp: probe(f, "csp"),
				credentialless: probe(f, "credentialless"),
				state: state(f),
				idl: [f.sandbox.value, f.csp, f.credentialless],
			};
		`
	),
	// the same names on an element the rules do not cover are ordinary
	differential(
		"stripped-names-off-target",
		`
			const d = html("div");
			d.setAttribute("sandbox", "allow-scripts");
			d.setAttribute("csp", "x");
			d.setAttribute("credentialless", "");
			d.setAttribute("srcdoc", "<p>");
			d.setAttribute("target", "_top");
			return state(d);
		`
	),
	differential(
		"srcdoc",
		`
			const f = html("iframe");
			const doc = '<p onclick="parent.x()" style="background:url(a.png)">hi <img src="a.png" srcset="b.png 2x"><script src="s.js"><\\/script></p>';
			f.setAttribute("srcdoc", doc);
			const before = [probe(f, "srcdoc"), state(f), f.srcdoc];
			f.setAttribute("srcdoc", "");
			return { before, empty: [probe(f, "srcdoc"), f.srcdoc] };
		`
	),
	differential(
		"target",
		`
			const out = {};
			for (const tag of ["a", "base", "form", "area"]) {
				for (const v of ["_top", "_parent", "_blank", "_self", "_unfencedTop", "named", "_TOP"]) {
					const el = html(tag);
					el.setAttribute("target", v);
					out[tag + ":" + v] = [el.getAttribute("target"), el.target, el.outerHTML];
				}
			}
			const s = svg("a");
			s.setAttribute("target", "_top");
			out.svg = [s.getAttribute("target"), s.target.baseVal, s.outerHTML];
			return out;
		`
	),
	differential(
		"meta-refresh-orders",
		`
			const out = {};
			const url = "0; url='https://example.test/next?x'";
			const a = html("meta");
			a.setAttribute("http-equiv", "refresh");
			a.setAttribute("content", url);
			out.equivFirst = [a.getAttribute("content"), a.content, a.outerHTML];
			const b = html("meta");
			b.setAttribute("content", url);
			b.setAttribute("http-equiv", "Refresh");
			out.contentFirst = [b.getAttribute("content"), b.content, b.outerHTML];
			b.setAttribute("http-equiv", "content-type");
			out.equivChanged = [b.getAttribute("content"), b.content, b.outerHTML];
			b.removeAttribute("http-equiv");
			out.equivRemoved = [b.getAttribute("content"), b.outerHTML];
			const c = html("meta");
			c.setAttribute("name", "description");
			c.setAttribute("content", "5;url=nope");
			out.notRefresh = [c.getAttribute("content"), c.outerHTML];
			const d = html("meta");
			d.setAttribute("http-equiv", "refresh");
			for (const v of ["5", "5;", "5; URL=rel/p", "  3 ,url=x", "garbage"]) {
				d.setAttribute("content", v);
				out["refresh " + v] = [d.getAttribute("content"), d.content];
			}
			return out;
		`
	),

	// --- names: case folding ------------------------------------------------

	differential(
		"html-case-folding",
		`
			const img = html("img");
			img.setAttribute("SRC", "a.png");
			const out = { afterUpper: [probe(img, "Src"), probe(img, "src"), state(img)] };
			img.setAttribute("sRc", "b.png");
			out.afterMixed = [probe(img, "SRC"), state(img)];
			out.toggle = img.toggleAttribute("SrC");
			out.afterToggle = state(img);
			img.setAttribute("NONCE", "n");
			out.nonce = [probe(img, "Nonce"), img.nonce];
			img.removeAttribute("NoNcE");
			out.nonceRemoved = [probe(img, "nonce"), img.nonce, state(img)];
			return out;
		`
	),
	differential(
		"svg-case-preserved",
		`
			const s = svg("svg");
			s.setAttribute("viewBox", "0 0 1 1");
			const a = svg("a");
			a.setAttribute("HREF", "https://example.test/upper");
			a.setAttribute("href", "https://example.test/lower");
			const use = svg("use");
			use.setAttribute("Href", "#x");
			return {
				viewBox: [s.getAttribute("viewBox"), s.getAttribute("viewbox"), s.hasAttribute("VIEWBOX"), state(s)],
				a: [probe(a, "HREF"), probe(a, "href"), state(a), a.href.baseVal],
				use: [probe(use, "Href"), probe(use, "href"), state(use)],
			};
		`
	),
	// the NS methods never fold case, and a namespace-less lookup is by
	// *local* name, exactly
	differential(
		"ns-lookups-are-case-sensitive",
		`
			const d = html("div");
			d.setAttribute("id", "x");
			d.setAttribute("nonce", "n");
			const img = html("img");
			img.setAttribute("src", "a.png");
			const out = {};
			for (const [el, n] of [[d, "ID"], [d, "Id"], [d, "NONCE"], [img, "SRC"], [img, "src"], [d, "id"]]) {
				out[el.localName + ":" + n] = {
					getNS: el.getAttributeNS(null, n),
					hasNS: el.hasAttributeNS(null, n),
					nodeNS: attrInfo(el.getAttributeNodeNS(null, n)),
					namedNS: attrInfo(el.attributes.getNamedItemNS(null, n)),
				};
			}
			out.removeNS = attempt(() => { d.removeAttributeNS(null, "ID"); return state(d); });
			out.removeNamedNS = attempt(() => d.attributes.removeNamedItemNS(null, "ID").name);
			out.after = state(d);
			return out;
		`
	),
	// setAttributeNS never lowercases: "SRC" on an img is not its src
	differential(
		"setattributens-uppercase-on-html",
		`
			const img = html("img");
			img.setAttributeNS(null, "SRC", "upper.png");
			const out = { upper: [probe(img, "SRC"), probe(img, "src"), state(img), img.src] };
			img.setAttribute("src", "lower.png");
			out.both = [probe(img, "src"), img.getAttributeNS(null, "SRC"), img.getAttributeNS(null, "src"), state(img), img.src];
			img.removeAttributeNS(null, "SRC");
			out.removed = [probe(img, "src"), state(img)];
			return out;
		`
	),
	// a namespace-less lookup must not match a prefixed attribute by its
	// qualified name
	differential(
		"ns-null-lookup-vs-prefixed-name",
		`
			const use = svg("use");
			use.setAttributeNS(XLINK, "xlink:href", "#a");
			const d = html("div");
			d.setAttributeNS("urn:x", "p:foo", "bar");
			const out = {};
			for (const [el, n] of [[use, "xlink:href"], [use, "href"], [d, "p:foo"], [d, "foo"]]) {
				out[el.localName + " " + n] = {
					getNS: el.getAttributeNS(null, n),
					hasNS: el.hasAttributeNS(null, n),
					nodeNS: attrInfo(el.getAttributeNodeNS(null, n)),
					namedNS: attrInfo(el.attributes.getNamedItemNS(null, n)),
					get: el.getAttribute(n),
				};
			}
			return out;
		`
	),
	// a foreign-namespace attribute that happens to be called `src` is not the
	// img's src, and must not stand in for it
	differential(
		"foreign-namespace-same-local-name",
		`
			const img = html("img");
			img.setAttribute("src", "own.png");
			img.setAttributeNS("urn:x", "src", "foreign.png");
			const out = {
				get: img.getAttribute("src"),
				nullNS: img.getAttributeNS(null, "src"),
				urnNS: img.getAttributeNS("urn:x", "src"),
				idl: img.src,
				state: state(img),
				nodes: [attrInfo(img.getAttributeNodeNS(null, "src")), attrInfo(img.getAttributeNodeNS("urn:x", "src"))],
			};
			img.removeAttributeNS("urn:x", "src");
			out.afterForeignRemoved = [probe(img, "src"), state(img), img.src];
			img.setAttributeNS("urn:x", "q:src", "foreign2.png");
			out.prefixed = [probe(img, "src"), probe(img, "q:src"), state(img)];
			return out;
		`
	),

	// --- the NS variants ----------------------------------------------------

	differential(
		"xlink-href-prefixes",
		`
			const out = {};
			for (const tag of ["use", "image", "a", "script", "feImage", "textPath", "pattern", "radialGradient"]) {
				for (const q of ["xlink:href", "x:href", "href"]) {
					const el = svg(tag);
					el.setAttributeNS(XLINK, q, "img.png#f");
					out[tag + " " + q] = {
						ns: el.getAttributeNS(XLINK, "href"),
						hasNS: el.hasAttributeNS(XLINK, "href"),
						byName: el.getAttribute(q),
						plainHref: el.getAttribute("href"),
						node: attrInfo(el.getAttributeNodeNS(XLINK, "href")),
						state: state(el),
						base: el.href ? el.href.baseVal : "none",
					};
				}
			}
			return out;
		`
	),
	differential(
		"xlink-and-plain-href-together",
		`
			const use = svg("use");
			use.setAttribute("href", "#plain");
			use.setAttributeNS(XLINK, "xlink:href", "#legacy");
			const out = { both: [probe(use, "href"), probe(use, "xlink:href"), use.getAttributeNS(XLINK, "href"), state(use), use.href.baseVal] };
			use.removeAttributeNS(XLINK, "xlink:href");
			out.noopRemove = state(use);
			use.removeAttributeNS(XLINK, "href");
			out.legacyRemoved = [state(use), use.href.baseVal];
			use.setAttributeNS(XLINK, "xlink:href", "#again");
			use.removeAttribute("href");
			out.plainRemoved = [state(use), use.href.baseVal];
			use.removeAttribute("xlink:href");
			out.allRemoved = [state(use), use.href.baseVal];
			return out;
		`
	),
	differential(
		"setattributens-errors",
		`
			const cases = [
				[null, "x:y"],
				[null, "xmlns"],
				[XMLNS, "foo"],
				[XMLNS, "xmlns:foo"],
				[XMLNS, "xmlns"],
				["urn:x", "xmlns:foo"],
				["urn:x", "xml:foo"],
				[XMLNSP, "xml:lang"],
				[XLINK, "xmlns:href"],
				["", "a:b"],
				["urn:x", ":b"],
				["urn:x", "a:"],
				["urn:x", "a:b:c"],
				["urn:x", ""],
				["urn:x", "a b"],
				[null, "src"],
				[null, "x:src"],
				[XLINK, "xlink:src"],
			];
			const out = {};
			for (const tag of ["img", "use"]) {
				for (const [ns, q] of cases) {
					const el = tag === "use" ? svg(tag) : html(tag);
					const r = attempt(() => el.setAttributeNS(ns, q, "v.png"));
					out[tag + " " + ns + " " + JSON.stringify(q)] = [r, el.getAttributeNames(), listed(el)];
				}
			}
			return out;
		`
	),
	differential(
		"attr-prefix-and-localname",
		`
			const use = svg("use");
			use.setAttributeNS(XLINK, "xlink:href", "#a");
			use.setAttributeNS(XMLNSP, "xml:lang", "en");
			use.setAttributeNS(XMLNS, "xmlns:foo", "urn:foo");
			use.setAttributeNS("urn:foo", "foo:bar", "b");
			const img = html("img");
			img.setAttributeNS("urn:x", "p:src", "x.png");
			img.setAttributeNS(null, "src", "y.png");
			return {
				use: Array.from(use.attributes, attrInfo),
				img: Array.from(img.attributes, attrInfo),
				html: [use.outerHTML, img.outerHTML],
			};
		`
	),
	differential(
		"removeattributens-variants",
		`
			const out = {};
			const mk = () => {
				const el = svg("image");
				el.setAttributeNS(XLINK, "xlink:href", "i.png");
				el.setAttribute("href", "j.png");
				el.setAttribute("nonce", "n");
				return el;
			};
			for (const [ns, name] of [[XLINK, "xlink:href"], [XLINK, "href"], [null, "href"], [null, "xlink:href"], [null, "nonce"], [XLINK, "nonce"], ["", "href"], [null, "missing"]]) {
				const el = mk();
				const r = attempt(() => el.removeAttributeNS(ns, name));
				out[ns + " " + name] = [r, state(el)];
			}
			return out;
		`
	),

	// --- invalid names ------------------------------------------------------

	differential(
		"invalid-names",
		`
			const bad = ["", " ", "a b", "a=b", "a/b", "a>b", "\\t", "src ", " src", "\\n", "a\\u0000b", "<", '"', "'", "=", "src=x", "on click"];
			const out = {};
			for (const tag of ["img", "div", "iframe"]) {
				for (const n of bad) {
					const el = html(tag);
					el.setAttribute("id", "keep");
					out[tag + " " + JSON.stringify(n)] = {
						set: attempt(() => el.setAttribute(n, "a.png")),
						toggle: attempt(() => el.toggleAttribute(n)),
						toggleFalse: attempt(() => el.toggleAttribute(n, false)),
						get: attempt(() => el.getAttribute(n)),
						has: attempt(() => el.hasAttribute(n)),
						remove: attempt(() => el.removeAttribute(n)),
						create: attempt(() => document.createAttribute(n).name),
						setNS: attempt(() => el.setAttributeNS(null, n, "a.png")),
						createNS: attempt(() => document.createAttributeNS(null, n).name),
						names: el.getAttributeNames(),
					};
				}
			}
			return out;
		`
	),
	// names the older XML rules rejected and the current spec allows
	differential(
		"unusual-but-valid-names",
		`
			const names = ["1src", "-src", "src:", ":src", "sr\\u00e9c", "\\u2603", "src.x", "a:b:c", "[src]", "on", "on-click", "onclick2", "ONCLICK"];
			const out = {};
			for (const n of names) {
				const el = html("img");
				const set = attempt(() => el.setAttribute(n, "v.png"));
				out[JSON.stringify(n)] = [set, attempt(() => el.getAttribute(n)), el.getAttributeNames(), attempt(() => el.outerHTML)];
			}
			return out;
		`
	),

	// --- the internal prefix: invariants, not differentials -----------------

	// writing under a mirror's name, by any route, must not change what the
	// page reads under the real one. Natively a `scramjet-attr-src` attribute
	// is simply an unrelated attribute, so this holds bare too
	invariant(
		"prefix-writes-do-not-poison-mirror",
		`
			const routes = {
				setAttribute: (el, n, v) => el.setAttribute(n, v),
				setAttributeNS: (el, n, v) => el.setAttributeNS(null, n, v),
				setAttributeNode: (el, n, v) => { const a = document.createAttribute(n); a.value = v; el.setAttributeNode(a); },
				setAttributeNodeNS: (el, n, v) => { const a = document.createAttributeNS(null, n); a.value = v; el.setAttributeNodeNS(a); },
				setNamedItem: (el, n, v) => { const a = document.createAttribute(n); a.value = v; el.attributes.setNamedItem(a); },
				toggleAttribute: (el, n) => el.toggleAttribute(n),
			};
			for (const [route, write] of Object.entries(routes)) {
				for (const [tag, attr, value] of [["img", "src", "own.png"], ["a", "href", "own"], ["div", "style", "color: red;"], ["div", "onclick", "void 0"], ["div", "nonce", "own"]]) {
					const el = html(tag);
					el.setAttribute(attr, value);
					write(el, "scramjet-attr-" + attr, "https://evil.test/");
					assertEqual(el.getAttribute(attr), value, route + ": " + tag + " getAttribute(" + attr + ")");
					assertEqual(el.getAttributeNS(null, attr), value, route + ": " + tag + " getAttributeNS(" + attr + ")");
					assertEqual(el.getAttributeNode(attr).value, value, route + ": " + tag + " Attr.value");
					assertEqual(el.getAttributeNames().filter((n) => n === attr).length, 1, route + ": " + tag + " listed once");
				}
				const use = svg("use");
				use.setAttribute("href", "#own");
				write(use, "scramjet-attr-href", "https://evil.test/");
				assertEqual(use.getAttribute("href"), "#own", route + ": svg use href");
				assertEqual(use.href.baseVal, "#own", route + ": svg use href.baseVal");
			}
		`
	),
	// a page cannot make an attribute appear by writing its mirror
	invariant(
		"prefix-writes-do-not-conjure-attributes",
		`
			for (const n of ["scramjet-attr-src", "SCRAMJET-ATTR-src", "scramjet-attr-nonce"]) {
				const img = html("img");
				img.setAttribute(n, "https://evil.test/x.png");
				img.setAttributeNS(null, n.toLowerCase(), "https://evil.test/y.png");
				assertEqual(img.getAttribute("src"), null, n + ": src");
				assert(!img.hasAttribute("src"), n + ": hasAttribute src");
				assert(!img.hasAttribute("nonce"), n + ": hasAttribute nonce");
				assertEqual(img.src, "", n + ": img.src");
				assertEqual(img.nonce, "", n + ": img.nonce");
				assert(!img.getAttributeNames().includes("src"), n + ": not listed as src");
			}
		`
	),
	// removing, toggling or deleting a mirror's name must leave the real
	// attribute exactly as it was
	invariant(
		"prefix-removals-leave-attribute",
		`
			const img = html("img");
			img.setAttribute("src", "own.png");
			img.setAttribute("nonce", "own");
			for (const n of ["scramjet-attr-src", "SCRAMJET-ATTR-SRC", "scramjet-attr-nonce", "scramjet-attr", "scramjet-attrx"]) {
				img.removeAttribute(n);
				img.removeAttributeNS(null, n);
				img.toggleAttribute(n, false);
				try { img.attributes.removeNamedItem(n); } catch {}
				try { img.attributes.removeNamedItemNS(null, n); } catch {}
				assertEqual(img.getAttribute("src"), "own.png", n + ": src");
				assertEqual(img.src, location.origin + "/own.png", n + ": img.src");
				assertEqual(img.getAttribute("nonce"), "own", n + ": nonce");
				assertEqual(img.nonce, "own", n + ": img.nonce");
			}
		`
	),
	// no read path ever shows the page a mirror
	invariant(
		"prefix-mirrors-never-listed",
		`
			const els = [];
			const add = (el, pairs) => { for (const [n, v] of pairs) el.setAttribute(n, v); els.push(el); };
			add(html("img"), [["src", "a.png"], ["srcset", "a.png 2x"], ["nonce", "n"], ["style", "color:red"], ["onerror", "void 0"]]);
			add(html("iframe"), [["src", "f.html"], ["sandbox", "allow-scripts"], ["srcdoc", "<p>"], ["csp", "x"], ["credentialless", ""]]);
			add(html("script"), [["src", "s.js"], ["integrity", "sha384-x"], ["nonce", "n"]]);
			add(html("a"), [["href", "h"], ["target", "_top"]]);
			add(svg("use"), [["href", "u.svg#x"]]);
			const s = html("script");
			s.text = "var x = location.href;";
			els.push(s);
			const x = svg("image");
			x.setAttributeNS(XLINK, "xlink:href", "i.png");
			els.push(x);
			for (const el of els) {
				const seen = [
					...el.getAttributeNames(),
					...Array.from(el.attributes, (a) => a.name),
					...Array.from(el.attributes, (a) => a.localName),
					...Array.from(el.attributes, (a) => a.nodeName),
					...Object.getOwnPropertyNames(el.attributes),
					...Reflect.ownKeys(el.attributes).map(String),
					el.outerHTML,
				];
				for (let i = 0; i < el.attributes.length; i++) seen.push(el.attributes.item(i).name);
				for (const k in el.attributes) seen.push(k);
				assert(!seen.some((n) => n.toLowerCase().includes("scramjet-attr")), el.localName + " exposes a mirror: " + JSON.stringify(seen));
				assertEqual(el.attributes.length, el.getAttributeNames().length, el.localName + " length");
			}
			assert(!s.hasAttributes(), "a script with only a source has no attributes");
		`
	),
	// a mirror is not reachable by its own name, by any read
	invariant(
		"prefix-reads-find-nothing",
		`
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			for (const n of ["scramjet-attr-src", "scramjet-attr-nonce"]) {
				assertEqual(img.getAttribute(n), null, n + " getAttribute");
				assertEqual(img.getAttributeNS(null, n), null, n + " getAttributeNS");
				assert(!img.hasAttribute(n), n + " hasAttribute");
				assert(!img.hasAttributeNS(null, n), n + " hasAttributeNS");
				assertEqual(img.getAttributeNode(n), null, n + " getAttributeNode");
				assertEqual(img.getAttributeNodeNS(null, n), null, n + " getAttributeNodeNS");
				assertEqual(img.attributes.getNamedItem(n), null, n + " getNamedItem");
				assertEqual(img.attributes.getNamedItemNS(null, n), null, n + " getNamedItemNS");
				assertEqual(img.attributes[n], undefined, n + " named property");
				assert(!(n in img.attributes), n + " in");
				assertEqual(Object.getOwnPropertyDescriptor(img.attributes, n), undefined, n + " descriptor");
				let threw = null;
				try { img.attributes.removeNamedItem(n); } catch (e) { threw = e.name; }
				assertEqual(threw, "NotFoundError", n + " removeNamedItem");
			}
		`
	),
	// selectors run natively against the live document, mirrors and all
	invariant(
		"prefix-selectors-find-nothing",
		`
			const host = html("div");
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			host.append(img);
			assert(!img.matches("[scramjet-attr-src]"), "matches [scramjet-attr-src]");
			assert(!img.matches("[scramjet-attr-nonce]"), "matches [scramjet-attr-nonce]");
			assertEqual(host.querySelector("[scramjet-attr-src]"), null, "querySelector [scramjet-attr-src]");
			assertEqual(host.querySelectorAll("[scramjet-attr-nonce='n']").length, 0, "querySelectorAll by mirror value");
		`
	),
	// the script source record is not a page-writable attribute either
	invariant(
		"prefix-script-source-not-writable",
		`
			for (const route of ["setAttribute", "setAttributeNS", "setAttributeNode"]) {
				const s = html("script");
				const n = "scramjet-attr-script-source-src";
				const v = btoa("window.__elattrPoisoned = 1");
				if (route === "setAttribute") s.setAttribute(n, v);
				else if (route === "setAttributeNS") s.setAttributeNS(null, n, v);
				else { const a = document.createAttribute(n); a.value = v; s.setAttributeNode(a); }
				assertEqual(s.text, "", route + ": script.text");
				assertEqual(s.textContent, "", route + ": script.textContent");
				assertEqual(s.getAttribute("src"), null, route + ": no src appears");
			}
		`
	),
	// names that merely contain the prefix belong to the page
	differential(
		"prefix-lookalikes-are-ordinary",
		`
			const d = html("div");
			d.setAttribute("data-scramjet-attr-src", "1");
			d.setAttribute("x-scramjet-attr", "2");
			d.dataset.scramjetAttrHref = "3";
			d.className = "scramjet-attr-src";
			const s = svg("use");
			s.setAttribute("SCRAMJET-ATTR-href", "#upper");
			s.setAttribute("Scramjet-Attr-x", "y");
			return { div: [state(d), d.dataset.scramjetAttrSrc, d.matches(".scramjet-attr-src")], svg: [state(s), probe(s, "SCRAMJET-ATTR-href"), s.getAttribute("href")] };
		`
	),

	// --- order, and hasAttributes -------------------------------------------

	differential(
		"names-order-sequence",
		`
			const steps = [];
			const el = html("img");
			const step = (label, fn) => { fn(); steps.push([label, el.getAttributeNames(), listed(el)]); };
			step("id", () => el.setAttribute("id", "i"));
			step("src", () => el.setAttribute("src", "a.png"));
			step("nonce", () => el.setAttribute("nonce", "n"));
			step("class", () => el.setAttribute("class", "c"));
			step("style", () => el.setAttribute("style", "color: red"));
			step("onload", () => el.setAttribute("onload", "void 0"));
			step("srcset", () => el.setAttribute("srcset", "b.png 2x"));
			step("re-src", () => el.setAttribute("src", "b.png"));
			step("re-nonce", () => el.setAttribute("nonce", "m"));
			step("rm-src", () => el.removeAttribute("src"));
			step("add-src", () => el.setAttribute("src", "c.png"));
			step("rm-nonce", () => el.removeAttribute("nonce"));
			step("toggle-nonce", () => el.toggleAttribute("nonce"));
			step("rm-id", () => el.removeAttribute("id"));
			step("idl-src", () => { el.src = "d.png"; });
			step("idl-style", () => { el.style.color = "blue"; });
			step("rm-style", () => el.removeAttribute("style"));
			step("style-cssom", () => { el.style.color = "green"; });
			step("title", () => el.setAttribute("title", "t"));
			return steps;
		`
	),
	differential(
		"names-order-iframe-and-script",
		`
			const f = html("iframe");
			for (const [n, v] of [["name", "n"], ["sandbox", "allow-scripts"], ["src", "f.html"], ["csp", "c"], ["srcdoc", "<b>"], ["allow", "fullscreen"], ["credentialless", ""], ["loading", "lazy"]]) f.setAttribute(n, v);
			const s = html("script");
			for (const [n, v] of [["type", "module"], ["integrity", "sha384-x"], ["src", "m.js"], ["nonce", "n"], ["crossorigin", ""], ["async", ""]]) s.setAttribute(n, v);
			const before = [state(f), state(s)];
			f.removeAttribute("sandbox");
			f.setAttribute("sandbox", "");
			s.removeAttribute("integrity");
			s.setAttribute("integrity", "sha384-y");
			return { before, after: [state(f), state(s)] };
		`
	),
	differential(
		"has-attributes-only-stripped",
		`
			const out = {};
			for (const [tag, attr] of [["div", "nonce"], ["iframe", "sandbox"], ["iframe", "csp"], ["iframe", "credentialless"], ["script", "integrity"], ["img", "src"]]) {
				const el = html(tag);
				const empty = el.hasAttributes();
				el.setAttribute(attr, "v");
				const set = [el.hasAttributes(), state(el)];
				el.removeAttribute(attr);
				out[tag + "@" + attr] = [empty, set, el.hasAttributes(), state(el)];
			}
			return out;
		`
	),

	// --- el.attributes -------------------------------------------------------

	differential(
		"map-indexed-and-named",
		`
			const img = html("img");
			img.setAttribute("id", "i");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			img.setAttribute("style", "color: red");
			const m = img.attributes;
			return {
				length: m.length,
				items: [0, 1, 2, 3, 4, -1, 4294967296].map((i) => attrInfo(m.item(i))),
				index: ["0", "1", "2", "3", "4", "-1", "01", "1.0", "4294967295"].map((k) => attrInfo(m[k])),
				named: ["id", "src", "nonce", "style", "SRC", "missing"].map((k) => attrInfo(m[k])),
				has: ["0", "3", "4", "src", "nonce", "SRC", "length", "item", "missing"].map((k) => k in m),
				proto: [m instanceof NamedNodeMap, Object.prototype.toString.call(m), Object.getPrototypeOf(m) === NamedNodeMap.prototype, m.constructor === NamedNodeMap, typeof m[Symbol.iterator]],
			};
		`
	),
	differential(
		"map-enumeration",
		`
			const img = html("img");
			img.setAttribute("id", "i");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			img.setAttribute("onload", "void 0");
			const m = img.attributes;
			const forIn = [];
			for (const k in m) forIn.push(k);
			return {
				keys: Object.keys(m),
				names: Object.getOwnPropertyNames(m),
				own: Reflect.ownKeys(m).map(String),
				forIn,
				values: Object.values(m).map((a) => a.name),
				entries: Object.entries(m).map(([k, a]) => [k, a.value]),
				arrayFrom: Array.from(m, (a) => [a.name, a.value]),
				spread: [...m].map((a) => a.name),
				iterator: Array.from(m[Symbol.iterator](), (a) => a.name),
				assign: Object.keys(Object.assign({}, m)),
				json: JSON.stringify(m),
			};
		`
	),
	differential(
		"map-descriptors",
		`
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			const m = img.attributes;
			const d = (k) => {
				const x = Object.getOwnPropertyDescriptor(m, k);
				return x === undefined ? "undefined" : { value: x.value && x.value.name, writable: x.writable, enumerable: x.enumerable, configurable: x.configurable, get: typeof x.get };
			};
			return {
				"0": d("0"), "1": d("1"), "2": d("2"),
				src: d("src"), nonce: d("nonce"), length: d("length"), item: d("item"), missing: d("missing"),
				hasOwn: ["0", "1", "2", "src", "nonce", "length"].map((k) => Object.prototype.hasOwnProperty.call(m, k)),
				propertyIsEnumerable: ["0", "src", "nonce"].map((k) => Object.prototype.propertyIsEnumerable.call(m, k)),
				lengthGetter: typeof Object.getOwnPropertyDescriptor(NamedNodeMap.prototype, "length").get,
				extensible: Object.isExtensible(m),
			};
		`
	),
	differential(
		"map-sameobject-and-liveness",
		`
			const img = html("img");
			const m = img.attributes;
			const out = [m === img.attributes, m.length];
			img.setAttribute("src", "a.png");
			out.push(m === img.attributes, m.length, m[0] && m[0].value, m.src && m.src.value);
			img.setAttribute("nonce", "n");
			out.push(m.length, m[1] && m[1].name, m.nonce && m.nonce.value);
			img.removeAttribute("src");
			out.push(m.length, m[0] && m[0].name, m.src === undefined, "src" in m);
			img.removeAttribute("nonce");
			out.push(m.length, m[0] === undefined, Object.keys(m));
			const clone = img.cloneNode();
			out.push(clone.attributes === m, clone.attributes === clone.attributes);
			return out;
		`
	),
	differential(
		"map-method-borrowing",
		`
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			const m = img.attributes;
			const P = NamedNodeMap.prototype;
			const lengthGet = Object.getOwnPropertyDescriptor(P, "length").get;
			return {
				identity: ["item", "getNamedItem", "getNamedItemNS", "setNamedItem", "setNamedItemNS", "removeNamedItem", "removeNamedItemNS"].map((k) => m[k] === P[k]),
				item: attrInfo(P.item.call(m, 1)),
				named: attrInfo(P.getNamedItem.call(m, "src")),
				namedNS: attrInfo(P.getNamedItemNS.call(m, null, "nonce")),
				length: lengthGet.call(m),
				bound: attrInfo(m.item.bind(m)(0)),
				reflect: attrInfo(Reflect.apply(P.getNamedItem, m, ["nonce"])),
				badReceivers: [{}, img, null, document.createElement("div").attributes].map((r) => attempt(() => { const x = P.item.call(r, 0); return x === null ? null : x.name; })),
				badLength: [{}, img].map((r) => attempt(() => lengthGet.call(r))),
				fnNames: [P.item.name, P.item.length, P.getNamedItemNS.length, P.setNamedItem.length, lengthGet.name],
			};
		`
	),
	differential(
		"map-attributes-named-like-members",
		`
			const d = html("div");
			for (const n of ["length", "item", "0", "01", "getNamedItem", "constructor", "__proto__", "toString", "src", "nonce", "1e0"]) d.setAttribute(n, "v-" + n);
			const m = d.attributes;
			return {
				length: [typeof m.length, m.length],
				item: typeof m.item,
				getNamedItem: typeof m.getNamedItem,
				toString: typeof m.toString,
				constructor: m.constructor === NamedNodeMap,
				proto: Object.getPrototypeOf(m) === NamedNodeMap.prototype,
				zero: attrInfo(m["0"]),
				zeroNamed: attrInfo(m.getNamedItem("0")),
				"01": attrInfo(m["01"]),
				"1e0": attrInfo(m["1e0"]),
				nonce: attrInfo(m.nonce),
				names: Object.getOwnPropertyNames(m),
				keys: Object.keys(m),
				has: ["length", "item", "01", "1e0", "__proto__", "nonce"].map((k) => [k, Object.prototype.hasOwnProperty.call(m, k)]),
			};
		`
	),
	// named access is exact: an HTML element's lowercased names are its
	// supported property names, and a differently-cased key is not one
	differential(
		"map-named-access-case",
		`
			const d = html("div");
			d.setAttribute("id", "x");
			d.setAttribute("nonce", "n");
			d.setAttributeNS(null, "FOO", "upper");
			const s = svg("svg");
			s.setAttribute("viewBox", "0 0 1 1");
			const out = {};
			for (const [el, k] of [[d, "id"], [d, "ID"], [d, "Id"], [d, "NONCE"], [d, "FOO"], [d, "foo"], [s, "viewBox"], [s, "viewbox"]]) {
				out[el.localName + " " + k] = [attrInfo(el.attributes[k]), k in el.attributes, Object.getOwnPropertyDescriptor(el.attributes, k) !== undefined, attrInfo(el.attributes.getNamedItem(k))];
			}
			out.names = [Object.getOwnPropertyNames(d.attributes), Object.getOwnPropertyNames(s.attributes)];
			return out;
		`
	),
	differential(
		"map-strict-writes-and-deletes",
		`
			return (function () {
			"use strict";
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			const m = img.attributes;
			const strict = (fn) => attempt(() => { fn(); return "ok"; });
			return {
				index: strict(() => { m[0] = 1; }),
				indexNew: strict(() => { m[5] = 1; }),
				named: strict(() => { m.src = 1; }),
				namedStripped: strict(() => { m.nonce = 1; }),
				expando: strict(() => { m.elattrExpando = 1; }),
				expandoRead: m.elattrExpando,
				delIndex: strict(() => { delete m[0]; }),
				delNamed: strict(() => { delete m.src; }),
				delStripped: strict(() => { delete m.nonce; }),
				define: attempt(() => { Object.defineProperty(m, "src", { value: 1 }); return "ok"; }),
				defineIndex: attempt(() => { Object.defineProperty(m, "0", { value: 1 }); return "ok"; }),
				after: [m.length, attrInfo(m[0]), attrInfo(m.src), attrInfo(m.nonce), Object.keys(m)],
			};
			})();
		`
	),
	differential(
		"map-named-item-methods",
		`
			const out = {};
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			const m = img.attributes;
			out.get = [attrInfo(m.getNamedItem("src")), attrInfo(m.getNamedItem("SRC")), attrInfo(m.getNamedItem("nonce")), attrInfo(m.getNamedItemNS(null, "src")), attrInfo(m.getNamedItemNS("urn:x", "src"))];
			const a = document.createAttribute("src");
			a.value = "b.png";
			const old = m.setNamedItem(a);
			out.set = [attrInfo(old), attrInfo(a), probe(img, "src"), img.src, state(img)];
			const n = document.createAttributeNS(null, "nonce");
			n.value = "m";
			const oldNonce = m.setNamedItemNS(n);
			out.setNS = [attrInfo(oldNonce), attrInfo(n), probe(img, "nonce"), img.nonce, state(img)];
			out.same = attempt(() => m.setNamedItem(img.getAttributeNode("src")) === img.getAttributeNode("src"));
			const other = html("img");
			other.setAttribute("src", "o.png");
			out.inUse = attempt(() => m.setNamedItem(other.getAttributeNode("src")));
			out.inUseNS = attempt(() => m.setNamedItemNS(other.getAttributeNode("src")));
			out.afterInUse = [probe(img, "src"), probe(other, "src")];
			const removed = m.removeNamedItem("src");
			out.removed = [attrInfo(removed), probe(img, "src"), state(img)];
			const removedNonce = m.removeNamedItemNS(null, "nonce");
			out.removedNonce = [attrInfo(removedNonce), probe(img, "nonce"), img.nonce, state(img)];
			out.missing = [attempt(() => m.removeNamedItem("src")), attempt(() => m.removeNamedItemNS(null, "nonce")), attempt(() => m.removeNamedItem("")), attempt(() => m.removeNamedItemNS("urn:x", "src"))];
			out.badArgs = [attempt(() => m.setNamedItem(null)), attempt(() => m.setNamedItem("src")), attempt(() => m.setNamedItem(html("div")))];
			return out;
		`
	),
	differential(
		"map-empty-element",
		`
			const d = html("div");
			const m = d.attributes;
			return {
				length: m.length,
				item: m.item(0),
				idx: m[0] === undefined,
				keys: Object.getOwnPropertyNames(m),
				named: m.getNamedItem("x"),
				remove: attempt(() => m.removeNamedItem("x")),
				setThenRead: (() => { const a = document.createAttribute("nonce"); a.value = "v"; m.setNamedItem(a); return [m.length, attrInfo(m[0]), d.nonce, state(d)]; })(),
			};
		`
	),

	// --- Attr nodes -----------------------------------------------------------

	differential(
		"attr-node-fields",
		`
			const out = {};
			const specs = [
				[html("img"), "src", "a.png"],
				[html("img"), "srcset", "a.png 2x"],
				[html("div"), "nonce", "n"],
				[html("div"), "style", "background: url(a.png)"],
				[html("div"), "onclick", "void 0"],
				[html("iframe"), "sandbox", "allow-forms"],
				[html("script"), "integrity", "sha384-x"],
				[html("iframe"), "srcdoc", "<i>x</i>"],
				[html("a"), "target", "_top"],
				[svg("use"), "href", "#u"],
			];
			const host = html("div");
			document.body.append(host);
			try {
				for (const [el, n, v] of specs) {
					el.setAttribute(n, v);
					host.append(el);
					const a = el.getAttributeNode(n);
					out[el.localName + "@" + n] = {
						info: attrInfo(a),
						nodeType: a.nodeType,
						isConnected: a.isConnected,
						ownerDocument: a.ownerDocument === document,
						parentNode: a.parentNode,
						childNodes: a.childNodes.length,
						hasChildNodes: a.hasChildNodes(),
						firstChild: a.firstChild,
						baseURI: a.baseURI === document.baseURI,
						str: Object.prototype.toString.call(a),
						lookupNS: a.lookupNamespaceURI(null),
					};
				}
			} finally {
				host.remove();
			}
			return out;
		`
	),
	differential(
		"attr-node-identity",
		`
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("nonce", "n");
			const out = {};
			for (const n of ["src", "nonce"]) {
				const a = img.getAttributeNode(n);
				out[n] = [
					a === img.getAttributeNode(n),
					a === img.getAttributeNodeNS(null, n),
					a === img.attributes.getNamedItem(n),
					a === img.attributes[n],
					a === img.attributes.getNamedItemNS(null, n),
					a === Array.from(img.attributes).find((x) => x.name === n),
				];
				img.setAttribute(n, "changed");
				out[n].push(a === img.getAttributeNode(n), a.value, a.ownerElement === img);
			}
			return out;
		`
	),
	differential(
		"attr-value-writes-attached",
		`
			const out = {};
			for (const [tag, n, v1, v2] of [["img", "src", "a.png", "b.png"], ["a", "href", "x", "https://example.test/y"], ["div", "style", "color: red", "background: url(b.png)"], ["link", "href", "a.css", "b.css"]]) {
				for (const via of ["value", "nodeValue", "textContent"]) {
					const el = html(tag);
					el.setAttribute(n, v1);
					const a = el.getAttributeNode(n);
					a[via] = v2;
					out[tag + "@" + n + " " + via] = [attrInfo(a), probe(el, n), state(el), n === "style" ? el.style.cssText : el[n]];
				}
			}
			return out;
		`
	),
	// a stripped attribute is represented by its mirror's node; writing that
	// node is writing the attribute, change steps and all
	differential(
		"attr-value-writes-stripped",
		`
			const s = html("script");
			s.setAttribute("nonce", "one");
			const a = s.getAttributeNode("nonce");
			a.value = "two";
			const nonce = [attrInfo(a), probe(s, "nonce"), s.nonce, state(s)];
			const f = html("iframe");
			f.setAttribute("sandbox", "allow-scripts");
			const list = f.sandbox;
			const b = f.getAttributeNode("sandbox");
			b.value = "allow-forms allow-popups";
			const sandbox = [attrInfo(b), probe(f, "sandbox"), list.value, list.length, list.contains("allow-scripts"), f.sandbox === list];
			const g = html("iframe");
			g.setAttribute("sandbox", "");
			g.getAttributeNode("sandbox").textContent = "allow-modals";
			return { nonce, sandbox, textContent: [probe(g, "sandbox"), g.sandbox.value] };
		`
	),
	differential(
		"attr-detached-created",
		`
			const out = {};
			for (const [tag, n, v] of [["img", "src", "a.png"], ["div", "nonce", "n"], ["div", "style", "color: red"], ["iframe", "sandbox", "allow-scripts"], ["script", "integrity", "sha384-x"], ["a", "target", "_top"], ["div", "onclick", "void 0"]]) {
				const el = html(tag);
				const a = document.createAttribute(n);
				a.value = v;
				const before = attrInfo(a);
				const ret = el.setAttributeNode(a);
				const after = [ret, attrInfo(a), a === el.getAttributeNode(n), probe(el, n), state(el)];
				a.value = v + "2";
				out[tag + "@" + n] = { before, after, rewritten: [attrInfo(a), probe(el, n)] };
			}
			return out;
		`
	),
	differential(
		"attr-createattribute-names",
		`
			const out = {};
			for (const n of ["SRC", "Src", "onClick", "NONCE"]) {
				const a = document.createAttribute(n);
				a.value = "v.png";
				const img = html("img");
				img.setAttributeNode(a);
				const use = svg("use");
				const b = document.createAttribute(n);
				b.value = "v.png";
				use.setAttributeNode(b);
				out[n] = [attrInfo(a), state(img), probe(img, n.toLowerCase()), attrInfo(b), state(use)];
			}
			const xdoc = document.implementation.createDocument(null, "root");
			const x = xdoc.createAttribute("SRC");
			out.xml = attrInfo(x);
			return out;
		`
	),
	differential(
		"attr-createattributens",
		`
			const out = {};
			const use = svg("use");
			const a = document.createAttributeNS(XLINK, "xlink:href");
			a.value = "u.svg#x";
			out.xlinkRet = use.setAttributeNodeNS(a);
			out.xlink = [attrInfo(a), use.getAttributeNS(XLINK, "href"), probe(use, "xlink:href"), state(use), use.href.baseVal];
			const b = document.createAttributeNS(XLINK, "l:href");
			b.value = "v.svg#y";
			const replaced = use.setAttributeNodeNS(b);
			out.replaced = [attrInfo(replaced), attrInfo(b), use.getAttributeNS(XLINK, "href"), state(use), use.href.baseVal];
			const img = html("img");
			const c = document.createAttributeNS(null, "src");
			c.value = "c.png";
			img.setAttributeNodeNS(c);
			const d = document.createAttributeNS("urn:x", "p:src");
			d.value = "d.png";
			img.setAttributeNodeNS(d);
			out.img = [attrInfo(c), attrInfo(d), probe(img, "src"), state(img), img.src];
			out.errors = [attempt(() => document.createAttributeNS(null, "a:b")), attempt(() => document.createAttributeNS(XMLNS, "x")), attempt(() => document.createAttributeNS("urn:x", "xmlns:y"))];
			return out;
		`
	),
	// the node a replacement hands back is detached, and carries the value it
	// had - the page's
	differential(
		"attr-setattributenode-replaces",
		`
			const out = {};
			for (const [tag, n, v1, v2] of [["img", "src", "old.png", "new.png"], ["div", "nonce", "old", "new"], ["div", "style", "color: red", "background: url(new.png)"], ["iframe", "sandbox", "allow-forms", "allow-scripts"], ["script", "integrity", "sha384-old", "sha384-new"], ["div", "onclick", "void 1", "void 2"], ["a", "target", "_top", "_parent"], ["div", "title", "old", "new"]]) {
				const el = html(tag);
				el.setAttribute(n, v1);
				const held = el.getAttributeNode(n);
				const a = document.createAttribute(n);
				a.value = v2;
				const old = el.setAttributeNode(a);
				out[tag + "@" + n] = {
					same: old === held,
					old: attrInfo(old),
					oldClone: old && attrInfo(old.cloneNode()),
					now: probe(el, n),
					state: state(el),
				};
			}
			return out;
		`
	),
	differential(
		"attr-removeattributenode",
		`
			const out = {};
			for (const [tag, n, v] of [["img", "src", "a.png"], ["div", "nonce", "n"], ["div", "style", "background: url(a.png)"], ["iframe", "sandbox", "allow-forms"], ["script", "integrity", "sha384-x"], ["a", "href", "https://example.test/"], ["div", "onclick", "void 0"]]) {
				const el = html(tag);
				el.setAttribute(n, v);
				el.setAttribute("id", "i");
				const a = el.getAttributeNode(n);
				const r = el.removeAttributeNode(a);
				out[tag + "@" + n] = {
					same: r === a,
					removed: attrInfo(r),
					el: [probe(el, n), state(el)],
					again: attempt(() => el.removeAttributeNode(a)),
					otherElement: attempt(() => html(tag).removeAttributeNode(el.getAttributeNode("id"))),
				};
			}
			const d = html("div");
			out.badArgs = [attempt(() => d.removeAttributeNode(null)), attempt(() => d.removeAttributeNode({})), attempt(() => d.removeAttributeNode(document.createAttribute("x")))];
			return out;
		`
	),
	// an Attr the page is still holding when the attribute goes away by name
	differential(
		"attr-held-after-removal",
		`
			const out = {};
			for (const [tag, n, v] of [["img", "src", "a.png"], ["div", "nonce", "n"], ["div", "style", "background: url(a.png)"], ["a", "href", "rel/x"], ["iframe", "srcdoc", "<b onclick=x()>"]]) {
				for (const via of ["removeAttribute", "removeAttributeNS", "toggleAttribute", "removeNamedItem"]) {
					const el = html(tag);
					el.setAttribute(n, v);
					const a = el.getAttributeNode(n);
					if (via === "removeAttribute") el.removeAttribute(n);
					else if (via === "removeAttributeNS") el.removeAttributeNS(null, n);
					else if (via === "toggleAttribute") el.toggleAttribute(n);
					else el.attributes.removeNamedItem(n);
					out[tag + "@" + n + " " + via] = [attrInfo(a), attrInfo(a.cloneNode()), state(el)];
				}
			}
			return out;
		`
	),
	// moved from one element to another, the value is still the page's -
	// including onto an element the rule does not cover
	differential(
		"attr-moved-between-elements",
		`
			const out = {};
			for (const [from, to, n, v] of [["img", "img", "src", "a.png"], ["img", "div", "src", "a.png"], ["div", "span", "src", "a.png"], ["a", "link", "href", "x.css"], ["div", "p", "nonce", "n"], ["div", "p", "style", "background: url(a.png)"], ["iframe", "div", "sandbox", "allow-forms"], ["iframe", "iframe", "sandbox", "allow-forms"], ["div", "p", "onclick", "void 0"]]) {
				const a = html(from);
				const b = html(to);
				a.setAttribute(n, v);
				const node = a.removeAttributeNode(a.getAttributeNode(n));
				const ret = b.setAttributeNode(node);
				out[from + ">" + to + "@" + n] = [ret, attrInfo(node), node === b.getAttributeNode(n), probe(b, n), state(b), state(a)];
			}
			return out;
		`
	),
	differential(
		"attr-clone-and-equality",
		`
			const out = {};
			for (const [tag, n, v] of [["img", "src", "a.png"], ["div", "nonce", "n"], ["div", "style", "background: url(a.png)"], ["div", "onclick", "void 0"], ["iframe", "sandbox", "allow-forms"], ["script", "integrity", "sha384-x"], ["div", "title", "t"]]) {
				const el = html(tag);
				el.setAttribute(n, v);
				const a = el.getAttributeNode(n);
				const fresh = document.createAttribute(n);
				fresh.value = v;
				const twin = html(tag);
				twin.setAttribute(n, v);
				const c = a.cloneNode(true);
				out[tag + "@" + n] = {
					clone: attrInfo(c),
					cloneEqual: c.isEqualNode(a),
					freshEqual: a.isEqualNode(fresh),
					twinEqual: a.isEqualNode(twin.getAttributeNode(n)),
					sameNode: a.isSameNode(el.getAttributeNode(n)),
					elEqual: el.isEqualNode(twin),
					imported: attrInfo(document.importNode(a)),
				};
			}
			return out;
		`
	),
	differential(
		"attr-other-document",
		`
			const doc = document.implementation.createHTMLDocument("x");
			const out = {};
			const a = doc.createAttribute("src");
			a.value = "other.png";
			const img = html("img");
			out.ret = img.setAttributeNode(a);
			out.adopted = [attrInfo(a), a.ownerDocument === document, probe(img, "src"), img.src];
			const foreign = doc.createElement("img");
			foreign.setAttribute("src", "f.png");
			foreign.setAttribute("nonce", "n");
			out.foreign = [probe(foreign, "src"), probe(foreign, "nonce"), foreign.nonce, state(foreign)];
			const moved = foreign.removeAttributeNode(foreign.getAttributeNode("src"));
			img.setAttributeNode(moved);
			out.moved = [attrInfo(moved), probe(img, "src"), state(img)];
			return out;
		`
	),

	// --- toggleAttribute ----------------------------------------------------

	differential(
		"toggleattribute-returns",
		`
			const out = {};
			for (const [kind, tag, n] of [["html", "img", "src"], ["html", "div", "nonce"], ["html", "iframe", "sandbox"], ["html", "div", "onclick"], ["html", "div", "style"], ["html", "div", "hidden"], ["html", "script", "integrity"], ["html", "iframe", "srcdoc"], ["svg", "svg", "viewBox"], ["svg", "use", "href"], ["html", "a", "target"]]) {
				const el = kind === "svg" ? svg(tag) : html(tag);
				const steps = [];
				for (const force of [undefined, undefined, true, true, false, false, true, undefined]) {
					const r = force === undefined ? el.toggleAttribute(n) : el.toggleAttribute(n, force);
					steps.push([force === undefined ? "none" : force, r, el.getAttribute(n), el.hasAttribute(n), el.getAttributeNames()]);
				}
				el.setAttribute(n, "x");
				steps.push(["over value", el.toggleAttribute(n, true), el.getAttribute(n)]);
				steps.push(["remove", el.toggleAttribute(n), el.getAttribute(n), state(el)]);
				out[tag + "@" + n] = steps;
			}
			const d = html("div");
			out.coercion = [d.toggleAttribute("x", 0), d.toggleAttribute("x", 1), d.toggleAttribute("x", "") , d.toggleAttribute("x", null), d.toggleAttribute("x", undefined), d.getAttributeNames()];
			out.caseFold = [d.toggleAttribute("NONCE"), d.getAttributeNames(), d.nonce, d.toggleAttribute("Nonce"), d.getAttributeNames()];
			return out;
		`
	),

	// --- MutationObserver -----------------------------------------------------

	differential(
		"mutation-records-setattribute",
		`
			const out = {};
			for (const [tag, n, v1, v2] of [["img", "src", "a.png", "b.png"], ["div", "nonce", "a", "b"], ["div", "style", "color: red", "background: url(b.png)"], ["div", "onclick", "void 1", "void 2"], ["iframe", "sandbox", "allow-forms", "allow-scripts"], ["script", "integrity", "sha384-a", "sha384-b"], ["a", "target", "_top", "_blank"], ["div", "title", "a", "b"]]) {
				const el = html(tag);
				const mo = new MutationObserver(() => {});
				mo.observe(el, { attributes: true, attributeOldValue: true });
				const steps = [];
				el.setAttribute(n, v1);
				steps.push(records(mo));
				el.setAttribute(n, v2);
				steps.push(records(mo));
				el.setAttribute(n, v2);
				steps.push(records(mo));
				el.removeAttribute(n);
				steps.push(records(mo));
				el.removeAttribute(n);
				steps.push(records(mo));
				el.toggleAttribute(n);
				steps.push(records(mo));
				mo.disconnect();
				out[tag + "@" + n] = steps;
			}
			return out;
		`
	),
	differential(
		"mutation-records-filtered",
		`
			const img = html("img");
			const mo = new MutationObserver(() => {});
			mo.observe(img, { attributeFilter: ["src", "nonce", "style"], attributeOldValue: true });
			const steps = [];
			img.setAttribute("src", "a.png");
			img.setAttribute("src", "https://example.test/b.png");
			img.src = "c.png";
			steps.push(records(mo));
			img.setAttribute("nonce", "n1");
			img.setAttribute("nonce", "n2");
			img.nonce = "idl";
			steps.push(records(mo));
			img.setAttribute("style", "background: url(a.png)");
			img.style.color = "red";
			steps.push(records(mo));
			img.setAttribute("id", "ignored");
			img.removeAttribute("src");
			steps.push(records(mo));
			mo.disconnect();
			return steps;
		`
	),
	differential(
		"mutation-records-other-routes",
		`
			const use = svg("use");
			const img = html("img");
			const mo = new MutationObserver(() => {});
			mo.observe(use, { attributes: true, attributeOldValue: true });
			mo.observe(img, { attributes: true, attributeOldValue: true });
			const steps = [];
			use.setAttributeNS(XLINK, "xlink:href", "a.svg#x");
			use.setAttributeNS(XLINK, "xlink:href", "b.svg#x");
			use.removeAttributeNS(XLINK, "href");
			steps.push(records(mo));
			const a = document.createAttribute("src");
			a.value = "a.png";
			img.setAttributeNode(a);
			a.value = "b.png";
			steps.push(records(mo));
			img.removeAttributeNode(a);
			steps.push(records(mo));
			const n = document.createAttribute("nonce");
			n.value = "x";
			img.attributes.setNamedItem(n);
			img.attributes.removeNamedItem("nonce");
			steps.push(records(mo));
			mo.disconnect();
			return steps;
		`
	),
	differential(
		"mutation-records-subtree-innerhtml",
		`
			const host = html("div");
			const mo = new MutationObserver(() => {});
			mo.observe(host, { attributes: true, subtree: true, attributeOldValue: true, childList: true });
			host.innerHTML = '<img src="a.png" nonce="n"><a href="x" target="_top">x</a>';
			const first = mo.takeRecords().map((r) => [r.type, r.attributeName, r.addedNodes.length]);
			host.firstChild.setAttribute("src", "b.png");
			host.lastChild.setAttribute("target", "_parent");
			return [first, records(mo)];
		`
	),

	// --- custom elements ------------------------------------------------------

	differential(
		"custom-element-callbacks",
		`
			const calls = [];
			class El extends HTMLElement {
				static get observedAttributes() { return ["src", "href", "onclick", "style", "nonce", "sandbox", "integrity", "data-x", "scramjet-attr-src"]; }
				attributeChangedCallback(n, o, v) { calls.push([n, o, v]); }
			}
			customElements.define("elattr-plain-el", El);
			const el = document.createElement("elattr-plain-el");
			el.setAttribute("src", "a.png");
			el.setAttribute("href", "x");
			el.setAttribute("onclick", "void 0");
			el.setAttribute("style", "background: url(a.png)");
			el.setAttribute("nonce", "n");
			el.setAttribute("data-x", "1");
			el.setAttribute("style", "color: red");
			el.style.color = "blue";
			el.removeAttribute("nonce");
			el.removeAttribute("style");
			el.toggleAttribute("onclick");
			return calls;
		`
	),
	differential(
		"custom-element-builtin-img",
		`
			const calls = [];
			class Img extends HTMLImageElement {
				static get observedAttributes() { return ["src", "srcset", "nonce", "style", "onload"]; }
				attributeChangedCallback(n, o, v) { calls.push([n, o, v]); }
			}
			customElements.define("elattr-builtin-img", Img, { extends: "img" });
			const img = document.createElement("img", { is: "elattr-builtin-img" });
			img.setAttribute("src", "a.png");
			img.setAttribute("src", "https://example.test/b.png");
			img.src = "c.png";
			img.setAttribute("srcset", "d.png 2x");
			img.setAttribute("nonce", "n");
			img.setAttribute("onload", "void 0");
			const a = document.createAttribute("src");
			a.value = "e.png";
			img.setAttributeNode(a);
			img.removeAttribute("src");
			return [calls, img instanceof Img, state(img)];
		`
	),
	differential(
		"custom-element-parsed-upgrade",
		`
			const calls = [];
			const host = html("div");
			host.innerHTML = '<elattr-late-el src="a.png" style="background:url(a.png)" nonce="n" onclick="void 0" data-y="2"></elattr-late-el>';
			customElements.define("elattr-late-el", class extends HTMLElement {
				static get observedAttributes() { return ["src", "style", "nonce", "onclick", "data-y"]; }
				attributeChangedCallback(n, o, v) { calls.push([n, o, v]); }
			});
			customElements.upgrade(host);
			return [calls, state(host.firstChild)];
		`
	),

	// --- selectors ------------------------------------------------------------

	differential(
		"selectors-see-page-values",
		`
			const host = html("div");
			const img = html("img");
			img.setAttribute("src", "a.png");
			img.setAttribute("srcset", "a.png 2x");
			const a = html("a");
			a.setAttribute("href", "https://example.test/x");
			a.setAttribute("target", "_top");
			const s = html("script");
			s.setAttribute("nonce", "n1");
			s.setAttribute("integrity", "sha384-abc");
			const f = html("iframe");
			f.setAttribute("sandbox", "allow-scripts allow-forms");
			const d = html("div");
			d.setAttribute("style", "color: red");
			d.setAttribute("onclick", "go()");
			host.append(img, a, s, f, d);
			const sels = ['[src="a.png"]', '[src$="a.png"]', '[src^="http"]', '[srcset="a.png 2x"]', 'a[href^="https"]', 'a[href="https://example.test/x"]', '[target="_top"]', '[target]', '[nonce]', '[nonce="n1"]', 'script:not([nonce])', '[integrity="sha384-abc"]', '[integrity=""]', '[sandbox~="allow-scripts"]', 'iframe[sandbox]', 'iframe:not([sandbox])', '[style*="red"]', '[style="color: red"]', '[onclick="go()"]', '[onclick*="go"]'];
			const out = {};
			for (const sel of sels) out[sel] = [host.querySelectorAll(sel).length, Array.from(host.children, (c) => c.matches(sel))];
			out.closest = a.closest('[href="https://example.test/x"]') === a;
			return out;
		`
	),

	// --- cloning and adoption -------------------------------------------------

	differential(
		"clone-import-adopt",
		`
			const make = () => {
				const d = html("div");
				d.setAttribute("id", "root");
				d.setAttribute("nonce", "n");
				d.setAttribute("style", "background: url(a.png)");
				d.setAttribute("onclick", "void 0");
				const img = html("img");
				img.setAttribute("src", "a.png");
				img.setAttribute("srcset", "b.png 2x");
				const f = html("iframe");
				f.setAttribute("sandbox", "allow-forms");
				f.setAttribute("srcdoc", "<p>");
				const use = svg("use");
				use.setAttributeNS(XLINK, "xlink:href", "#x");
				d.append(img, f, use);
				return d;
			};
			const snap = (root) => [root, ...root.querySelectorAll("*")].map((e) => [e.localName, state(e)]);
			const src = make();
			const doc = document.implementation.createHTMLDocument("x");
			const imported = doc.importNode(make(), true);
			const adopted = doc.adoptNode(make());
			const back = document.adoptNode(doc.importNode(make(), true));
			return {
				shallow: state(src.cloneNode(false)),
				deep: snap(src.cloneNode(true)),
				imported: snap(imported),
				adopted: snap(adopted),
				back: snap(back),
				equal: [src.isEqualNode(src.cloneNode(true)), src.isEqualNode(imported), src.isEqualNode(make())],
				nonces: [src.cloneNode().nonce, imported.nonce, adopted.nonce],
			};
		`
	),

	// --- serialization --------------------------------------------------------

	differential(
		"serialization-script-set-attributes",
		`
			const els = [];
			const d = html("div");
			for (const [n, v] of [["id", "x"], ["nonce", "n"], ["style", "background: url(a.png)"], ["onclick", "alert('<&>')"], ["data-x", "1"], ["title", 'q"uo<te']]) d.setAttribute(n, v);
			els.push(d);
			const img = html("img");
			for (const [n, v] of [["alt", "a"], ["src", "a b.png"], ["srcset", "b.png 2x, c.png 3x"], ["nonce", "n"]]) img.setAttribute(n, v);
			els.push(img);
			const f = html("iframe");
			for (const [n, v] of [["sandbox", "allow-forms"], ["srcdoc", '<p class="x">&amp;</p>'], ["src", "f.html"], ["csp", "c"]]) f.setAttribute(n, v);
			els.push(f);
			const a = html("a");
			a.setAttribute("target", "_top");
			a.setAttribute("href", "https://example.test/?a=1&b=2");
			els.push(a);
			const s = html("script");
			s.setAttribute("src", "s.js");
			s.setAttribute("integrity", "sha384-x");
			s.setAttribute("nonce", "n");
			els.push(s);
			const m = html("meta");
			m.setAttribute("http-equiv", "refresh");
			m.setAttribute("content", "0;url=next");
			els.push(m);
			const use = svg("use");
			use.setAttributeNS(XLINK, "xlink:href", "u.svg#x");
			use.setAttribute("href", "v.svg#y");
			els.push(use);
			const host = html("section");
			host.append(...els.map((e) => e.cloneNode(true)));
			return {
				outer: els.map((e) => e.outerHTML),
				inner: host.innerHTML,
				getHTML: host.getHTML(),
				xml: els.map((e) => new XMLSerializer().serializeToString(e)),
			};
		`
	),

	// --- dataset, classList, id, className ------------------------------------

	differential(
		"reflected-string-attributes",
		`
			const d = html("div");
			d.dataset.src = "a.png";
			d.dataset.onclick = "x";
			d.id = "i";
			d.className = "a b";
			d.classList.add("c");
			d.setAttribute("data-nonce", "n");
			const out = [state(d), d.dataset.nonce, Object.keys(d.dataset), d.id, d.className, d.classList.value];
			d.setAttribute("class", "z");
			d.setAttribute("ID", "j");
			d.removeAttribute("data-src");
			out.push(state(d), d.className, d.classList.length, d.id, Object.keys(d.dataset));
			return out;
		`
	),

	// --- event handler attributes ---------------------------------------------

	differential(
		"onclick-attribute-behaviour",
		`
			window.__elattrClicks = 0;
			const out = {};
			for (const [kind, tag] of [["html", "div"], ["svg", "rect"], ["math", "mi"]]) {
				const el = kind === "svg" ? svg(tag) : kind === "math" ? math(tag) : html(tag);
				el.setAttribute("onclick", "window.__elattrClicks++; window.__elattrThis = this === event.currentTarget; return 1");
				const t = typeof el.onclick;
				const before = window.__elattrClicks;
				el.dispatchEvent(new MouseEvent("click"));
				const ran = window.__elattrClicks - before;
				out[tag] = { t, ran, self: window.__elattrThis, name: el.onclick && el.onclick.name, len: el.onclick && el.onclick.length, str: String(el.onclick), attr: el.getAttribute("onclick") };
				el.removeAttribute("onclick");
				out[tag].removed = [el.onclick, el.getAttribute("onclick")];
				el.dispatchEvent(new MouseEvent("click"));
				out[tag].ranAfterRemove = window.__elattrClicks - before;
			}
			return out;
		`
	),
	differential(
		"onclick-attribute-sees-site",
		`
			const d = html("div");
			d.setAttribute("onclick", "window.__elattrSeen = [location.href, document.URL, origin, top === window, document.domain]");
			d.click();
			return window.__elattrSeen;
		`
	),
	differential(
		"onclick-idl-and-attribute-interplay",
		`
			const d = html("div");
			window.__elattrLog = [];
			d.setAttribute("onclick", "__elattrLog.push('attr')");
			d.click();
			const fn = () => __elattrLog.push("idl");
			d.onclick = fn;
			const attrAfterIdl = d.getAttribute("onclick");
			d.click();
			d.setAttribute("onclick", "__elattrLog.push('attr2')");
			d.click();
			const replaced = d.onclick === fn;
			d.onclick = null;
			const nulled = [d.getAttribute("onclick"), d.hasAttribute("onclick")];
			d.click();
			d.toggleAttribute("onclick");
			d.toggleAttribute("onclick");
			const toggled = [typeof d.onclick, d.getAttribute("onclick")];
			d.click();
			const a = d.getAttributeNode("onclick");
			a.value = "__elattrLog.push('node')";
			d.click();
			const b = document.createAttribute("onclick");
			b.value = "__elattrLog.push('created')";
			d.setAttributeNode(b);
			d.click();
			d.setAttributeNS(null, "onclick", "__elattrLog.push('ns')");
			d.click();
			return { log: __elattrLog, attrAfterIdl, replaced, nulled, toggled, final: [d.getAttribute("onclick"), String(d.onclick)] };
		`
	),
	differential(
		"event-handler-names-and-errors",
		`
			const d = html("div");
			d.setAttribute("ONMOUSEOVER", "void 0");
			d.setAttribute("onfoo", "void 0");
			d.setAttribute("onerror", "throw new Error('x')");
			d.setAttribute("onblur", "}{ syntax error");
			let errs = [];
			const h = (e) => { errs.push(e.message ? "message" : "none"); e.preventDefault(); };
			window.addEventListener("error", h);
			const blur = typeof d.onblur;
			window.removeEventListener("error", h);
			return {
				state: state(d),
				types: [typeof d.onmouseover, typeof d.onfoo, typeof d.onerror, blur],
				errs: errs.length,
				vals: ["onmouseover", "onfoo", "onerror", "onblur"].map((n) => d.getAttribute(n)),
			};
		`
	),

	// --- style ----------------------------------------------------------------

	differential(
		"style-attribute-and-cssom",
		`
			const steps = [];
			const d = html("div");
			const snap = (label) => steps.push([label, d.getAttribute("style"), d.style.cssText, d.style.color, d.style.backgroundImage, d.style.length, d.hasAttribute("style"), d.getAttributeNames()]);
			d.setAttribute("style", "color:red; background:url(x.png)");
			snap("set");
			d.style.color = "blue";
			snap("color");
			d.style.backgroundImage = "url('https://example.test/y.png')";
			snap("bg");
			d.attributeStyleMap.set("opacity", CSS.number(0.5));
			snap("typedom");
			d.attributeStyleMap.delete("color");
			snap("typedom-delete");
			d.style.cssText = "margin: 1px; background: url(z.png) no-repeat";
			snap("cssText");
			d.style.removeProperty("margin");
			snap("removeProperty");
			d.removeAttribute("style");
			snap("remove");
			d.style.color = "green";
			snap("cssom-after-remove");
			d.setAttribute("style", "");
			snap("empty");
			d.setAttribute("style", "not css at all {");
			snap("garbage");
			return steps;
		`
	),
	differential(
		"style-other-routes",
		`
			const out = {};
			const a = html("div");
			a.setAttribute("style", "color: red");
			a.getAttributeNode("style").value = "background: url(a.png)";
			out.nodeValue = [a.getAttribute("style"), a.style.backgroundImage];
			const b = html("div");
			const n = document.createAttribute("style");
			n.value = "background-image: url(b.png)";
			b.setAttributeNode(n);
			out.setAttributeNode = [b.getAttribute("style"), b.style.backgroundImage, attrInfo(n)];
			const c = svg("rect");
			c.setAttribute("style", "fill: url(#g); stroke: url(p.svg#x)");
			out.svg = [c.getAttribute("style"), c.style.fill, c.style.stroke, state(c)];
			const m = math("mi");
			m.setAttribute("style", "background: url(m.png)");
			out.math = [m.getAttribute("style"), m.style.backgroundImage];
			const e = html("div");
			e.setAttributeNS(null, "style", "background: url(e.png)");
			out.ns = [e.getAttribute("style"), e.style.backgroundImage, e.getAttributeNS(null, "style")];
			const f = html("div");
			f.style.setProperty("--v", "url(v.png)");
			f.toggleAttribute("style");
			out.toggle = [f.getAttribute("style"), f.style.cssText];
			return out;
		`
	),

	// --- iframe sandbox ---------------------------------------------------------

	differential(
		"sandbox-tokenlist",
		`
			const f = html("iframe");
			const steps = [];
			const list = f.sandbox;
			const snap = (label, r) => steps.push([label, r === undefined ? "undefined" : r, f.getAttribute("sandbox"), f.hasAttribute("sandbox"), list.value, String(list), list.length, Array.from(list), list.item(0), f.getAttributeNames()]);
			snap("fresh");
			snap("supports", [list.supports("allow-scripts"), list.supports("allow-top-navigation-to-custom-protocols"), list.supports("bogus"), list.supports("ALLOW-SCRIPTS")]);
			snap("add", list.add("allow-scripts", "allow-forms"));
			snap("add-dup", list.add("allow-scripts"));
			snap("toggle-off", list.toggle("allow-forms"));
			snap("toggle-on", list.toggle("allow-popups"));
			snap("toggle-force", list.toggle("allow-popups", true));
			snap("replace", list.replace("allow-popups", "allow-modals"));
			snap("replace-miss", list.replace("nothing", "allow-same-origin"));
			snap("remove", list.remove("allow-scripts"));
			snap("contains", [list.contains("allow-modals"), list.contains("allow-scripts")]);
			list.value = "allow-a  allow-b\\tallow-a";
			snap("value");
			f.sandbox = "allow-downloads";
			snap("putforwards");
			f.setAttribute("sandbox", "  allow-x   allow-y ");
			snap("setAttribute");
			f.removeAttribute("sandbox");
			snap("removeAttribute");
			f.toggleAttribute("sandbox");
			snap("toggleAttribute");
			f.setAttributeNS(null, "sandbox", "allow-ns");
			snap("setAttributeNS");
			f.removeAttributeNS(null, "sandbox");
			snap("removeAttributeNS");
			snap("errors", [attempt(() => list.add("")), attempt(() => list.add("a b")), attempt(() => list.replace("", "x")), attempt(() => list.toggle(" "))]);
			snap("identity", [f.sandbox === list, list instanceof DOMTokenList, Object.prototype.toString.call(list)]);
			return steps;
		`
	),
	differential(
		"sandbox-clone-and-parse",
		`
			const f = html("iframe");
			f.setAttribute("sandbox", "allow-forms");
			void f.sandbox;
			const c = f.cloneNode();
			const host = html("div");
			host.innerHTML = '<iframe sandbox="allow-scripts allow-popups"></iframe>';
			const p = host.firstChild;
			p.sandbox.remove("allow-popups");
			return {
				clone: [c.getAttribute("sandbox"), c.sandbox.value, state(c)],
				parsed: [p.getAttribute("sandbox"), p.sandbox.value, state(p)],
			};
		`
	),

	// --- nonce ----------------------------------------------------------------

	differential(
		"nonce-content-vs-idl",
		`
			const steps = [];
			const s = html("script");
			const snap = (label) => steps.push([label, s.nonce, s.getAttribute("nonce"), s.hasAttribute("nonce"), s.getAttributeNames(), s.cloneNode().nonce, s.cloneNode().getAttribute("nonce")]);
			snap("fresh");
			s.setAttribute("nonce", "content");
			snap("setAttribute");
			s.nonce = "idl";
			snap("idl");
			s.setAttribute("nonce", "content2");
			snap("setAttribute-again");
			s.removeAttribute("nonce");
			snap("removeAttribute");
			s.nonce = "idl2";
			snap("idl-no-attribute");
			s.toggleAttribute("nonce");
			snap("toggle-on");
			s.setAttributeNS(null, "nonce", "ns");
			snap("setAttributeNS");
			const a = document.createAttribute("nonce");
			a.value = "node";
			s.setAttributeNode(a);
			snap("setAttributeNode");
			s.removeAttributeNode(s.getAttributeNode("nonce"));
			snap("removeAttributeNode");
			const host = html("div");
			host.innerHTML = '<style nonce="parsed"></style>';
			const st = host.firstChild;
			steps.push(["parsed", st.nonce, st.getAttribute("nonce"), st.cloneNode().nonce]);
			const g = svg("script");
			g.setAttribute("nonce", "svg");
			g.nonce = "svg-idl";
			steps.push(["svg", g.nonce, g.getAttribute("nonce"), g.cloneNode().nonce]);
			return steps;
		`
	),

	// --- other documents --------------------------------------------------------

	differential(
		"xml-document-elements",
		`
			const doc = document.implementation.createDocument(null, "root");
			const out = {};
			const h = doc.createElementNS(XHTML, "img");
			h.setAttribute("SRC", "upper.png");
			h.setAttribute("src", "lower.png");
			h.setAttribute("NONCE", "n");
			out.xhtmlImg = [state(h), probe(h, "src"), probe(h, "SRC"), probe(h, "NONCE"), h.src];
			const plain = doc.createElement("img");
			plain.setAttribute("src", "p.png");
			out.nullNsImg = [plain.namespaceURI, state(plain), probe(plain, "src")];
			const s = doc.createElementNS(SVG, "use");
			s.setAttributeNS(XLINK, "xlink:href", "#x");
			out.svg = [state(s), s.getAttributeNS(XLINK, "href")];
			const d = doc.createElementNS(XHTML, "div");
			d.setAttribute("onClick", "void 0");
			d.setAttribute("Style", "color: red");
			out.caseKept = [state(d), d.getAttribute("onclick"), typeof d.onclick];
			return out;
		`
	),
	differential(
		"html-document-from-createhtmldocument",
		`
			const doc = document.implementation.createHTMLDocument("t");
			const img = doc.createElement("img");
			img.setAttribute("SRC", "d.png");
			img.setAttribute("nonce", "n");
			doc.body.append(img);
			doc.body.insertAdjacentHTML("beforeend", '<a href="rel" target="_top">x</a><iframe sandbox="allow-forms" srcdoc="<p>"></iframe>');
			const a = doc.querySelector("a");
			return {
				img: [state(img), probe(img, "src"), img.nonce],
				a: [state(a), a.target],
				iframe: state(doc.querySelector("iframe")),
				body: doc.body.innerHTML,
				selector: [doc.querySelectorAll('[src="d.png"]').length, doc.querySelectorAll('[href="rel"]').length],
			};
		`
	),
	differential(
		"mathml-elements",
		`
			const m = math("math");
			const mi = math("mi");
			m.append(mi);
			for (const [n, v] of [["href", "https://example.test/m"], ["src", "x.png"], ["nonce", "n"], ["style", "background: url(m.png)"], ["onclick", "void 0"], ["mathvariant", "bold"], ["displaystyle", "true"], ["DisplayStyle", "false"]]) mi.setAttribute(n, v);
			return { state: state(mi), nonce: mi.nonce, onclick: typeof mi.onclick, probes: ["href", "src", "nonce", "style", "displaystyle", "DisplayStyle"].map((n) => probe(mi, n)), outer: m.outerHTML };
		`
	),

	// --- the IDL wrappers themselves -------------------------------------------

	differential(
		"member-shapes",
		`
			const P = Element.prototype;
			const names = ["getAttribute", "getAttributeNS", "setAttribute", "setAttributeNS", "removeAttribute", "removeAttributeNS", "toggleAttribute", "hasAttribute", "hasAttributeNS", "hasAttributes", "getAttributeNames", "getAttributeNode", "getAttributeNodeNS", "setAttributeNode", "setAttributeNodeNS", "removeAttributeNode"];
			const d = html("div");
			return {
				shape: names.map((n) => [n, typeof P[n], P[n].name, P[n].length, Object.getOwnPropertyDescriptor(P, n).enumerable]),
				attributesGetter: (() => { const x = Object.getOwnPropertyDescriptor(P, "attributes"); return [typeof x.get, x.set, x.get.name, x.enumerable, x.configurable]; })(),
				attrValue: (() => { const x = Object.getOwnPropertyDescriptor(Attr.prototype, "value"); return [x.get.name, x.set.name, x.set.length]; })(),
				arity: [attempt(() => d.getAttribute()), attempt(() => d.setAttribute("a")), attempt(() => d.setAttributeNS(null, "a")), attempt(() => d.toggleAttribute()), attempt(() => d.getAttributeNS("x")), attempt(() => d.setAttributeNode())],
				coercion: [attempt(() => { d.setAttribute(123, 456); return d.getAttribute("123"); }), attempt(() => { d.setAttribute("src", null); return d.getAttribute("src"); }), attempt(() => { d.setAttribute("x", { toString: () => "obj" }); return d.getAttribute("x"); }), attempt(() => { d.setAttribute(Symbol(), "v"); }), attempt(() => { d.setAttribute("x", Symbol()); })],
				receivers: [attempt(() => P.getAttribute.call({}, "x")), attempt(() => P.setAttribute.call(document, "x", "y")), attempt(() => P.getAttributeNames.call(null)), attempt(() => Object.getOwnPropertyDescriptor(Attr.prototype, "value").get.call(d)), attempt(() => Object.getOwnPropertyDescriptor(P, "attributes").get.call({}))],
			};
		`
	),
	// the conversion is done once, before anything is written: a value whose
	// toString has side effects runs exactly once, and a throwing one leaves
	// nothing behind
	differential(
		"value-conversion-once",
		`
			const img = html("img");
			let calls = 0;
			img.setAttribute("src", { toString() { calls++; return "once.png"; } });
			const one = [calls, probe(img, "src")];
			const bad = { toString() { throw new RangeError("no"); } };
			const out = { one, threw: [attempt(() => img.setAttribute("srcset", bad)), attempt(() => img.setAttributeNS(null, "srcset", bad)), attempt(() => img.setAttribute("nonce", bad))], after: state(img) };
			let order = [];
			attempt(() => img.setAttribute({ toString() { order.push("name"); return "alt"; } }, { toString() { order.push("value"); return "v"; } }));
			out.order = order;
			return out;
		`
	),
	// an attribute written while a fetch is being started reads back as the
	// page's value from inside the resulting event
	differential(
		"read-back-inside-load-events",
		`
			const img = html("img");
			const got = await new Promise((resolve) => {
				const t = setTimeout(() => resolve("TIMEOUT"), 3000);
				img.onerror = () => { clearTimeout(t); resolve([img.getAttribute("src"), img.src, img.currentSrc, state(img)]); };
				img.onload = img.onerror;
				img.setAttribute("src", "/elattr-missing.png?x=1");
			});
			return got;
		`
	),
];
