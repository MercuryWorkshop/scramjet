import { htmlTest } from "../../../testcommon.ts";

// Selector mirroring (client/selectors.ts): many selector spellings over
// parsed and script-set mirrored attributes, through every selector entry
// point, compared against bare Chrome.

const SELECTORS = [
	'a[href$=".pdf"]',
	'[href^="/p"]',
	'[href*="x"]',
	'[href~="/p/x.pdf"]',
	'[href|="/p"]',
	'[href="/P/X.PDF" i]',
	'[href="/P/X.PDF" s]',
	'[href="/P/X.PDF"]',
	"[HREF]",
	'[hReF="/p/x.pdf"]',
	'[ href = "/p/x.pdf" ]',
	"[href='/p/x.pdf']",
	"[href=\\/p\\/x\\.pdf]",
	"[*|href]",
	"[|href]",
	'[*|href$=".pdf"]',
	'[|href$=".pdf"]',
	":not([href])",
	"a:not([href])",
	":is([href],[src])",
	":where([src])",
	':has(> [href$=".pdf"])',
	"a:not([target=_blank])",
	"[target=_top]",
	"[target=_TOP i]",
	"a:nth-child(1 of [href])",
	'[style*="red"]',
	"[style]",
	'[style="color: red"]',
	"[onclick]",
	'[onclick="f()"]',
	"[nonce]",
	"[nonce=abc]",
	"[sandbox~=allow-scripts]",
	"[sandbox]",
	"[content=hello]",
	"meta[content]",
	"details[open]",
	"[one]",
	"[only]",
	"[onx]",
	"[data-src]",
	"[scramjet-attr-href]",
	"[scramjet-attr_script-source]",
	'[scramjet-attr-href="/p/x.pdf"]',
	"[Scramjet-Attr-href]",
	"[scramjet-attrx]",
	"a[href][target]",
	'a[href="/p/x.pdf"][href$=pdf]',
	"[href]:is([href])",
	"[href] > span",
	"html [href]",
	"[src], [href]",
	"a/**/[href]",
	"a/*[*/[href]",
	'[title="[href]"]',
	'[href="a]b"]',
	'[title="a\\"[href]"]',
	'use[href="#i"]',
	'use[*|href="#i"]',
	"[xlink\\:href]",
	'[xlink\\:href="#j"]',
	"image[href]",
	'img[src$="logo.png"]',
	'img[srcset*="a.png"]',
	"[integrity]",
	'[integrity^="sha"]',
	"[action]",
	'[action="/submit"]',
	"[formaction]",
	"[poster]",
	"[data]",
	'[data="/obj"]',
	"[srcdoc]",
	'[srcdoc*="<b>"]',
	"[csp]",
	"[credentialless]",
	"[imagesrcset]",
	":scope [href]",
	"[href]:not(:scope)",
	"a[href]:first-of-type",
	":is(a)[href]",
	"[href]:has(span)",
	':not(:is([href="/p/x.pdf"]))',
	"[on]",
	"[onclick i]",
	"[ONCLICK]",
	"span:not([href])",
	"[style=]",
	"[a='[']",
	"[href],",
	"[href]\\",
	"[href]]",
	"[[href]]",
];

const JS = String.raw`
const SELECTORS = ${JSON.stringify(SELECTORS)};
const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name; } };
const ids = (list) => Array.from(list).map((e) => e.id || e.localName).join(",");
runTest(async () => {
	// script-written copies of the parsed elements
	const host = document.getElementById("scripted");
	const a = document.createElement("a"); a.id = "sa"; a.setAttribute("href", "/p/x.pdf"); a.setAttribute("target", "_top"); a.setAttribute("style", "color: red"); a.setAttribute("onclick", "f()"); a.append(document.createElement("span")); host.append(a);
	const img = document.createElement("img"); img.id = "simg"; img.src = "/img/logo.png"; img.srcset = "/a.png 1x"; host.append(img);
	const d = document.createElement("div"); d.id = "sd"; d.setAttribute("nonce", "abc"); host.append(d);
	const f = document.createElement("iframe"); f.id = "sf"; f.setAttribute("sandbox", "allow-scripts"); host.append(f);
	const m = document.createElement("meta"); m.id = "sm"; m.setAttribute("content", "hello"); host.append(m);
	const tpl = document.getElementById("tpl").content;
	const shadowHost = document.getElementById("sh");
	const sr = shadowHost.attachShadow({ mode: "open" });
	sr.innerHTML = '<a id="sra" href="/p/x.pdf" target="_top">x</a><img id="sri" src="/img/logo.png">';
	for (const s of SELECTORS) {
		assertConsistent("doc.qsa " + s, T(() => ids(document.querySelectorAll(s))));
		assertConsistent("doc.qs " + s, T(() => { const e = document.querySelector(s); return e ? e.id || e.localName : "none"; }));
		assertConsistent("el.qsa " + s, T(() => ids(document.body.querySelectorAll(s))));
		assertConsistent("matches " + s, T(() => [a.matches(s), document.getElementById("pa").matches(s), img.matches(s), d.matches(s)].join()));
		assertConsistent("closest " + s, T(() => { const e = a.firstChild.closest(s); return e ? e.id || e.localName : "none"; }));
		assertConsistent("frag " + s, T(() => ids(tpl.querySelectorAll(s))));
		assertConsistent("shadow " + s, T(() => ids(sr.querySelectorAll(s))));
	}
	// XPath over the same attributes
	const X = (x) => T(() => { const r = document.evaluate(x, document, null, XPathResult.ANY_TYPE, null); switch (r.resultType) { case 1: return r.numberValue; case 2: return r.stringValue; case 3: return r.booleanValue; default: { const out = []; let n; while ((n = r.iterateNext())) out.push(n.nodeType === 2 ? n.name + "=" + n.value : n.id || n.localName); return out.join(","); } } });
	for (const x of ["count(//a[@href='/p/x.pdf'])", "string(//a[@id='pa']/@href)", "//a[@id='pa']/@*", "count(//@*[starts-with(name(),'scramjet')])", "//*[@style]", "//*[contains(@href,'.pdf')]", "name(//img[@id='pimg']/@*[last()])", "//meta[@content='hello']"]) {
		assertConsistent("xpath " + x, X(x));
	}
}, true);
`;

const html = `<!DOCTYPE html><html><head><meta charset=utf-8><meta id="pm" name="x" content="hello"></head><body>
<div id=parsed>
<a id="pa" href="/p/x.pdf" target="_top" style="color: red" onclick="f()" title="[href]"><span id=psp></span></a>
<img id="pimg" src="/img/logo.png" srcset="/a.png 1x">
<div id="pd" nonce="abc" one="1" only onx="1" data-src="/d"></div>
<iframe id="pf" sandbox="allow-scripts"></iframe>
<details id="pdet" open></details>
<script id="pscript" integrity="sha256-x" type="text/x-none"></script>
<form id="pform" action="/submit"><button id="pbtn" formaction="/b"></button></form>
<video id="pvid" poster="/poster.png"></video>
<object id="pobj" data="/obj" type="x-no/ne"></object>
<iframe id="psd" srcdoc="<b>x</b>" csp="img-src 'none'" credentialless></iframe>
<link id="plink" rel="x-none" imagesrcset="/a.png 1x">
<svg id="psvg"><use id="puse" href="#i"/><use id="pusex" xlink:href="#j"/><image id="pimage" href="/i.png"/></svg>
<A id="pA" HREF="/p/x.pdf">upper</A>
</div>
<div id=scripted></div>
<template id=tpl><a id="ta" href="/p/x.pdf" target="_top"><span></span></a><img id="ti" src="/img/logo.png"></template>
<div id=sh></div>
<script>function f() {}</script>
<script>${JS}</script></body></html>`;

const t = htmlTest({
	name: "rv13-selectors",
	html,
});
t.timeoutMs = 120000;
export default [t];
