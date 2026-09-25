import { htmlTest } from "../../../testcommon.ts";

// isEqualNode between an SW-parsed element and the same markup created by
// script (innerHTML, DOMParser, setAttribute). Chrome says equal; the live
// (rewritten) values decide it under the proxy. XPath string(@x) exposes the
// live values so the difference can be seen.

const T = String.raw`const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };`;
const MARKUP: Record<string, string> = {
	img: `<img src="/i.png">`,
	a: `<a href="/x">x</a>`,
	link: `<link rel="stylesheet" href="/s.css" data-turbo-track="reload">`,
	script: `<script src="/app.js" data-turbo-track="reload"></script>`,
	style: `<div style="background: url(/b.png)"></div>`,
	target: `<a href="/x" target="_blank">x</a>`,
	onclick: `<div onclick="f()"></div>`,
	meta: `<meta name="csrf-token" content="abc">`,
	srcset: `<img srcset="/a.png 1x, /b.png 2x">`,
	svguse: `<svg><use href="#i"></use></svg>`,
};

export default [
	htmlTest({
		name: "rv13-equal",
		html: `<!doctype html><head>${MARKUP.link}${MARKUP.meta}</head><body>
${Object.entries(MARKUP)
	.filter(([k]) => k !== "link" && k !== "meta" && k !== "script")
	.map(([k, m]) => `<div id="p-${k}">${m}</div>`)
	.join("\n")}
<div id="p-script"><script src="/app.js" data-turbo-track="reload" type="text/x-none"></script></div>
<script>${T}
function f() {}
const MARKUP = ${JSON.stringify(MARKUP).replace(/<\//g, "<\\/")};
MARKUP.script = '<script src="/app.js" data-turbo-track="reload" type="text/x-none"><' + '/script>';
const live = (el) => { const r = document.evaluate("@*", el, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); const out = []; for (let i = 0; i < r.snapshotLength; i++) { const a = r.snapshotItem(i); out.push(document.evaluate("name(.)", a, null, 2, null).stringValue + "=" + document.evaluate("string(.)", a, null, 2, null).stringValue); } return out.join(" "); };
runTest(async () => {
	for (const k of Object.keys(MARKUP)) {
		const parsed = k === "link" ? document.head.querySelector("link") : k === "meta" ? document.head.querySelector("meta") : document.getElementById("p-" + k).firstElementChild;
		const viaInner = document.createElement("div"); viaInner.innerHTML = MARKUP[k]; const a = viaInner.firstElementChild;
		const doc = new DOMParser().parseFromString("<body>" + MARKUP[k], "text/html"); const b = document.adoptNode(doc.body.firstElementChild);
		const c = document.createElement(parsed.localName === "svg" ? "div" : parsed.localName);
		const c2 = parsed.localName === "svg" ? a.cloneNode(true) : (() => { for (const at of parsed.attributes) c.setAttribute(at.name, at.value); return c; })();
		assertConsistent(k + " eq innerHTML", T(() => parsed.isEqualNode(a)));
		assertConsistent(k + " eq DOMParser", T(() => parsed.isEqualNode(b)));
		assertConsistent(k + " eq setAttribute", T(() => parsed.isEqualNode(c2)));
		assertConsistent("live " + k, "parsed: " + live(parsed) + " ;; inner: " + live(a) + " ;; dp: " + live(b));
	}
}, true);
</script></body>`,
	}),
];
