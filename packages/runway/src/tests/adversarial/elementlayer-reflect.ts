import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Reflected IDL attributes (`core/src/client/dom/reflect.ts`).
//
// Scramjet rewrites URL content attributes in the live DOM to proxy URLs and
// keeps the page's own value in a mirror; every reflected getter then has to
// answer out of the mirror, resolved against the *site's* document base URL -
// never the proxy's. These run each snippet twice, once in a bare Chromium page
// and once through scramjet, at the same URL, and compare the JSON summaries:
// whatever the browser answers natively is by definition the right answer.
//
// The runway token in the page's fragment differs between the two runs, so it
// is scrubbed from every summary before it is compared.

const PRELUDE = `
	const TOKEN = new URLSearchParams(location.hash.slice(1)).get("runway_token");
	const scrub = (v) => {
		if (v === undefined) return "<undefined>";
		const s = JSON.stringify(v);
		return JSON.parse(TOKEN ? s.split(TOKEN).join("TOKEN") : s);
	};
	const SVG_NS = "http://www.w3.org/2000/svg";
	const XLINK_NS = "http://www.w3.org/1999/xlink";
	const VALUES = [
		"https://example.test/a/b?c=d#e",
		"x",
		"./x",
		"../x",
		"../../../../x",
		"/x",
		"?q=1",
		"#h",
		"",
		"  ",
		"//example.test/x",
		"data:text/plain,hi",
		"javascript:void(0)",
		"about:blank",
		"mailto:a@example.test",
		"http://[",
		"https://a b/",
		"  /ws  ",
		"\\t/t\\n",
		"\\u0001/c",
		"http://\\u00f1.example.test/",
		"HTTPS://EXAMPLE.TEST/UP",
		"\\\\\\\\example.test\\\\back",
		"/a\\\\b",
		"https://u:p@example.test:8443/x",
		"http://example.test:80/",
		"https://example.test:443/",
		"http://example.test:0/",
		"http://example.test:99999/",
		"ws://example.test/",
		"file:///etc/passwd",
		"/a/../b/./c",
		"/%2e%2e/d",
		"x y",
		// the query of a non-ASCII URL is percent-encoded in the *document's*
		// encoding, which the runway page leaves unset - see the dedicated
		// test below rather than failing every sweep on it
		"https://example.test/\\u00fc?q#\\u00fc",
		"tel:+123",
		"urn:x:y",
		"foo://host/p",
		location.origin + "/same",
	];
	const make = (tag, ns) =>
		ns ? document.createElementNS(ns, tag) : document.createElement(tag);
	// for each value: setAttribute then the getter; the setter then
	// getAttribute and the getter
	const probe = (tag, prop, attr, values = VALUES, ns) => {
		const blank = make(tag, ns);
		if (!(prop in blank)) return "no-such-property";
		const out = { absent: blank[prop], rows: [] };
		for (const v of values) {
			const viaAttr = make(tag, ns);
			viaAttr.setAttribute(attr, v);
			const viaIdl = make(tag, ns);
			let idl;
			try {
				viaIdl[prop] = v;
				idl = [viaIdl.getAttribute(attr), viaIdl[prop]];
			} catch (e) {
				idl = { error: e.name };
			}
			out.rows.push([v, viaAttr[prop], idl]);
		}
		return out;
	};
	const withBase = async (href, fn) => {
		const b = document.createElement("base");
		if (href !== null) b.setAttribute("href", href);
		document.head.prepend(b);
		try {
			return await fn(b);
		} finally {
			b.remove();
		}
	};
	const settle = (el, ms = 3000) =>
		new Promise((r) => {
			const t = setTimeout(() => r("timeout"), ms);
			const done = (e) => { clearTimeout(t); r(e.type); };
			el.addEventListener("load", done, { once: true });
			el.addEventListener("error", done, { once: true });
		});
	// what a handful of reflected getters answer in the current document
	const readBase = (doc = document) => {
		const el = (tag, attr, v) => {
			const e = doc.createElement(tag);
			if (attr) e.setAttribute(attr, v);
			return e;
		};
		const a = el("a", "href", "../up/p?q#h");
		const base = doc.querySelector("base");
		return {
			documentBaseURI: doc.baseURI,
			bodyBaseURI: doc.body && doc.body.baseURI,
			detachedBaseURI: doc.createElement("div").baseURI,
			baseHref: base && base.href,
			img: el("img", "src", "x.png").src,
			a: a.href,
			aParts: [a.origin, a.host, a.pathname, a.search, a.hash],
			formNoAction: el("form").action,
			formEmptyAction: el("form", "action", "").action,
			formAction: el("form", "action", "act").action,
			buttonFormAction: el("button", "formaction", "fa").formAction,
			cite: el("q", "cite", "/abs").cite,
			link: el("link", "href", "?only").href,
			script: el("script", "src", "#frag").src,
			iframe: el("iframe", "src", "").src,
			poster: el("video", "poster", "p.jpg").poster,
		};
	};
`;

const differential = (name: string, js: string) =>
	basicTest({
		name: `elreflect-${name}`,
		js: `
			${PRELUDE}
			const snapshot = async () => {
				try {
					return { value: scrub(await (${js})) };
				} catch (error) {
					return { error: error && error.name, message: String(error && error.message) };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

/** one differential per element/property pair, over the whole value table */
const PROBES: [string, string, string][] = [
	["img", "src", "src"],
	["img", "lowsrc", "lowsrc"],
	["img", "longDesc", "longdesc"],
	["source", "src", "src"],
	["audio", "src", "src"],
	["video", "src", "src"],
	["video", "poster", "poster"],
	["track", "src", "src"],
	["iframe", "src", "src"],
	["iframe", "longDesc", "longdesc"],
	["frame", "src", "src"],
	["frame", "longDesc", "longdesc"],
	["embed", "src", "src"],
	["object", "data", "data"],
	["object", "codeBase", "codebase"],
	["script", "src", "src"],
	["link", "href", "href"],
	["form", "action", "action"],
	["input", "src", "src"],
	["input", "formAction", "formaction"],
	["button", "formAction", "formaction"],
	["q", "cite", "cite"],
	["blockquote", "cite", "cite"],
	["del", "cite", "cite"],
	["ins", "cite", "cite"],
	["a", "href", "href"],
	["area", "href", "href"],
	["base", "href", "href"],
];

/** base href values, each its own differential over `readBase` */
const BASES: [string, string][] = [
	["absolute", `"https://example.test/dir/sub/"`],
	["absolute-no-slash", `"https://example.test"`],
	["absolute-uppercase", `"HTTPS://EXAMPLE.TEST/UP/"`],
	["same-origin-absolute", `location.origin + "/same/dir/"`],
	["relative-dir", `"static/"`],
	["relative-file", `"static/file.html"`],
	["dotdot", `"../"`],
	["dotdot-deep", `"../../a/b/"`],
	["root", `"/root/"`],
	["dot", `"./a/b/c"`],
	["query", `"?bq=1"`],
	["fragment", `"#bh"`],
	["query-fragment", `"static/?q=1#f"`],
	["protocol-relative", `"//example.test/p/"`],
	["data", `"data:text/html,x"`],
	["javascript", `"javascript:void(0)"`],
	["empty", `""`],
	["whitespace", `"  sub/  "`],
	["invalid", `"http://["`],
	["file", `"file:///tmp/"`],
	["backslashes", `"\\\\\\\\example.test\\\\back\\\\"`],
	["about-blank", `"about:blank"`],
];

/** the URL shapes the hyperlink decomposition getters are read over */
const LINK_HREFS = `[
	"https://u:p@example.test:8080/p/q?x=1#f",
	"http://example.test:80/",
	"https://example.test:443",
	"/rel/path?x#y",
	"rel",
	"?only",
	"#only",
	"",
	"//example.test:81/x",
	"mailto:a@example.test",
	"MAILTO:A@EXAMPLE.TEST",
	"file:///C:/a/../b",
	"file://host/share",
	"foo://user@host:9/p?q#h",
	"foo:opaque path",
	"javascript:alert(1)",
	"data:text/plain,x",
	"blob:https://example.test/uuid",
	"about:blank#x",
	"http://[",
	"https://a b/",
	"http://\\u00f1.example.test/\\u00fc",
	"http://[::1]:3000/",
	"http://1.2.3.4/",
	"http://0x7f.1/",
	"ws://example.test/",
	null,
]`;

/** a snapshot of every decomposition getter */
const LINK_PARTS = `(e) => ({
	href: e.href,
	attr: e.getAttribute("href"),
	parts: [e.origin, e.protocol, e.username, e.password, e.host, e.hostname, e.port, e.pathname, e.search, e.hash],
	str: [e.toString(), String(e), \`\${e}\`, e + "", JSON.stringify(e.href)],
})`;

/** each setter, over each starting href */
const SETTERS: [string, string][] = [
	[
		"protocol",
		`["https", "ftp:", "http:foo", "foo", "file", "mailto", "", "HTTP", "ws:"]`,
	],
	["username", `["user", "", "a b@:", "\\u00e9"]`],
	["password", `["pw", "", "p:w@"]`],
	[
		"host",
		`["example.org", "example.org:81", "example.org:65536", "", "a b", "[::1]:3", "h.test:0"]`,
	],
	["hostname", `["h.test", "", "h.test:99", "H\\u00c9.TEST"]`],
	[
		"port",
		`["", "0", "81", "65535", "65536", "abc", "12abc", "80", "443", "-1"]`,
	],
	["pathname", `["np", "/np", "", "a b", "../x", "%2e%2e", "?x", "#x"]`],
	["search", `["y=2", "?y=2", "", "?", "#no", "a b"]`],
	["hash", `["g", "#g", "", "#", "a b"]`],
];

const setterTest = (tag: string, part: string, values: string) =>
	differential(
		`${tag}-set-${part}`,
		`(() => {
			const hrefs = ${LINK_HREFS};
			const values = ${values};
			const parts = ${LINK_PARTS};
			const out = [];
			for (const href of hrefs) {
				for (const v of values) {
					const e = document.createElement(${JSON.stringify(tag)});
					if (href !== null) e.setAttribute("href", href);
					let r;
					try {
						e[${JSON.stringify(part)}] = v;
						r = parts(e);
					} catch (err) {
						r = { error: err.name };
					}
					out.push([href, v, r.href, r.attr, r.error]);
				}
			}
			return out;
		})()`
	);

export default [
	// --- every intercepted URL attribute, over every URL shape ---------------

	...PROBES.map(([tag, prop, attr]) =>
		differential(
			`probe-${tag}-${prop}`,
			`probe(${JSON.stringify(tag)}, ${JSON.stringify(prop)}, ${JSON.stringify(attr)})`
		)
	),

	// a URL's query is percent-encoded in the document's encoding. the runway
	// page declares none, so natively that is windows-1252 ("%FC") - a
	// document-encoding question, isolated here so it fails once rather than
	// in every sweep above
	differential(
		"query-encoded-in-document-charset",
		`(() => {
			const a = document.createElement("a");
			a.setAttribute("href", "https://example.test/\\u00fc?\\u00fc#\\u00fc");
			const img = document.createElement("img");
			img.src = "/p?\\u00fc";
			return { charset: document.characterSet, a: a.href, search: a.search, img: img.src };
		})()`
	),

	// the IDL setter converts to USVString, which replaces a lone surrogate;
	// setAttribute takes a DOMString and keeps it
	differential(
		"usvstring-lone-surrogate",
		`(() => {
			const out = {};
			for (const [tag, prop, attr] of [["img", "src", "src"], ["a", "href", "href"], ["form", "action", "action"], ["iframe", "srcdoc", "srcdoc"], ["img", "srcset", "srcset"], ["link", "imageSrcset", "imagesrcset"]]) {
				const e = document.createElement(tag);
				e[prop] = "/\\ud800x";
				const f = document.createElement(tag);
				f.setAttribute(attr, "/\\udc00y");
				out[tag + "." + prop] = [e.getAttribute(attr), e[prop], f.getAttribute(attr), f[prop]];
			}
			return out;
		})()`
	),

	// the setter stringifies whatever it is handed, the way the binding does
	differential(
		"setter-conversions",
		`(() => {
			const out = [];
			for (const v of [null, undefined, 0, -0, 1.5, true, {}, [], ["a", "b"], { toString: () => "/obj" }, new URL("https://example.test/u")]) {
				const img = document.createElement("img");
				let r;
				try { img.src = v; r = [img.getAttribute("src"), img.src]; } catch (e) { r = e.name; }
				out.push(r);
			}
			for (const v of [Symbol("s")]) {
				const img = document.createElement("img");
				try { img.src = v; out.push("no-throw"); } catch (e) { out.push(e.name); }
			}
			return out;
		})()`
	),

	// removing the attribute takes the getter back to ""
	differential(
		"remove-attribute",
		`(() => {
			const out = {};
			for (const [tag, prop, attr] of [["img", "src", "src"], ["a", "href", "href"], ["form", "action", "action"], ["iframe", "src", "src"], ["script", "src", "src"], ["link", "href", "href"], ["video", "poster", "poster"], ["object", "data", "data"]]) {
				const e = document.createElement(tag);
				e[prop] = "/before";
				const set = e[prop];
				e.removeAttribute(attr);
				out[tag] = [set, e[prop], e.hasAttribute(attr), e.getAttributeNames()];
			}
			return out;
		})()`
	),

	// parsed markup lands in the mirror via the HTML rewriter, not a setter
	differential(
		"parsed-markup",
		`(() => {
			const d = document.createElement("div");
			d.innerHTML = '<img src="p.png" srcset="a.png 1x, b.png 2x"><a href="../l?q#h">l</a><area href="ar"><form action="f"><button formaction="bf"></button><input formaction="if" src="is"></form><video poster="po" src="vs"><source src="ss"><track src="ts"></video><iframe src="fr" srcdoc="<b>x</b>"></iframe><object data="od"></object><embed src="es"><link href="lh" imagesrcset="i 1x"><blockquote cite="bc"></blockquote><del cite="dc"></del><ins cite="ic"></ins><q cite="qc"></q>';
			const q = (s) => d.querySelector(s);
			return {
				html: d.innerHTML,
				values: [q("img").src, q("img").srcset, q("a").href, q("area").href, q("form").action, q("button").formAction, q("input").formAction, q("input").src, q("video").poster, q("video").src, q("source").src, q("track").src, q("iframe").src, q("iframe").srcdoc, q("object").data, q("embed").src, q("link").href, q("link").imageSrcset, q("blockquote").cite, q("del").cite, q("ins").cite, q("q").cite],
			};
		})()`
	),

	// blob: URLs from this page resolve to themselves
	differential(
		"blob-urls",
		`(() => {
			const u = URL.createObjectURL(new Blob(["x"], { type: "text/plain" }));
			try {
				const out = {};
				for (const [tag, prop] of [["img", "src"], ["a", "href"], ["video", "src"], ["audio", "src"], ["source", "src"], ["iframe", "src"], ["script", "src"], ["link", "href"], ["object", "data"], ["embed", "src"], ["track", "src"], ["form", "action"], ["q", "cite"]]) {
					const e = document.createElement(tag);
					e[prop] = u;
					out[tag] = [e[prop] === u, e.getAttribute(prop === "data" ? "data" : prop) === u];
				}
				const a = document.createElement("a");
				a.href = u;
				out.parts = [a.protocol, a.origin === location.origin, a.host === location.host, a.pathname === u.slice(5)];
				out.shape = u.startsWith("blob:" + location.origin + "/");
				return out;
			} finally {
				URL.revokeObjectURL(u);
			}
		})()`
	),

	// --- form submission targets ---------------------------------------------

	differential(
		"form-action-document-url",
		`(() => {
			const out = [];
			for (const v of [null, "", " ", "#", "#x", "?", "?q", ".", "./", "/", "javascript:void(0)", "about:blank"]) {
				const f = document.createElement("form");
				const b = document.createElement("button");
				const i = document.createElement("input");
				if (v !== null) {
					f.setAttribute("action", v);
					b.setAttribute("formaction", v);
					i.setAttribute("formaction", v);
				}
				out.push([v, f.action, b.formAction, i.formAction, f.getAttribute("action")]);
			}
			return out;
		})()`
	),

	// Blink's form action goes through its own URL completion rather than
	// "parse, or the value itself": an unparseable action comes back as the
	// engine's serialization of the failed URL, and a relative one in a
	// document with no URL of its own comes back empty
	differential(
		"form-action-invalid-urls",
		`(() => {
			const values = ["http://[", "http://[::1/", "http://a<b/", "http://a^b/", "http://1.2.3.256/", "http://example.test:99999/", "http://a%00b/", "https://a b/", "/\\udc00y"];
			const out = [];
			for (const v of values) {
				const f = document.createElement("form");
				f.setAttribute("action", v);
				const b = document.createElement("button");
				b.formAction = v;
				const i = document.createElement("input");
				i.setAttribute("formaction", v);
				const img = document.createElement("img");
				img.setAttribute("src", v);
				out.push([v, f.action, b.formAction, i.formAction, img.src]);
			}
			const doc = document.implementation.createHTMLDocument("t");
			for (const v of [null, "", "rel", "/abs", "https://example.test/ok", "#h"]) {
				const f = doc.createElement("form");
				if (v !== null) f.setAttribute("action", v);
				const b = doc.createElement("button");
				if (v !== null) b.setAttribute("formaction", v);
				out.push(["created", v, f.action, b.formAction]);
			}
			return out;
		})()`
	),

	differential(
		"form-action-with-base",
		`withBase("https://example.test/b/", () => {
			const f = document.createElement("form");
			const g = document.createElement("form");
			g.action = "";
			const h = document.createElement("form");
			h.action = "rel";
			const i = document.createElement("input");
			i.formAction = "#frag";
			return [f.action, g.action, h.action, i.formAction];
		})`
	),

	// --- the document base URL -----------------------------------------------

	...BASES.map(([name, href]) =>
		differential(`base-${name}`, `withBase(${href}, () => readBase())`)
	),

	differential("base-none", `readBase()`),

	differential(
		"base-without-href",
		`withBase(null, (b) => [b.href, b.getAttribute("href"), readBase()])`
	),

	// the first base element *with an href* wins, in tree order
	differential(
		"base-multiple",
		`(async () => {
			const first = document.createElement("base");
			const second = document.createElement("base");
			second.setAttribute("href", "first/");
			const third = document.createElement("base");
			third.setAttribute("href", "second/");
			document.head.prepend(first, second, third);
			try {
				const out = [readBase()];
				second.remove();
				out.push(readBase());
				third.setAttribute("href", "changed/");
				out.push(readBase());
				first.setAttribute("href", "https://example.test/firstabs/");
				out.push(readBase());
				return out.concat([first.href, third.href]);
			} finally {
				first.remove();
				second.remove();
				third.remove();
			}
		})()`
	),

	// a base element in the body counts too; tree order still decides
	differential(
		"base-in-body",
		`(async () => {
			const late = document.createElement("base");
			late.setAttribute("href", "late/");
			document.body.append(late);
			try {
				const out = [readBase()];
				return await withBase("early/", () => out.concat([readBase()]));
			} finally {
				late.remove();
			}
		})()`
	),

	// an SVG element that happens to be called "base" is not a base element
	differential(
		"base-svg-namespace-ignored",
		`(async () => {
			const svg = document.createElementNS(SVG_NS, "svg");
			const fake = document.createElementNS(SVG_NS, "base");
			fake.setAttribute("href", "svgbase/");
			svg.append(fake);
			document.head.prepend(svg);
			const real = document.createElement("base");
			real.setAttribute("href", "real/");
			try {
				const out = [readBase()];
				document.head.append(real);
				out.push(readBase());
				return out;
			} finally {
				svg.remove();
				real.remove();
			}
		})()`
	),

	differential(
		"base-dynamic",
		`(async () => {
			const out = [document.baseURI];
			const b = document.createElement("base");
			b.href = "dyn/";
			out.push([b.getAttribute("href"), b.href, document.baseURI]);
			document.head.append(b);
			try {
				out.push([b.href, document.baseURI, document.createElement("img").baseURI]);
				b.href = "../other/";
				out.push([b.getAttribute("href"), b.href, document.baseURI]);
				b.setAttribute("href", "https://example.test/abs/");
				out.push([b.href, document.baseURI]);
				b.removeAttribute("href");
				out.push([b.href, document.baseURI]);
			} finally {
				b.remove();
			}
			out.push(document.baseURI);
			return out;
		})()`
	),

	differential(
		"base-parsed-innerhtml",
		`(async () => {
			const holder = document.createElement("div");
			holder.innerHTML = '<base href="parsed/"><a href="x">x</a>';
			document.body.append(holder);
			try {
				return [holder.innerHTML, holder.firstChild.href, holder.querySelector("a").href, document.baseURI];
			} finally {
				holder.remove();
			}
		})()`
	),

	// the base.href getter resolves against the fallback base URL, not the
	// document base URL - which may be the base element's own
	differential(
		"base-href-getter-shapes",
		`(() => {
			const out = [];
			for (const v of VALUES) {
				const b = document.createElement("base");
				b.setAttribute("href", v);
				out.push([v, b.href]);
			}
			return out;
		})()`
	),

	differential(
		"base-target",
		`(() => {
			const out = [];
			for (const v of ["_top", "_parent", "_blank", "_self", "_unfencedTop", "named", ""]) {
				for (const tag of ["a", "area", "form", "base"]) {
					const e = document.createElement(tag);
					e.target = v;
					const f = document.createElement(tag);
					f.setAttribute("target", v);
					out.push([tag, v, e.target, e.getAttribute("target"), f.target, f.outerHTML]);
				}
			}
			return out;
		})()`
	),

	// the document's URL moves with the history API, and every relative URL,
	// form action and the base URL with it
	differential(
		"after-pushstate",
		`(async () => {
			const original = location.href;
			const out = [];
			try {
				history.pushState(null, "", "/elreflect/deep/page.html?p=1#ph");
				out.push(document.URL === location.href, readBase());
				await withBase("rel/", () => out.push(readBase()));
				history.replaceState(null, "", "?only=1");
				out.push(readBase());
			} finally {
				history.replaceState(null, "", original);
			}
			out.push(location.href === original, readBase());
			return out;
		})()`
	),

	// a base element in a shadow tree is not the document's
	differential(
		"base-in-shadow-root",
		`(async () => {
			const host = document.createElement("div");
			const root = host.attachShadow({ mode: "open" });
			root.innerHTML = '<base href="shadow/"><a href="x">a</a><img src="y">';
			document.body.append(host);
			try {
				const r = () => [root.querySelector("a").href, root.querySelector("img").src, root.querySelector("a").baseURI, root.querySelector("base").href, document.baseURI];
				const out = [r()];
				await withBase("light/", () => out.push(r()));
				return out;
			} finally {
				host.remove();
			}
		})()`
	),

	// base href and URL attributes written as Attr nodes
	differential(
		"attr-node-writes",
		`(async () => {
			const out = [];
			const b = document.createElement("base");
			const battr = document.createAttribute("href");
			battr.value = "attrnode/";
			b.setAttributeNode(battr);
			document.head.prepend(b);
			try {
				out.push(readBase());
				battr.value = "changed/";
				out.push(readBase());
				b.attributes.href.value = "https://example.test/nm/";
				out.push(readBase());
			} finally {
				b.remove();
			}
			const img = document.createElement("img");
			const sattr = document.createAttribute("src");
			sattr.value = "an.png";
			img.setAttributeNode(sattr);
			out.push([img.src, img.getAttribute("src"), sattr.value]);
			sattr.value = "https://example.test/an2.png";
			out.push([img.src, img.getAttribute("src"), img.attributes.src.value]);
			const a = document.createElement("a");
			a.setAttributeNS(null, "href", "ns-rel?q");
			out.push([a.href, a.search, a.getAttributeNS(null, "href")]);
			a.attributes.href.value = "#nm";
			out.push([a.href, a.hash]);
			a.removeAttributeNode(a.attributes.href);
			out.push([a.href, a.protocol, a.hasAttribute("href")]);
			const f = document.createElement("iframe");
			f.toggleAttribute("credentialless");
			out.push([f.credentialless, f.getAttribute("credentialless")]);
			f.toggleAttribute("credentialless");
			out.push([f.credentialless, f.hasAttribute("credentialless")]);
			return out;
		})()`
	),

	// --- documents other than this one ---------------------------------------

	differential(
		"created-html-document",
		`(() => {
			const doc = document.implementation.createHTMLDocument("t");
			const out = [doc.URL, doc.baseURI, readBase(doc)];
			const b = doc.createElement("base");
			b.setAttribute("href", "https://example.test/cd/");
			doc.head.append(b);
			out.push(readBase(doc));
			b.setAttribute("href", "rel/");
			out.push(readBase(doc));
			return out;
		})()`
	),

	differential(
		"domparser-document",
		`(() => {
			const p = new DOMParser();
			const plain = p.parseFromString('<a href="x">a</a><img src="y"><form></form>', "text/html");
			const based = p.parseFromString('<base href="https://example.test/dp/"><a href="x">a</a><img src="y">', "text/html");
			const relBased = p.parseFromString('<base href="rel/"><a href="x">a</a>', "text/html");
			const r = (d) => [d.URL, d.baseURI, d.querySelector("a").href, d.querySelector("img") && d.querySelector("img").src, d.querySelector("form") && d.querySelector("form").action];
			return [r(plain), r(based), r(relBased)];
		})()`
	),

	differential(
		"template-content",
		`(() => {
			const t = document.createElement("template");
			t.innerHTML = '<a href="x">a</a><img src="y"><form></form><base href="https://example.test/t/">';
			const c = t.content;
			return [c.baseURI, c.ownerDocument.URL, c.ownerDocument.baseURI, c.querySelector("a").href, c.querySelector("a").baseURI, c.querySelector("img").src, c.querySelector("form").action, c.querySelector("base").href, t.innerHTML];
		})()`
	),

	// adoption changes the node document, and with it the base URL
	differential(
		"adopt-into-created-document",
		`(() => {
			const doc = document.implementation.createHTMLDocument("t");
			const b = doc.createElement("base");
			b.setAttribute("href", "https://example.test/adopted/");
			doc.head.append(b);
			const a = document.createElement("a");
			a.href = "x";
			const img = document.createElement("img");
			img.src = "y";
			const f = document.createElement("form");
			const before = [a.href, img.src, f.action, a.baseURI];
			doc.body.append(doc.adoptNode(a), doc.adoptNode(img), doc.adoptNode(f));
			const after = [a.href, img.src, f.action, a.baseURI, a.getAttribute("href")];
			document.body.append(a);
			const back = [a.href, a.baseURI, a.getAttribute("href")];
			a.remove();
			return { before, after, back };
		})()`
	),

	differential(
		"import-from-created-document",
		`(() => {
			const doc = document.implementation.createHTMLDocument("t");
			doc.body.innerHTML = '<a href="x">a</a><img src="y"><form action=""></form>';
			const out = [doc.querySelector("a").href, doc.querySelector("img").src, doc.querySelector("form").action];
			const imported = document.importNode(doc.body, true);
			out.push(imported.querySelector("a").href, imported.querySelector("img").src, imported.querySelector("form").action, imported.innerHTML);
			return out;
		})()`
	),

	differential(
		"clone-node",
		`(() => {
			const d = document.createElement("div");
			d.innerHTML = '<a href="x?q#h">a</a><img src="y"><form action="f"></form><iframe srcdoc="<i>s</i>" sandbox="allow-scripts"></iframe><script src="s.js" integrity="sha256-x" nonce="n"></script>';
			const c = d.cloneNode(true);
			const q = (root, s) => root.querySelector(s);
			const r = (root) => [q(root, "a").href, q(root, "img").src, q(root, "form").action, q(root, "iframe").srcdoc, q(root, "iframe").sandbox.value, q(root, "script").src, q(root, "script").integrity, q(root, "script").nonce, root.innerHTML];
			const shallow = q(d, "a").cloneNode();
			return [r(d), r(c), shallow.href, shallow.outerHTML];
		})()`
	),

	// --- frames --------------------------------------------------------------

	differential(
		"iframe-about-blank",
		`(async () => {
			const f = document.createElement("iframe");
			document.body.append(f);
			try {
				const d = f.contentDocument;
				const a = d.createElement("a");
				a.href = "x";
				const img = d.createElement("img");
				img.setAttribute("src", "y");
				return [d.URL, d.baseURI, d.body && d.body.baseURI, a.href, a.origin, img.src, d.createElement("form").action, f.src];
			} finally {
				f.remove();
			}
		})()`
	),

	differential(
		"iframe-about-blank-inherits-base",
		`withBase("static/", async () => {
			const f = document.createElement("iframe");
			document.body.append(f);
			try {
				const d = f.contentDocument;
				const a = d.createElement("a");
				a.href = "x";
				return [d.URL, d.baseURI, a.href];
			} finally {
				f.remove();
			}
		})`
	),

	// the about base URL is the creator's base URL *when the document was
	// created*, not whatever the container's base URL is by the time it is read
	differential(
		"iframe-about-blank-base-snapshot",
		`(async () => {
			const out = [];
			const b = document.createElement("base");
			b.setAttribute("href", "snap/");
			document.head.prepend(b);
			const f = document.createElement("iframe");
			document.body.append(f);
			try {
				const d = f.contentDocument;
				const a = d.createElement("a");
				a.setAttribute("href", "x");
				out.push([d.baseURI, a.href]);
				b.setAttribute("href", "moved/");
				out.push([d.baseURI, a.href]);
				b.remove();
				out.push([d.baseURI, a.href]);
				const g = document.createElement("iframe");
				document.body.append(g);
				const gd = g.contentDocument;
				document.head.prepend(b);
				out.push([gd.baseURI, document.baseURI]);
				g.remove();
			} finally {
				b.remove();
				f.remove();
			}
			return out;
		})()`
	),

	differential(
		"iframe-srcdoc-base-snapshot",
		`(async () => {
			const f = document.createElement("iframe");
			f.srcdoc = '<a href="x">a</a>';
			const loaded = settle(f);
			document.body.append(f);
			const out = [];
			try {
				await loaded;
				const d = f.contentDocument;
				out.push([d.baseURI, d.querySelector("a").href]);
				await withBase("later/", () => out.push([d.baseURI, d.querySelector("a").href]));
			} finally {
				f.remove();
			}
			return out;
		})()`
	),

	differential(
		"iframe-explicit-about-blank",
		`(async () => {
			const f = document.createElement("iframe");
			f.src = "about:blank";
			const loaded = settle(f);
			document.body.append(f);
			try {
				await loaded;
				const d = f.contentDocument;
				const a = d.createElement("a");
				a.href = "x";
				return [f.src, f.getAttribute("src"), d.URL, d.baseURI, a.href];
			} finally {
				f.remove();
			}
		})()`
	),

	differential(
		"iframe-srcdoc-inherits",
		`(async () => {
			const f = document.createElement("iframe");
			f.srcdoc = '<a href="x">a</a><img src="missing-srcdoc.png"><form></form>';
			const loaded = settle(f);
			document.body.append(f);
			try {
				await loaded;
				const d = f.contentDocument;
				const a = d.querySelector("a");
				return [f.srcdoc, f.getAttribute("srcdoc"), f.src, d.URL, d.baseURI, a.href, a.baseURI, d.querySelector("img").src, d.querySelector("form").action];
			} finally {
				f.remove();
			}
		})()`
	),

	differential(
		"iframe-srcdoc-with-parent-base",
		`withBase("static/", async () => {
			const f = document.createElement("iframe");
			f.srcdoc = '<a href="x">a</a>';
			const loaded = settle(f);
			document.body.append(f);
			try {
				await loaded;
				const d = f.contentDocument;
				return [d.URL, d.baseURI, d.querySelector("a").href];
			} finally {
				f.remove();
			}
		})`
	),

	differential(
		"iframe-srcdoc-own-base",
		`(async () => {
			const f = document.createElement("iframe");
			f.srcdoc = '<base href="inner/"><a href="x">a</a>';
			const loaded = settle(f);
			document.body.append(f);
			try {
				await loaded;
				const d = f.contentDocument;
				return [d.URL, d.baseURI, d.querySelector("a").href, d.querySelector("base").href];
			} finally {
				f.remove();
			}
		})()`
	),

	// --- the hyperlink decomposition -----------------------------------------

	differential(
		"a-getters",
		`(() => {
			const parts = ${LINK_PARTS};
			return ${LINK_HREFS}.map((href) => {
				const a = document.createElement("a");
				if (href !== null) a.setAttribute("href", href);
				return [href, parts(a)];
			});
		})()`
	),

	differential(
		"area-getters",
		`(() => {
			const parts = ${LINK_PARTS};
			return ${LINK_HREFS}.map((href) => {
				const a = document.createElement("area");
				if (href !== null) a.setAttribute("href", href);
				return [href, parts(a)];
			});
		})()`
	),

	differential(
		"a-getters-with-base",
		`withBase("https://base.example.test:9000/b/c/", () => {
			const parts = ${LINK_PARTS};
			return ${LINK_HREFS}.map((href) => {
				const a = document.createElement("a");
				if (href !== null) a.setAttribute("href", href);
				return [href, parts(a)];
			});
		})`
	),

	differential(
		"a-getters-with-relative-base",
		`withBase("../rb/", () => {
			const parts = ${LINK_PARTS};
			return ["x", "", "?q", "#h", "/abs", "//example.test/p"].map((href) => {
				const a = document.createElement("a");
				a.setAttribute("href", href);
				return [href, parts(a)];
			});
		})`
	),

	...SETTERS.map(([part, values]) => setterTest("a", part, values)),
	...SETTERS.map(([part, values]) => setterTest("area", part, values)),

	// chained setters build on each other's output
	differential(
		"a-setter-chain",
		`(() => {
			const a = document.createElement("a");
			const steps = [];
			a.href = "rel/p";
			steps.push(a.getAttribute("href"));
			a.search = "q=1";
			steps.push(a.getAttribute("href"));
			a.hash = "h";
			steps.push(a.getAttribute("href"));
			a.pathname = "/new";
			steps.push(a.getAttribute("href"));
			a.host = "example.test:81";
			steps.push(a.getAttribute("href"));
			a.port = "";
			steps.push(a.getAttribute("href"));
			a.protocol = "https";
			steps.push(a.getAttribute("href"));
			a.username = "u";
			a.password = "p";
			steps.push(a.getAttribute("href"));
			a.hostname = "other.test";
			steps.push(a.getAttribute("href"));
			return [steps, a.href, a.origin, a.outerHTML];
		})()`
	),

	// the host, hostname, port and pathname setters return early on a URL with
	// an opaque path, leaving the attribute exactly as the page wrote it -
	// not re-serialized
	differential(
		"a-setters-opaque-path-noop",
		`(() => {
			const out = [];
			for (const href of ["MAILTO:A@EXAMPLE.TEST", "JavaScript:alert(1)", "DATA:text/plain,X", "foo:Opaque%zz", "about:BLANK"]) {
				for (const [part, v] of [["host", "h.test"], ["hostname", "h.test"], ["port", "81"], ["pathname", "/p"], ["username", "u"], ["password", "p"]]) {
					for (const tag of ["a", "area"]) {
						const e = document.createElement(tag);
						e.setAttribute("href", href);
						e[part] = v;
						out.push([tag, href, part, e.getAttribute("href"), e.href]);
					}
				}
			}
			return out;
		})()`
	),

	// origin has no setter: silently ignored sloppy, a TypeError strict
	differential(
		"a-origin-readonly",
		`(() => {
			const a = document.createElement("a");
			a.href = "https://example.test/";
			a.origin = "https://evil.test";
			let strict;
			try { (() => { "use strict"; a.origin = "https://evil.test"; })(); strict = "no-throw"; } catch (e) { strict = e.name; }
			return [a.origin, a.href, strict, Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "origin").set];
		})()`
	),

	// the other reflected attributes on a hyperlink are plain strings - ping in
	// particular is a list of URLs but is not resolved
	differential(
		"a-non-url-reflections",
		`(() => {
			const out = {};
			for (const tag of ["a", "area"]) {
				const a = document.createElement(tag);
				a.ping = "p1 /p2 https://example.test/p3";
				a.rel = "noopener x";
				a.download = "../file.txt";
				a.hreflang = "en";
				a.type = "text/html";
				a.referrerPolicy = "no-referrer";
				a.target = "_top";
				out[tag] = [a.ping, a.getAttribute("ping"), a.rel, a.relList.length, a.download, a.hreflang, a.type, a.referrerPolicy, a.target, a.getAttribute("target")];
			}
			return out;
		})()`
	),

	// --- srcset and friends: reflected, never resolved ------------------------

	differential(
		"srcset-reflect",
		`(() => {
			const out = [];
			for (const v of ["a.png 1x, /b.png 2x", "https://example.test/c.png 100w", "data:image/png;base64,AAAA 1x", "", " , ", "  x.png  ", "../up.png 3x, ?q 1.5x"]) {
				const img = document.createElement("img");
				img.srcset = v;
				img.sizes = "(max-width: 10px) 5px, 100vw";
				const s = document.createElement("source");
				s.srcset = v;
				s.sizes = "10px";
				const l = document.createElement("link");
				l.imageSrcset = v;
				l.imageSizes = "20px";
				const p = document.createElement("img");
				p.setAttribute("srcset", v);
				out.push([v, img.srcset, img.getAttribute("srcset"), img.sizes, s.srcset, s.getAttribute("srcset"), s.sizes, l.imageSrcset, l.getAttribute("imagesrcset"), l.getAttribute("imageSrcset"), l.hasAttribute("imagesrcset"), l.imageSizes, p.srcset, l.outerHTML]);
			}
			return out;
		})()`
	),

	// --- the attributes scramjet strips from the document --------------------

	differential(
		"integrity",
		`(() => {
			const out = [];
			for (const tag of ["script", "link"]) {
				const e = document.createElement(tag);
				const absent = e.integrity;
				e.integrity = "sha384-abc";
				const f = document.createElement(tag);
				f.setAttribute("integrity", "sha256-def");
				out.push([tag, absent, e.integrity, e.getAttribute("integrity"), e.outerHTML, f.integrity, f.getAttributeNames()]);
			}
			return out;
		})()`
	),

	differential(
		"iframe-csp-credentialless",
		`(() => {
			const f = document.createElement("iframe");
			const out = [f.csp, f.credentialless, f.hasAttribute("credentialless")];
			f.csp = "script-src 'none'";
			f.credentialless = true;
			out.push(f.csp, f.getAttribute("csp"), f.credentialless, f.getAttribute("credentialless"), f.outerHTML);
			f.credentialless = false;
			out.push(f.credentialless, f.hasAttribute("credentialless"));
			f.credentialless = "false";
			out.push(f.credentialless, f.getAttribute("credentialless"));
			f.setAttribute("credentialless", "no");
			out.push(f.credentialless);
			f.removeAttribute("credentialless");
			out.push(f.credentialless, f.getAttributeNames());
			return out;
		})()`
	),

	differential(
		"iframe-srcdoc-reflect",
		`(() => {
			const f = document.createElement("iframe");
			const out = [f.srcdoc, f.hasAttribute("srcdoc")];
			f.srcdoc = '<script>parent.x = 1</script><a href="/y">y</a><img src="z.png">';
			out.push(f.srcdoc, f.getAttribute("srcdoc"));
			f.setAttribute("srcdoc", "<p>two</p>");
			out.push(f.srcdoc);
			f.srcdoc = "";
			out.push(f.srcdoc, f.hasAttribute("srcdoc"), f.getAttribute("srcdoc"));
			return out;
		})()`
	),

	differential(
		"iframe-sandbox-tokenlist",
		`(() => {
			const f = document.createElement("iframe");
			const s = f.sandbox;
			const out = [s === f.sandbox, s.length, s.value, String(s), f.hasAttribute("sandbox")];
			s.add("allow-scripts", "allow-forms");
			out.push(s.value, f.getAttribute("sandbox"), s.length);
			s.remove("allow-forms");
			out.push(s.value, f.getAttribute("sandbox"));
			out.push(s.toggle("allow-popups"), s.toggle("allow-popups"), s.toggle("allow-modals", true), f.getAttribute("sandbox"));
			out.push(s.replace("allow-modals", "allow-same-origin"), s.replace("nope", "x"), f.getAttribute("sandbox"));
			out.push(s.contains("allow-scripts"), s.item(0), [...s], s.supports("allow-scripts"), s.supports("bogus"));
			f.sandbox = "allow-downloads  allow-top-navigation";
			out.push(s.value, f.getAttribute("sandbox"), s.length, s === f.sandbox);
			s.value = "";
			out.push(s.value, f.getAttribute("sandbox"), f.hasAttribute("sandbox"));
			f.removeAttribute("sandbox");
			out.push(s.value, s.length, f.hasAttribute("sandbox"), f.outerHTML);
			let err;
			try { s.add(""); } catch (e) { err = e.name; }
			let err2;
			try { s.add("a b"); } catch (e) { err2 = e.name; }
			out.push(err, err2);
			const g = document.createElement("iframe");
			g.setAttribute("sandbox", "");
			out.push(g.sandbox.length, g.sandbox.value, g.getAttribute("sandbox"));
			return out;
		})()`
	),

	// ordinary token lists are left alone by the sandbox bookkeeping
	differential(
		"other-tokenlists",
		`(() => {
			const d = document.createElement("div");
			d.classList.add("a", "b");
			d.classList.toggle("c");
			d.classList.replace("a", "z");
			const l = document.createElement("link");
			l.relList.add("preload");
			const a = document.createElement("a");
			a.relList.value = "noopener";
			return [d.className, d.classList.value, l.rel, a.rel, a.getAttribute("rel")];
		})()`
	),

	differential(
		"nonce",
		`(() => {
			const out = [];
			const makers = [
				() => document.createElement("script"),
				() => document.createElement("style"),
				() => document.createElement("div"),
				() => document.createElementNS(SVG_NS, "script"),
				() => document.createElementNS("http://www.w3.org/1998/Math/MathML", "math"),
			];
			for (const m of makers) {
				const e = m();
				if (!("nonce" in e)) { out.push("no-nonce"); continue; }
				const r = [e.nonce];
				e.nonce = "idl";
				r.push(e.nonce, e.getAttribute("nonce"), e.hasAttribute("nonce"));
				e.setAttribute("nonce", "attr");
				r.push(e.nonce, e.getAttribute("nonce"));
				e.nonce = "idl2";
				r.push(e.nonce, e.getAttribute("nonce"));
				e.removeAttribute("nonce");
				r.push(e.nonce, e.getAttribute("nonce"));
				out.push(r);
			}
			const d = document.createElement("div");
			d.innerHTML = '<script nonce="parsed" type="text/plain"></script>';
			const p = d.firstChild;
			out.push([p.nonce, p.getAttribute("nonce"), d.innerHTML]);
			document.body.append(d);
			out.push([p.nonce, p.getAttribute("nonce")]);
			d.remove();
			const clone = p.cloneNode();
			out.push([clone.nonce, clone.getAttribute("nonce")]);
			return out;
		})()`
	),

	differential(
		"boolean-reflections",
		`(() => {
			const img = document.createElement("img");
			const f = document.createElement("iframe");
			const s = document.createElement("script");
			const out = [img.isMap, f.allowFullscreen, s.async, s.defer, s.noModule];
			img.isMap = true;
			f.allowFullscreen = 1;
			s.defer = "yes";
			s.noModule = true;
			out.push(img.getAttribute("ismap"), f.getAttribute("allowfullscreen"), s.getAttribute("defer"), s.getAttribute("nomodule"), s.outerHTML);
			return out;
		})()`
	),

	// --- current source, which is the browser's pick rather than a mirror -----

	differential(
		"img-currentsrc-data",
		`(async () => {
			const img = document.createElement("img");
			const before = img.currentSrc;
			img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
			const done = settle(img);
			document.body.append(img);
			try {
				const ev = await done;
				return [before, ev, img.currentSrc, img.src, img.complete];
			} finally {
				img.remove();
			}
		})()`
	),

	differential(
		"img-currentsrc-missing",
		`(async () => {
			const img = document.createElement("img");
			img.src = "missing-elreflect.png?x=1#f";
			const done = settle(img);
			document.body.append(img);
			try {
				const ev = await done;
				return [ev, img.currentSrc, img.src, img.getAttribute("src")];
			} finally {
				img.remove();
			}
		})()`
	),

	differential(
		"img-currentsrc-srcset",
		`(async () => {
			const img = document.createElement("img");
			img.srcset = "/missing-srcset.png 1x";
			const done = settle(img);
			document.body.append(img);
			try {
				const ev = await done;
				return [ev, img.currentSrc, img.src, img.srcset];
			} finally {
				img.remove();
			}
		})()`
	),

	differential(
		"img-currentsrc-with-base",
		`withBase("https://example.test/cs/", async () => {
			const img = document.createElement("img");
			img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
			const done = settle(img);
			document.body.append(img);
			try {
				await done;
				return [img.currentSrc, img.src];
			} finally {
				img.remove();
			}
		})`
	),

	differential(
		"video-currentsrc-missing",
		`(async () => {
			const v = document.createElement("video");
			const before = v.currentSrc;
			v.src = "missing-elreflect.mp4";
			const done = settle(v);
			document.body.append(v);
			try {
				await done;
				return [before, v.currentSrc, v.src, v.getAttribute("src")];
			} finally {
				v.remove();
			}
		})()`
	),

	// --- SVG href ------------------------------------------------------------

	differential(
		"svg-href-baseval",
		`(() => {
			const out = {};
			for (const tag of ["a", "use", "image", "script", "feImage", "textPath", "linearGradient", "radialGradient", "pattern", "filter", "mpath"]) {
				const rows = [];
				for (const v of ["#id", "/x.svg#i", "https://example.test/i.png", "rel.png", "../up", "", "data:image/svg+xml,<svg/>", "javascript:void(0)"]) {
					const e = document.createElementNS(SVG_NS, tag);
					if (!e.href) { rows.push("no-href"); break; }
					e.setAttribute("href", v);
					rows.push([v, e.href.baseVal, e.href.animVal, e.getAttribute("href"), e.href === e.href]);
				}
				out[tag] = rows;
			}
			return out;
		})()`
	),

	differential(
		"svg-xlink-href",
		`(() => {
			const out = {};
			for (const tag of ["a", "use", "image", "script", "feImage", "linearGradient"]) {
				const only = document.createElementNS(SVG_NS, tag);
				only.setAttributeNS(XLINK_NS, "xlink:href", "legacy.svg#a");
				const both = document.createElementNS(SVG_NS, tag);
				both.setAttributeNS(XLINK_NS, "xlink:href", "legacy.svg#b");
				both.setAttribute("href", "modern.svg#b");
				const prefixed = document.createElementNS(SVG_NS, tag);
				prefixed.setAttributeNS(XLINK_NS, "x:href", "other-prefix.svg");
				out[tag] = [
					only.href.baseVal, only.href.animVal, only.getAttributeNS(XLINK_NS, "href"), only.getAttribute("xlink:href"),
					both.href.baseVal, both.href.animVal,
					prefixed.href.baseVal, prefixed.getAttributeNS(XLINK_NS, "href"),
				];
			}
			return out;
		})()`
	),

	// which attribute a baseVal write lands on
	differential(
		"svg-href-baseval-setter",
		`(() => {
			const out = {};
			const state = (e) => [e.href.baseVal, e.getAttribute("href"), e.getAttributeNS(XLINK_NS, "href"), e.getAttributeNames(), e.outerHTML];
			for (const tag of ["use", "image", "a", "feImage"]) {
				const none = document.createElementNS(SVG_NS, tag);
				none.href.baseVal = "set-none.svg#n";
				const xl = document.createElementNS(SVG_NS, tag);
				xl.setAttributeNS(XLINK_NS, "xlink:href", "old.svg");
				xl.href.baseVal = "set-xlink.svg#x";
				const modern = document.createElementNS(SVG_NS, tag);
				modern.setAttribute("href", "old.svg");
				modern.href.baseVal = "https://example.test/set-modern.svg";
				const both = document.createElementNS(SVG_NS, tag);
				both.setAttribute("href", "m.svg");
				both.setAttributeNS(XLINK_NS, "xlink:href", "l.svg");
				both.href.baseVal = "set-both.svg";
				out[tag] = [state(none), state(xl), state(modern), state(both)];
			}
			return out;
		})()`
	),

	// SVGAnimatedString is not only for URLs: className and an SVG a's target
	// are ones too, and must pass straight through
	differential(
		"svg-other-animated-strings",
		`(() => {
			const a = document.createElementNS(SVG_NS, "a");
			a.className.baseVal = "c1 c2";
			const out = [a.className.baseVal, a.className.animVal, a.getAttribute("class"), a.classList.length];
			for (const t of ["_top", "_parent", "_blank", "named"]) {
				const b = document.createElementNS(SVG_NS, "a");
				b.setAttribute("target", t);
				const c = document.createElementNS(SVG_NS, "a");
				c.target.baseVal = t;
				out.push([t, b.target.baseVal, b.target.animVal, c.target.baseVal, c.getAttribute("target")]);
			}
			const r = document.createElementNS(SVG_NS, "rect");
			r.className.baseVal = "r";
			out.push(r.className.baseVal, r.getAttribute("class"));
			return out;
		})()`
	),

	differential(
		"svg-href-parsed-markup",
		`(() => {
			const d = document.createElement("div");
			d.innerHTML = '<svg><a href="/sa" target="_top"><text>t</text></a><use href="#sym"/><use xlink:href="sprite.svg#s"/><image href="i.png"/><linearGradient id="g" href="#g0"/></svg>';
			const q = (s) => d.querySelectorAll(s);
			return [q("a")[0].href.baseVal, q("a")[0].target.baseVal, q("use")[0].href.baseVal, q("use")[1].href.baseVal, q("image")[0].href.baseVal, q("linearGradient")[0].href.baseVal, d.innerHTML];
		})()`
	),

	// --- descriptor shapes ---------------------------------------------------

	differential(
		"descriptor-shapes",
		`(() => {
			const members = [
				["HTMLImageElement", "src"], ["HTMLImageElement", "srcset"], ["HTMLImageElement", "currentSrc"], ["HTMLImageElement", "lowsrc"], ["HTMLImageElement", "longDesc"],
				["HTMLSourceElement", "src"], ["HTMLSourceElement", "srcset"], ["HTMLMediaElement", "src"], ["HTMLMediaElement", "currentSrc"], ["HTMLVideoElement", "poster"], ["HTMLTrackElement", "src"],
				["HTMLIFrameElement", "src"], ["HTMLIFrameElement", "srcdoc"], ["HTMLIFrameElement", "csp"], ["HTMLIFrameElement", "credentialless"], ["HTMLIFrameElement", "sandbox"], ["HTMLIFrameElement", "longDesc"],
				["HTMLFrameElement", "src"], ["HTMLFrameElement", "longDesc"], ["HTMLEmbedElement", "src"], ["HTMLObjectElement", "data"], ["HTMLObjectElement", "codeBase"],
				["HTMLScriptElement", "src"], ["HTMLScriptElement", "integrity"], ["HTMLLinkElement", "href"], ["HTMLLinkElement", "integrity"], ["HTMLLinkElement", "imageSrcset"],
				["HTMLFormElement", "action"], ["HTMLFormElement", "target"], ["HTMLInputElement", "src"], ["HTMLInputElement", "formAction"], ["HTMLButtonElement", "formAction"],
				["HTMLQuoteElement", "cite"], ["HTMLModElement", "cite"], ["HTMLElement", "nonce"], ["SVGElement", "nonce"],
				["HTMLAnchorElement", "href"], ["HTMLAnchorElement", "origin"], ["HTMLAnchorElement", "protocol"], ["HTMLAnchorElement", "hash"], ["HTMLAnchorElement", "target"], ["HTMLAnchorElement", "toString"],
				["HTMLAreaElement", "href"], ["HTMLAreaElement", "port"], ["HTMLAreaElement", "toString"], ["HTMLBaseElement", "href"], ["HTMLBaseElement", "target"],
				["SVGAnimatedString", "baseVal"], ["SVGAnimatedString", "animVal"], ["SVGUseElement", "href"], ["SVGAElement", "href"], ["SVGGradientElement", "href"],
				["DOMTokenList", "value"], ["DOMTokenList", "add"], ["DOMTokenList", "toggle"], ["Node", "baseURI"],
			];
			const fn = (f) => f === undefined ? null : [typeof f, f.name, f.length, Function.prototype.toString.call(f)];
			return members.map(([iface, key]) => {
				const proto = self[iface] && self[iface].prototype;
				if (!proto) return [iface, key, "no-interface"];
				const d = Object.getOwnPropertyDescriptor(proto, key);
				if (!d) return [iface, key, "no-descriptor"];
				return [iface, key, Object.keys(d), d.enumerable, d.configurable, d.writable, fn(d.get), fn(d.set), fn(d.value)];
			});
		})()`
	),

	// brand checks: the getters throw the native TypeError on the wrong receiver
	differential(
		"illegal-invocation",
		`(() => {
			const cases = [
				["HTMLImageElement", "src", () => document.createElement("div")],
				["HTMLImageElement", "currentSrc", () => ({})],
				["HTMLMediaElement", "src", () => document.createElement("img")],
				["HTMLAnchorElement", "href", () => document.createElement("area")],
				["HTMLAnchorElement", "protocol", () => HTMLAnchorElement.prototype],
				["HTMLAreaElement", "hash", () => document.createElement("a")],
				["HTMLBaseElement", "href", () => null],
				["HTMLFormElement", "action", () => document],
				["HTMLIFrameElement", "sandbox", () => document.createElement("frame")],
				["HTMLElement", "nonce", () => document.createElementNS(SVG_NS, "svg")],
				["SVGAnimatedString", "baseVal", () => document.createElementNS(SVG_NS, "use").href.baseVal],
				["Node", "baseURI", () => ({})],
				["HTMLScriptElement", "integrity", () => HTMLElement.prototype],
			];
			const out = [];
			for (const [iface, key, recv] of cases) {
				const d = Object.getOwnPropertyDescriptor(self[iface].prototype, key);
				let get, set;
				try { get = ["ok", d.get.call(recv())]; } catch (e) { get = [e.name, e instanceof TypeError]; }
				try { d.set ? (d.set.call(recv(), "/v"), set = "ok") : (set = "no-setter"); } catch (e) { set = [e.name, e instanceof TypeError]; }
				out.push([iface, key, get, set]);
			}
			for (const iface of ["HTMLAnchorElement", "HTMLAreaElement"]) {
				try { out.push(self[iface].prototype.toString.call(document.createElement("div"))); } catch (e) { out.push(e.name); }
				try { out.push(String(self[iface].prototype)); } catch (e) { out.push(e.name); }
			}
			try { out.push(DOMTokenList.prototype.add.call({}, "x")); } catch (e) { out.push(e.name); }
			try { out.push(HTMLImageElement.prototype.src); } catch (e) { out.push(e.name); }
			return out;
		})()`
	),

	// reached through Reflect.get with a receiver, and off a subclass
	differential(
		"reflect-get-and-subclass",
		`(() => {
			const img = document.createElement("img");
			img.src = "/r";
			const a = document.createElement("a");
			a.href = "/ra?q";
			class MyImg extends HTMLImageElement {}
			let custom;
			try {
				customElements.define("elreflect-img-" + Math.random().toString(36).slice(2), MyImg, { extends: "img" });
				const m = new MyImg();
				m.src = "/custom";
				custom = [m.src, m.getAttribute("src")];
			} catch (e) {
				custom = e.name;
			}
			return [
				Reflect.get(HTMLImageElement.prototype, "src", img),
				Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "search").get.call(a),
				Object.getOwnPropertyDescriptor(Node.prototype, "baseURI").get.call(a),
				custom,
			];
		})()`
	),

	// --- sanity: nothing handed back is the proxy's --------------------------

	basicTest({
		name: "elreflect-no-proxy-prefix-anywhere",
		js: `
			${PRELUDE}
			const leaks = [];
			const check = (label, v) => {
				if (typeof v === "string" && (v.includes("/~/sj/") || (v.includes("://") && !v.includes(location.host) && /localhost|127\\.0\\.0\\.1/.test(v) && !v.startsWith("blob:")))) {
					leaks.push(label + " = " + v);
				}
			};
			const d = document.createElement("div");
			d.innerHTML = '<img src="i"><a href="a">a</a><area href="ar"><form action="f"></form><iframe src="fr"></iframe><video poster="p" src="v"></video><source src="s"><track src="t"><embed src="e"><object data="o"></object><script src="sc"></script><link href="l"><input src="in" formaction="fa"><button formaction="bf"></button>';
			for (const el of d.querySelectorAll("*")) {
				for (const prop of ["src", "href", "action", "poster", "data", "formAction", "baseURI"]) {
					if (prop in el) check(el.localName + "." + prop, el[prop]);
				}
			}
			check("document.baseURI", document.baseURI);
			check("a.origin", d.querySelector("a").origin);
			check("a.host", d.querySelector("a").host);
			assertEqual(leaks.length, 0, "leaked: " + leaks.join(", "));
			assertEqual(d.querySelector("a").href, location.origin + "/a", "a.href");
			assertEqual(d.querySelector("form").action, location.origin + "/f", "form.action");
			assertEqual(document.createElement("form").action, location.href, "form without action is the document URL");
		`,
	}),
];
