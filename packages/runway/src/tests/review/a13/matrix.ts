import { htmlTest } from "../../../testcommon.ts";

// Attribute mirror matrix: every htmlRules (element x attribute) cell, written
// through every write path, read back through every read path. One
// assertConsistent per (origin, cell, write) with a compact signature, compared
// against bare Chrome.

type Cell = {
	id: string;
	tag: string;
	svg?: boolean;
	attr: string;
	ns?: string; // namespace for *NS paths
	prop?: string;
	old: string;
	nw: string;
	wrap?: [string, string]; // markup wrapper around the element
	extra?: string; // extra attributes
};

const XL = "http://www.w3.org/1999/xlink";
const U1 = "/o/a.png?x=1";
const U2 = "/n/b.png#h";
export const cells: Cell[] = [
	{
		id: "img-src",
		tag: "img",
		attr: "src",
		prop: "src",
		old: U1,
		nw: U2,
	},
	{
		id: "img-srcset",
		tag: "img",
		attr: "srcset",
		prop: "srcset",
		old: "/o/a.png 1x",
		nw: "/n/b.png 2x, /n/c.png 3x",
	},
	{
		id: "source-srcset",
		tag: "source",
		attr: "srcset",
		prop: "srcset",
		old: "/o/a.png",
		nw: "/n/b.png 2x",
		wrap: ["<picture>", "</picture>"],
	},
	{
		id: "source-src",
		tag: "source",
		attr: "src",
		prop: "src",
		old: U1,
		nw: U2,
		wrap: ["<video>", "</video>"],
	},
	{
		id: "video-poster",
		tag: "video",
		attr: "poster",
		prop: "poster",
		old: U1,
		nw: U2,
	},
	{
		id: "audio-src",
		tag: "audio",
		attr: "src",
		prop: "src",
		old: U1,
		nw: U2,
	},
	{
		id: "track-src",
		tag: "track",
		attr: "src",
		prop: "src",
		old: U1,
		nw: U2,
		wrap: ["<video>", "</video>"],
	},
	{
		id: "embed-src",
		tag: "embed",
		attr: "src",
		prop: "src",
		old: U1,
		nw: U2,
		extra: 'type="x-no/ne"',
	},
	{
		id: "object-data",
		tag: "object",
		attr: "data",
		prop: "data",
		old: U1,
		nw: U2,
		extra: 'type="x-no/ne"',
	},
	{
		id: "iframe-src",
		tag: "iframe",
		attr: "src",
		prop: "src",
		old: "/o/f.html",
		nw: "/n/f.html#h",
	},
	{
		id: "iframe-srcdoc",
		tag: "iframe",
		attr: "srcdoc",
		prop: "srcdoc",
		old: "<b>o</b>",
		nw: "<i>n</i>",
	},
	{
		id: "iframe-sandbox",
		tag: "iframe",
		attr: "sandbox",
		old: "allow-forms",
		nw: "allow-popups",
	},
	{
		id: "iframe-csp",
		tag: "iframe",
		attr: "csp",
		prop: "csp",
		old: "img-src 'none'",
		nw: "script-src 'none'",
	},
	{
		id: "iframe-credless",
		tag: "iframe",
		attr: "credentialless",
		old: "",
		nw: "x",
	},
	{
		id: "input-src",
		tag: "input",
		attr: "src",
		prop: "src",
		old: U1,
		nw: U2,
		extra: 'type="image"',
	},
	{
		id: "input-formaction",
		tag: "input",
		attr: "formaction",
		prop: "formAction",
		old: "/o/act",
		nw: "/n/act?q",
	},
	{
		id: "button-formaction",
		tag: "button",
		attr: "formaction",
		prop: "formAction",
		old: "/o/act",
		nw: "/n/act?q",
	},
	{
		id: "form-action",
		tag: "form",
		attr: "action",
		prop: "action",
		old: "/o/act",
		nw: "/n/act?q",
	},
	{
		id: "a-href",
		tag: "a",
		attr: "href",
		prop: "href",
		old: "/o/p?x",
		nw: "/n/q#frag",
	},
	{
		id: "a-target",
		tag: "a",
		attr: "target",
		prop: "target",
		old: "_top",
		nw: "_parent",
	},
	{
		id: "area-href",
		tag: "area",
		attr: "href",
		prop: "href",
		old: "/o/p",
		nw: "/n/q",
		wrap: ["<map name=m>", "</map>"],
	},
	{
		id: "link-href",
		tag: "link",
		attr: "href",
		prop: "href",
		old: "/o/s.css",
		nw: "/n/s.css",
		extra: 'rel="x-none"',
	},
	{
		id: "link-imagesrcset",
		tag: "link",
		attr: "imagesrcset",
		prop: "imageSrcset",
		old: "/o/a.png 1x",
		nw: "/n/b.png 2x",
		extra: 'rel="x-none"',
	},
	{
		id: "link-integrity",
		tag: "link",
		attr: "integrity",
		prop: "integrity",
		old: "sha256-old",
		nw: "sha256-new",
		extra: 'rel="x-none"',
	},
	{
		id: "script-src",
		tag: "script",
		attr: "src",
		prop: "src",
		old: "/o/s.js",
		nw: "/n/s.js",
		extra: 'type="text/x-none"',
	},
	{
		id: "script-integrity",
		tag: "script",
		attr: "integrity",
		prop: "integrity",
		old: "sha256-old",
		nw: "sha256-new",
		extra: 'type="text/x-none"',
	},
	{
		id: "meta-content",
		tag: "meta",
		attr: "content",
		prop: "content",
		old: "old value",
		nw: "new value",
		extra: 'name="x"',
	},
	{
		id: "div-style",
		tag: "div",
		attr: "style",
		old: "color: red;",
		nw: 'background-image: url("/n/b.png");',
	},
	{
		id: "div-nonce",
		tag: "div",
		attr: "nonce",
		prop: "nonce",
		old: "abc",
		nw: "def",
	},
	{
		id: "div-onclick",
		tag: "div",
		attr: "onclick",
		old: "o()",
		nw: "n()",
	},
	{
		id: "svg-use-href",
		tag: "use",
		svg: true,
		attr: "href",
		old: "#o",
		nw: "/n/s.svg#i",
		wrap: ["<svg>", "</svg>"],
	},
	{
		id: "svg-use-xlink",
		tag: "use",
		svg: true,
		attr: "xlink:href",
		ns: XL,
		old: "#o",
		nw: "/n/s.svg#i",
		wrap: ["<svg>", "</svg>"],
	},
	{
		id: "svg-image-href",
		tag: "image",
		svg: true,
		attr: "href",
		old: U1,
		nw: U2,
		wrap: ["<svg>", "</svg>"],
	},
	{
		id: "svg-a-href",
		tag: "a",
		svg: true,
		attr: "href",
		old: "/o/p",
		nw: "/n/q",
		wrap: ["<svg>", "</svg>"],
	},
	{
		id: "svg-lg-href",
		tag: "linearGradient",
		svg: true,
		attr: "href",
		old: "#o",
		nw: "/n/g.svg#g",
		wrap: ["<svg>", "</svg>"],
	},
	{
		id: "svg-style",
		tag: "rect",
		svg: true,
		attr: "style",
		old: "fill: red;",
		nw: "fill: blue;",
		wrap: ["<svg>", "</svg>"],
	},
];

export const WRITES = [
	"none",
	"sa",
	"sans",
	"prop",
	"attrval",
	"nodeval",
	"textc",
	"idx",
	"san",
	"sni",
	"tog",
	"togadd",
	"rm",
	"rman",
	"rmni",
	"inner",
	"rt",
	"clone",
	"imp",
	"dp",
	"ccf",
	"shu",
	"iah",
];

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const markup = (c: Cell, v: string) =>
	(c.wrap ? c.wrap[0] : "") +
	`<${c.tag} data-t="1" ${c.extra ?? ""} ${c.attr}="${esc(v)}">` +
	(c.svg
		? `</${c.tag}>`
		: [
					"img",
					"source",
					"track",
					"embed",
					"input",
					"area",
					"link",
					"meta",
			  ].includes(c.tag)
			? ""
			: `</${c.tag}>`) +
	(c.wrap ? c.wrap[1] : "");

const PAGE_JS = String.raw`
const XL = "http://www.w3.org/1999/xlink";
const cells = window.CELLS, WRITES = window.WRITES;
const markup = window.markupFor;
const target = (wrap) => { const all = wrap.getElementsByTagName("*"); return all[all.length - 1]; };
const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name; } };
const cssq = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
function sig(c, el, host) {
	const n = c.attr, out = [];
	out.push("get=" + T(() => el.getAttribute(n)));
	if (c.ns) out.push("getNS=" + T(() => el.getAttributeNS(c.ns, "href")));
	out.push("has=" + T(() => el.hasAttribute(n)));
	out.push("names=" + T(() => el.getAttributeNames().join(",")));
	out.push("hasAttrs=" + T(() => el.hasAttributes()));
	out.push("map=" + T(() => Array.from(el.attributes).map((a) => a.name + "=" + a.value).join(" ")));
	out.push("len=" + T(() => el.attributes.length));
	out.push("named=" + T(() => { const a = el.attributes[n]; return a ? a.value : "none"; }));
	out.push("node=" + T(() => { const a = el.getAttributeNode(n); return a ? [a.name, a.value, a.nodeValue, a.textContent, a.ownerElement === el].join("|") : "none"; }));
	if (c.prop) out.push("prop=" + T(() => String(el[c.prop])));
	if (c.svg && /href/.test(n)) out.push("baseVal=" + T(() => el.href.baseVal));
	if (n === "style") out.push("cssText=" + T(() => el.style.cssText));
	if (n === "sandbox") out.push("sbx=" + T(() => el.sandbox.value));
	if (n === "credentialless") out.push("cl=" + T(() => el.credentialless));
	const esc = n.replace(":", "\\:");
	out.push("m[]=" + T(() => el.matches("[" + esc + "]")));
	out.push("mOld=" + T(() => el.matches("[" + esc + "=" + cssq(c.old) + "]")));
	out.push("mNew=" + T(() => el.matches("[" + esc + "=" + cssq(c.nw) + "]")));
	out.push("mPre=" + T(() => el.matches("[" + esc + "^=" + cssq(c.nw.slice(0, 2)) + "]")));
	out.push("qsa=" + T(() => host.querySelectorAll("[" + esc + "]").length));
	out.push("qsaNew=" + T(() => host.querySelectorAll("[" + esc + "=" + cssq(c.nw) + "]").length));
	out.push("closest=" + T(() => !!el.closest("[" + esc + "]")));
	out.push("outer=" + T(() => el.outerHTML));
	return out.join(" ;; ");
}
function doWrite(w, c, el, host) {
	const n = c.attr, nw = c.nw, ns = c.ns ?? null;
	const idoc = el.ownerDocument;
	const mkAttr = () => { const a = ns ? idoc.createAttributeNS(ns, n) : idoc.createAttribute(n); a.value = nw; return a; };
	switch (w) {
		case "none": return el;
		case "sa": el.setAttribute(n, nw); return el;
		case "sans": el.setAttributeNS(ns, n, nw); return el;
		case "prop":
			if (n === "style") { el.style = nw; return el; }
			if (n === "sandbox") { el.sandbox = nw; return el; }
			if (n === "credentialless") { el.credentialless = true; return el; }
			if (n === "onclick") { return el; }
			if (c.svg && /href/.test(n)) { el.href.baseVal = nw; return el; }
			if (!c.prop) return el;
			el[c.prop] = nw; return el;
		case "attrval": el.getAttributeNode(n).value = nw; return el;
		case "nodeval": el.attributes.getNamedItem(n).nodeValue = nw; return el;
		case "textc": el.attributes[n].textContent = nw; return el;
		case "idx": { const names = el.getAttributeNames(); el.attributes[names.indexOf(n)].value = nw; return el; }
		case "san": ns ? el.setAttributeNodeNS(mkAttr()) : el.setAttributeNode(mkAttr()); return el;
		case "sni": ns ? el.attributes.setNamedItemNS(mkAttr()) : el.attributes.setNamedItem(mkAttr()); return el;
		case "tog": el.toggleAttribute(n); return el;
		case "togadd": el.removeAttribute(n); el.toggleAttribute(n, true); return el;
		case "rm": el.removeAttribute(n); return el;
		case "rman": el.removeAttributeNode(el.getAttributeNode(n)); return el;
		case "rmni": el.attributes.removeNamedItem(n); return el;
		case "inner": host.innerHTML = markup(c, nw); return target(host);
		case "rt": el.setAttribute(n, nw); host.innerHTML = host.innerHTML; return target(host);
		case "clone": { el.setAttribute(n, nw); const k = el.cloneNode(true); el.replaceWith(k); return k; }
		case "imp": { el.setAttribute(n, nw); const d = document.implementation.createHTMLDocument(""); const k = d.importNode(el, true); d.body.append(k); return k; }
		case "dp": { const d = new DOMParser().parseFromString("<body><div id=h>" + markup(c, nw) + "</div>", "text/html"); const h = d.getElementById("h"); const k = target(h); return document.adoptNode(k), host.replaceChildren(k), k; }
		case "ccf": { const r = document.createRange(); r.selectNodeContents(host); host.replaceChildren(r.createContextualFragment(markup(c, nw))); return target(host); }
		case "shu": host.setHTMLUnsafe(markup(c, nw)); return target(host);
		case "iah": host.replaceChildren(); host.insertAdjacentHTML("beforeend", markup(c, nw)); return target(host);
	}
}
runTest(async () => {
	const results = {};
	for (const origin of ["P", "C"]) {
		for (let i = 0; i < cells.length; i++) {
			const c = cells[i];
			for (let j = 0; j < WRITES.length; j++) {
				const w = WRITES[j];
				let host;
				if (origin === "P") host = document.getElementById("P_" + i + "_" + j);
				else {
					host = document.createElement("div");
					document.getElementById("C").append(host);
					host.innerHTML = c.wrap ? c.wrap[0] + c.wrap[1] : "";
					const par = host.firstElementChild || host;
					const el = c.svg ? document.createElementNS("http://www.w3.org/2000/svg", c.tag) : document.createElement(c.tag);
					el.setAttribute("data-t", "1");
					if (c.extra) for (const m of c.extra.matchAll(/(\S+)="([^"]*)"/g)) el.setAttribute(m[1], m[2]);
					if (c.ns) el.setAttributeNS(c.ns, c.attr, c.old); else el.setAttribute(c.attr, c.old);
					par.append(el);
				}
				let el = target(host), r;
				try { el = doWrite(w, c, el, host); r = sig(c, el, host); } catch (e) { r = "WRITE-THROW:" + e.name + ":" + e.message; }
				assertConsistent(origin + "|" + c.id + "|" + w, r);
			}
		}
	}
}, true);
`;

function page(): string {
	let body = "";
	cells.forEach((c, i) =>
		WRITES.forEach((_, j) => {
			body += `<div id="P_${i}_${j}">${markup(c, c.old)}</div>\n`;
		})
	);
	return `<!DOCTYPE html><html><head><meta charset=utf-8></head><body>
${body}
<div id=C></div>
<script>
window.CELLS = ${JSON.stringify(cells)};
window.WRITES = ${JSON.stringify(WRITES)};
window.markupFor = ${markup.toString().replace(/\besc\(/g, "__esc(")};
function __esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
${PAGE_JS}
</script></body></html>`;
}

export default [
	htmlTest({
		name: "rv13-matrix",
		html: page(),
	}),
];
