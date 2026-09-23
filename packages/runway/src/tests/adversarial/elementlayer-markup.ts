import { basicTest } from "../../testcommon.ts";

/**
 * `JSON.stringify` with every non-ASCII character escaped. The test page is
 * served without a charset, so a native run decodes raw non-ASCII in the
 * script as windows-1252 while scramjet decodes it as UTF-8 - a difference
 * in document encoding, not in anything under test here.
 */
const asciiJSON = (value: unknown) =>
	JSON.stringify(value).replace(
		/[\u0080-\uffff]/g,
		(c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
	);

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// The markup sinks (#112): innerHTML / outerHTML / setHTMLUnsafe / setHTML /
// getHTML / insertAdjacentHTML on Element and ShadowRoot, DOMParser,
// createContextualFragment, document.write and the frame accessors.
//
// Every one of them runs the page's string through rewriteHtml before the
// browser parses it and through unrewriteHtml when the browser serializes it
// back. Both passes use htmlparser2, not the browser's parser, so wherever the
// two tokenize a string differently the page either reads back something the
// browser would never have produced (fidelity), or markup the browser treats as
// an element reaches the document without its handlers rewritten (escape).
//
// Two kinds of test:
//
//   - differential: the snippet runs in bare Chromium and through scramjet at
//     the same URL, and `assertConsistent` fails if the JSON differs
//   - escapes (scramjet only): each payload is one the browser *does* run
//     natively. Rewritten, `checkglobal(top)` sees the wrapped top; landed
//     raw, it sees the real one and fails

const PAYLOAD = "checkglobal(top);pass()";
const IFRAME_PAYLOAD = "parent.checkglobal(top);parent.pass()";
const SAFE_COMPLETION = 'setTimeout(() => pass("no escape"), 150);';
const IMG = `<img src=x: onerror=checkglobal(top)>`;

/**
 * Helpers every differential snippet gets: a tree shape that shows namespaces,
 * attribute names and values and node types, and every serializer there is.
 */
const LIB = `
	const __shape = (n) => {
		if (!n) return null;
		switch (n.nodeType) {
			case 1: {
				const kids = n.localName === "template" && n.content ? n.content.childNodes : n.childNodes;
				const out = [
					(n.namespaceURI || "").replace("http://www.w3.org/", ""),
					n.localName,
					Array.from(n.attributes, (a) => [a.name, a.value]),
					Array.from(kids, __shape),
				];
				if (n.shadowRoot) out.push(["#shadow", n.shadowRoot.mode, Array.from(n.shadowRoot.childNodes, __shape)]);
				return out;
			}
			case 3: return ["#text", n.data];
			case 4: return ["#cdata", n.data];
			case 7: return ["#pi", n.target, n.data];
			case 8: return ["#comment", n.data];
			case 9:
			case 11: return ["#" + n.nodeType, Array.from(n.childNodes, __shape)];
			case 10: return ["#doctype", n.name, n.publicId, n.systemId];
		}
		return ["#" + n.nodeType];
	};
	const __try = (f) => { try { return f(); } catch (e) { return "!" + (e && e.name); } };
	const __ser = (el) => ({
		inner: __try(() => el.innerHTML),
		outer: __try(() => el.outerHTML),
		getHTML: typeof el.getHTML === "function" ? __try(() => el.getHTML()) : "n/a",
		getHTMLs: typeof el.getHTML === "function" ? __try(() => el.getHTML({ serializableShadowRoots: true })) : "n/a",
		xml: __try(() => new XMLSerializer().serializeToString(el)),
		text: __try(() => el.textContent),
		shape: __shape(el),
	});
	const __urls = (root) => Array.from(root.querySelectorAll("*"), (e) => {
		const o = { tag: e.localName };
		for (const k of ["href", "src", "action", "formAction", "poster", "data", "srcset", "ping", "cite", "background"]) {
			try {
				const v = e[k];
				if (typeof v === "string") o[k] = v;
				else if (v && typeof v === "object" && "baseVal" in v) o[k] = ["anim", v.baseVal];
			} catch (err) { o[k] = "!" + err.name; }
		}
		return o;
	});
	const __attrs = (root) => Array.from(root.querySelectorAll("*"), (e) =>
		[e.localName, e.getAttributeNames().map((n) => [n, e.getAttribute(n)]), e.attributes.length]);
	const __sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const __load = (f) => new Promise((r) => { const t = setTimeout(() => r("TIMEOUT"), 3000); f.addEventListener("load", () => { clearTimeout(t); r("load"); }, { once: true }); });
	const SVG = "http://www.w3.org/2000/svg";
	const MATH = "http://www.w3.org/1998/Math/MathML";
`;

const differential = (name: string, js: string) =>
	basicTest({
		name: `elmarkup-${name}`,
		js: `
			${LIB}
			const snapshot = async () => {
				try {
					return { value: await (${js}) };
				} catch (error) {
					return { error: error && error.name };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

function escapeTest(name: string, js: string) {
	return basicTest({
		name: `elmarkup-escape-${name}`,
		js,
		autoPass: false,
		scramjetOnly: true,
	});
}

// --- round-trip corpus ------------------------------------------------------

// set as innerHTML on a detached div, then read back through every serializer,
// the parsed tree, getAttribute, the reflected URL properties, a second
// innerHTML round trip, and the same string through setHTMLUnsafe and
// insertAdjacentHTML
const roundtrip = (name: string, html: string) =>
	differential(
		`rt-${name}`,
		`(() => {
			const html = ${asciiJSON(html)};
			const el = document.createElement("div");
			el.innerHTML = html;
			const again = document.createElement("div");
			again.innerHTML = el.innerHTML;
			const outerParent = document.createElement("div");
			outerParent.innerHTML = el.outerHTML;
			const unsafe = document.createElement("div");
			if (unsafe.setHTMLUnsafe) unsafe.setHTMLUnsafe(html);
			const adjacent = document.createElement("div");
			adjacent.insertAdjacentHTML("beforeend", html);
			return {
				first: __ser(el),
				attrs: __attrs(el),
				urls: __urls(el),
				count: el.childNodes.length,
				stable: again.innerHTML === el.innerHTML,
				outerStable: outerParent.innerHTML === el.outerHTML,
				unsafe: unsafe.innerHTML,
				unsafeSame: unsafe.innerHTML === el.innerHTML,
				adjacent: adjacent.innerHTML,
				adjacentShape: __shape(adjacent),
			};
		})()`
	);

const CORPUS: [string, string][] = [
	[
		"url-relative",
		`<a href="/x?y=1&amp;z=2#h">a</a><img src="rel.png"><link rel="stylesheet" href="../s.css"><a href="?q">q</a><a href="#frag">f</a><a href="">empty</a>`,
	],
	[
		"url-absolute",
		`<a href="https://example.com/p?q#h">x</a><img src="//cdn.example/i.png"><a href="HTTP://EXAMPLE.COM/UP">u</a><a href="http://localhost:1/port">p</a>`,
	],
	[
		"url-special-schemes",
		`<a href="javascript:void 0">j</a><a href="JaVaScRiPt:alert(1)">J</a><img src="data:image/png;base64,AAAA"><a href="blob:https://example.com/0000">b</a><a href="mailto:a@b.c">m</a><a href="tel:+1">t</a><a href="about:blank">ab</a><iframe src="about:srcdoc"></iframe>`,
	],
	[
		"url-form",
		`<form action="/post" method="post" enctype="multipart/form-data"><input type="image" src="/b.png" formaction="/f"><button formaction="?q">b</button><input name="x" value="/not-a-url"></form>`,
	],
	[
		"url-media",
		`<video src="/v.mp4" poster="/p.png" controls><source src="/s.webm" type="video/webm"><track src="/t.vtt" kind="subtitles"></video><audio src="a.mp3"></audio>`,
	],
	[
		"srcset",
		`<img srcset="/a.png 1x, /b.png 2x" sizes="100vw"><img srcset="  /c.png   100w,/d.png 200w  "><picture><source srcset="/e.webp" type="image/webp"><img src="/f.png"></picture>`,
	],
	[
		"srcset-odd",
		`<img srcset="data:image/png;base64,AA== 1x, x.png"><img srcset="/a,b.png 1x"><img srcset=",,, /c.png 2x,,"><img srcset="/d.png	1.5x,
/e.png 3x">`,
	],
	[
		"style-attr",
		`<div style="background:url(/bg.png); color: red"></div><div style='background-image:url("a b.png")'></div><p style="font-family:&quot;Foo Bar&quot;; background:url('/q.png')">q</p><span style="">e</span>`,
	],
	[
		"style-element",
		`<style>@import "/i.css"; @import url(/j.css) screen; body { background: url(/x.png) } .a { content: "url(/no)" } @font-face { src: url(f.woff2) format("woff2") }</style>`,
	],
	[
		"inline-scripts",
		`<script>var a = "</scr" + "ipt>"; location.href; top.x = 1;</script><script type="module">import x from "/m.js"; export {};</script><script>  </script><script></script>`,
	],
	[
		"script-data-blocks",
		`<script type="application/json">{"a":"/x","b":"<\\/b>"}</script><script type="application/ld+json">{"@context": "https://schema.org"}</script><script type="text/template"><a href="/t">t</a></script><script type="text/x-unknown">location</script>`,
	],
	[
		"importmap",
		`<script type="importmap">{ "imports": { "a": "/a.js", "b": "https://x.test/b.js" },
  "scopes": {} }</script>`,
	],
	[
		"script-attrs",
		`<script src="/s.js" async defer nonce="abc" integrity="sha256-xyz" crossorigin="anonymous" referrerpolicy="no-referrer" nomodule></script><script language="javascript">x</script><script type="text/javascript; charset=utf-8">y</script>`,
	],
	[
		"handlers",
		`<div onclick="alert(1)" onmouseover='foo("x")' ONKEYDOWN="k" onfoo="not-a-handler"></div><img src="/h.png" onerror="void 0" onload="void 0"><body onload="b"><svg onload="s"></svg>`,
	],
	[
		"iframe-attrs",
		`<iframe sandbox="allow-scripts allow-same-origin" srcdoc="<p class=&quot;a&quot;>&amp;amp; &lt;b&gt;</p><script>parent.x=1</script>" allow="camera" name="n" src="/f"></iframe><iframe srcdoc='<a href="/in">in</a>'></iframe>`,
	],
	[
		"meta-base",
		`<meta http-equiv="refresh" content="5; url=/next"><meta http-equiv="Content-Security-Policy" content="default-src 'self'"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><base href="/sub/" target="_blank">`,
	],
	[
		"entities",
		`<p title="a &amp; b &lt; c &gt; d &quot; &#39; &nbsp; &amp;amp;">x &amp; &lt; &gt; &nbsp; &copy; &#x1F600; &notanentity; &amp</p><a href="/e?a=1&copy=2&amp;b=3">e</a>`,
	],
	[
		"uppercase",
		`<DIV ID="A" CLASS="B"><A HREF="/U">U</A><IMG SRC="/I.PNG" ONERROR="void 0"><SVG VIEWBOX="0 0 1 1"><CLIPPATH><RECT/></CLIPPATH></SVG></DIV>`,
	],
	[
		"duplicate-attrs",
		`<a href="/first" href="/second" id="1" id="2">d</a><a href="/x" HREF="/y">c</a><img src="/1" onerror="void 1" onerror="void 2">`,
	],
	[
		"valueless-attrs",
		`<input disabled checked value><option selected>o</option><a href>e</a><img src><script src></script><iframe srcdoc></iframe>`,
	],
	[
		"unquoted-attrs",
		`<a href=/x?a=1&b=2 class=c title=t>u</a><img src=x.png alt=a><a href=/y/ id=z>slash</a><a title=a"b'c>q</a>`,
	],
	[
		"attr-order",
		`<img alt="a" src="/s" id="i" onerror="void 0" class="c"><a id="1" href="/h" style="color:red" title="t" onclick="c">o</a>`,
	],
	[
		"comments",
		`<!-- c1 --><div><!--<a href="/x">--></div><!----><!--->x<!-- <script>y</script> --><!--a--!>b`,
	],
	[
		"svg",
		`<svg viewBox="0 0 1 1"><![CDATA[<a href="/x">]]><a href="/y" xlink:href="/yy"><text>t</text></a><image href="/i.png" xlink:href="/j.png"/><use href="#a"/><path d="M0 0"/><foreignObject><div style="background:url(/fo.png)"><a href="/fa">fa</a></div></foreignObject></svg>`,
	],
	[
		"svg-style-script",
		`<svg><style>@import url(/s.css); rect { fill: url(#g) } .b { background: url(/b.png) }</style><script href="/s.js">var x = location;</script><script>top</script></svg>`,
	],
	[
		"math",
		`<math><mi href="/m">x</mi><mtext><a href="/mt">t</a></mtext><annotation-xml encoding="text/html"><a href="/ax">a</a></annotation-xml><annotation-xml><a href="/ax2">b</a></annotation-xml></math>`,
	],
	[
		"template",
		`<template><a href="/t">t</a><script>x</script><img src="/i" onerror="void 0"><style>a{background:url(/tb.png)}</style></template><template shadowrootmode="open"><b>dsd via innerHTML</b></template>`,
	],
	[
		"noscript",
		`<noscript><a href="/n">n</a><img src="/ni.png"><p title="</noscript>">x</noscript>`,
	],
	[
		"rcdata",
		`<textarea><a href="/x">&amp;</a></textarea><title><img src="/t" onerror="y">&lt;</title>`,
	],
	["plaintext", `<p>a</p><plaintext><a href="/x"></a></plaintext>more &amp;`],
	[
		"rawtext-elements",
		`<xmp><a href="/x" onclick="y">&amp;</a></xmp><iframe><a href="/if"></a></iframe><noembed><img src="/ne"></noembed><noframes><img src="/nf"></noframes>`,
	],
	[
		"table-foster",
		`<table><a href="/f">f</a><tr><td>c</td></tr>text<img src="/fi"><caption>x</caption></table>`,
	],
	[
		"malformed",
		`<a href="/1"><b>x</a>y</b><p><div>z<p>q</div><img src="/u" <span>s</span><a href="/unterminated`,
	],
	[
		"select-object",
		`<select><option value="/v">a<option>b<optgroup label=g><option>c</select><object data="/o.bin" type="x/y"><param name="movie" value="/m.swf"><embed src="/e.swf"></object>`,
	],
	[
		"anchor-extras",
		`<a href="/d" download="f.txt" ping="/p1 /p2" rel="noopener" referrerpolicy="no-referrer" target="_top" hreflang="en">d</a><area href="/ar" shape="rect"><blockquote cite="/c">q</blockquote><table background="/bg.png"></table>`,
	],
	[
		"whitespace-urls",
		`<a href="  /spaced  ">s</a><img src="
/nl.png"><a href="/tab	in">t</a><a href="/\u00fc?q=\u65e5\u672c#frag">\u00fc</a>`,
	],
	[
		"unknown-elements",
		`<x-foo href="/x" src="/y" onclick="z"></x-foo><div src="/z" action="/a" poster="/p"></div><my-el><a href="/in-custom">c</a></my-el>`,
	],
	[
		"link-preload",
		`<link rel="preload" as="image" imagesrcset="/a.png 1x, /b.png 2x" imagesizes="50vw" href="/c.png"><link rel="icon" href="/fav.ico"><link rel="modulepreload" href="/m.js">`,
	],
	// the proxy stores its bookkeeping in scramjet-attr-* attributes; one the
	// page wrote itself is not bookkeeping and must come back as written
	[
		"page-authored-scramjet-attr",
		`<div data-href="/x" scramjet-attr-href="/spoof" href="/real"></div><a scramjet-attr-href="/mirror">m</a><script scramjet-attr-script-source-src="Zm9v">bar</script>`,
	],
];

// --- context elements -------------------------------------------------------

// each builds `el`, the context element, inside `parent`
const CONTEXTS: Record<string, string> = {
	div: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("div"));`,
	svg: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElementNS(SVG, "svg"));`,
	"svg-g": `const parent = document.createElementNS(SVG, "svg"); const el = parent.appendChild(document.createElementNS(SVG, "g"));`,
	"svg-foreignobject": `const parent = document.createElementNS(SVG, "svg"); const el = parent.appendChild(document.createElementNS(SVG, "foreignObject"));`,
	"svg-desc": `const parent = document.createElementNS(SVG, "svg"); const el = parent.appendChild(document.createElementNS(SVG, "desc"));`,
	"svg-title": `const parent = document.createElementNS(SVG, "svg"); const el = parent.appendChild(document.createElementNS(SVG, "title"));`,
	"svg-style": `const parent = document.createElementNS(SVG, "svg"); const el = parent.appendChild(document.createElementNS(SVG, "style"));`,
	"html-in-foreignobject": `const svg = document.createElementNS(SVG, "svg"); const parent = svg.appendChild(document.createElementNS(SVG, "foreignObject")); const el = parent.appendChild(document.createElement("div"));`,
	math: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElementNS(MATH, "math"));`,
	"math-mi": `const parent = document.createElementNS(MATH, "math"); const el = parent.appendChild(document.createElementNS(MATH, "mi"));`,
	"math-mtext": `const parent = document.createElementNS(MATH, "math"); const el = parent.appendChild(document.createElementNS(MATH, "mtext"));`,
	"math-annotation-xml-html": `const parent = document.createElementNS(MATH, "math"); const el = parent.appendChild(document.createElementNS(MATH, "annotation-xml")); el.setAttribute("encoding", "TEXT/HTML");`,
	"math-annotation-xml-plain": `const parent = document.createElementNS(MATH, "math"); const el = parent.appendChild(document.createElementNS(MATH, "annotation-xml"));`,
	template: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("template"));`,
	table: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("table"));`,
	tbody: `const parent = document.createElement("table"); const el = parent.appendChild(document.createElement("tbody"));`,
	tr: `const parent = document.createElement("tbody"); const el = parent.appendChild(document.createElement("tr"));`,
	select: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("select"));`,
	textarea: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("textarea"));`,
	title: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("title"));`,
	style: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("style"));`,
	script: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("script")); el.type = "text/plain";`,
	noscript: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("noscript"));`,
	xmp: `const parent = document.createElement("div"); const el = parent.appendChild(document.createElement("xmp"));`,
};

const PROBE = `<p>a<a href="/x">l</a></p><style>b{background:url(/s.png)}</style><path d="M0"/><img src="/i.png" onerror="void 0"><tr><td>c</td></tr><![CDATA[cd]]><title>&amp;t</title>`;
const SMALL = `<path/><b title="/q">P</b>`;

const contextTest = (kind: string) =>
	differential(
		`ctx-${kind}`,
		`(() => {
			const out = {};
			const make = () => { ${CONTEXTS[kind]} return { parent, el }; };
			{
				const { parent, el } = make();
				el.innerHTML = ${JSON.stringify(PROBE)};
				out.innerHTML = { parent: __ser(parent), el: __ser(el), count: el.childNodes.length };
			}
			{
				const { parent, el } = make();
				out.setHTMLUnsafe = el.setHTMLUnsafe ? __try(() => { el.setHTMLUnsafe(${JSON.stringify(PROBE)}); return __ser(parent); }) : "n/a";
			}
			{
				const { parent, el } = make();
				el.textContent = "base";
				out.adjacent = {};
				for (const pos of ["beforebegin", "afterbegin", "beforeend", "afterend"]) {
					out.adjacent[pos] = __try(() => { el.insertAdjacentHTML(pos, ${JSON.stringify(SMALL)}.replace("P", pos)); return "ok"; });
				}
				out.adjacent.result = __ser(parent);
				out.adjacent.elText = el.textContent;
			}
			{
				const { parent, el } = make();
				out.outer = __try(() => { el.outerHTML = ${JSON.stringify(PROBE)}; return __ser(parent); });
			}
			{
				const { parent, el } = make();
				const child = el.appendChild(document.createElementNS(el.namespaceURI, "span"));
				out.childOuter = __try(() => { child.outerHTML = ${JSON.stringify(SMALL)}; return { parent: __ser(parent), elText: el.textContent }; });
			}
			return out;
		})()`
	);

// --- escapes ------------------------------------------------------------------

// the payload is a fragment the browser parses into a live <img onerror>, set
// through `sink` on a context element built by `setup`
const markupEscape =
	(name: string, setup: string, sink: (html: string) => string) =>
	(html: string) =>
		escapeTest(
			name,
			`
				${setup}
				document.body.append(root);
				${sink(JSON.stringify(html))}
				${SAFE_COMPLETION}
			`
		);

const intoDiv = (name: string, html: string) =>
	markupEscape(
		name,
		`const root = document.createElement("div"); const el = root;`,
		(h) => `el.innerHTML = ${h};`
	)(html);

export default [
	...CORPUS.map(([name, html]) => roundtrip(name, html)),
	...Object.keys(CONTEXTS).map(contextTest),

	// --- sink edge cases ------------------------------------------------------

	differential(
		"sink-errors",
		`(() => {
			const detached = document.createElement("div");
			const r = {};
			r.detachedBeforebegin = __try(() => detached.insertAdjacentHTML("beforebegin", "<b>x</b>"));
			r.detachedAfterend = __try(() => detached.insertAdjacentHTML("afterend", "<b>x</b>"));
			r.badPosition = __try(() => detached.insertAdjacentHTML("middle", "<b>x</b>"));
			r.caseInsensitive = __try(() => { detached.insertAdjacentHTML("BeforeEnd", "<b>y</b>"); return detached.innerHTML; });
			r.detachedOuter = __try(() => { const d = document.createElement("div"); d.outerHTML = "<b>gone</b>"; return d.outerHTML; });
			r.documentElementOuter = __try(() => { document.documentElement.outerHTML = "<p>no</p>"; return "set"; });
			r.documentElementBeforebegin = __try(() => { document.documentElement.insertAdjacentHTML("beforebegin", "<p>no</p>"); return "set"; });
			r.stillHere = document.documentElement.localName + ":" + !!document.body;
			return r;
		})()`
	),
	differential(
		"sink-coercion",
		`(() => {
			const d = document.createElement("div");
			const r = {};
			d.innerHTML = null; r.nullInner = d.innerHTML;
			d.innerHTML = undefined; r.undefInner = d.innerHTML;
			d.innerHTML = { toString() { return '<i title="/o">o</i>'; } }; r.objInner = d.innerHTML;
			d.innerHTML = 42; r.numInner = d.innerHTML;
			if (d.setHTMLUnsafe) { d.setHTMLUnsafe(null); r.nullUnsafe = d.innerHTML; }
			d.insertAdjacentHTML("beforeend", null); r.nullAdjacent = d.innerHTML;
			const s = document.createElement("script"); s.type = "text/plain";
			s.innerHTML = null; r.scriptNull = [s.innerHTML, s.textContent, s.childNodes.length];
			r.symbol = __try(() => { d.innerHTML = Symbol(); });
			return r;
		})()`
	),
	differential(
		"outerhtml-in-fragment",
		`(() => {
			const frag = document.createDocumentFragment();
			const el = frag.appendChild(document.createElement("span"));
			el.outerHTML = '<td>cell</td><b title="/t">y</b><tr><td>z</td></tr>';
			return __shape(frag);
		})()`
	),
	differential(
		"outerhtml-getter-contexts",
		`(() => {
			const svg = document.createElementNS(SVG, "svg");
			const rect = svg.appendChild(document.createElementNS(SVG, "rect"));
			rect.setAttribute("href", "/r");
			const style = svg.appendChild(document.createElementNS(SVG, "style"));
			style.textContent = "a{background:url(/q.png)} <b>";
			const fo = svg.appendChild(document.createElementNS(SVG, "foreignObject"));
			const s2 = fo.appendChild(document.createElement("style"));
			s2.textContent = "b{background:url(/r.png)} <i>";
			const ta = document.createElement("textarea");
			ta.textContent = "<a href='/x'>&amp;</a>";
			return [rect.outerHTML, style.outerHTML, s2.outerHTML, fo.outerHTML, svg.outerHTML, ta.outerHTML, ta.innerHTML];
		})()`
	),
	differential(
		"rawtext-context-sinks",
		`(() => {
			const r = {};
			for (const tag of ["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noscript"]) {
				const el = document.createElement(tag);
				if (tag === "script") el.type = "text/plain";
				el.innerHTML = '<a href="/x" onclick="y">&amp;</a>';
				const first = [el.innerHTML, el.textContent, el.childNodes.length];
				if (el.setHTMLUnsafe) el.setHTMLUnsafe('<img src="/u">');
				const second = [el.innerHTML, el.textContent, el.childNodes.length];
				el.insertAdjacentHTML("afterbegin", '<b title="/a">');
				el.insertAdjacentHTML("beforeend", "<i>");
				r[tag] = [first, second, el.innerHTML, el.textContent, el.childNodes.length, el.outerHTML, el.getHTML ? el.getHTML() : "n/a"];
			}
			return r;
		})()`
	),

	// --- shadow DOM -----------------------------------------------------------

	differential(
		"shadow-innerhtml",
		`(() => {
			const host = document.createElement("div");
			const sr = host.attachShadow({ mode: "open" });
			sr.innerHTML = '<style>:host{background:url(/h.png)}</style><a href="/s" onclick="x">s</a><slot></slot><img src="/si.png" srcset="/a 1x">';
			return {
				inner: sr.innerHTML,
				get: sr.getHTML ? sr.getHTML() : "n/a",
				hostGet: host.getHTML ? host.getHTML({ serializableShadowRoots: true }) : "n/a",
				hostGetRoots: host.getHTML ? host.getHTML({ shadowRoots: [sr] }) : "n/a",
				hostOuter: host.outerHTML,
				shape: __shape(sr),
				urls: __urls(sr),
				attrs: __attrs(sr),
			};
		})()`
	),
	differential(
		"shadow-serializable",
		`(() => {
			const host = document.createElement("div");
			host.innerHTML = '<b title="/light">light</b>';
			let sr;
			try { sr = host.attachShadow({ mode: "open", serializable: true, clonable: true }); } catch (e) { return "!" + e.name; }
			if (sr.setHTMLUnsafe) sr.setHTMLUnsafe('<a href="/s">s</a><slot></slot><div><template shadowrootmode="closed"><i>nested</i></template></div>');
			else sr.innerHTML = '<a href="/s">s</a><slot></slot>';
			const clone = host.cloneNode(true);
			return {
				serializable: sr.serializable, clonable: sr.clonable,
				get: host.getHTML({ serializableShadowRoots: true }),
				getPlain: host.getHTML(),
				srGet: sr.getHTML({ serializableShadowRoots: true }),
				inner: sr.innerHTML,
				cloneShadow: clone.shadowRoot ? clone.shadowRoot.innerHTML : null,
				shape: __shape(host),
			};
		})()`
	),
	differential(
		"declarative-shadow-sethtmlunsafe",
		`(() => {
			const d = document.createElement("div");
			if (!d.setHTMLUnsafe) return "n/a";
			d.setHTMLUnsafe('<div id="h"><template shadowrootmode="open" shadowrootserializable shadowrootclonable shadowrootdelegatesfocus><style>a{background:url(/d.png)}</style><a href="/dsd" onclick="x">in</a><slot></slot></template><b>light</b></div><div id="c"><template shadowrootmode="closed"><i>closed</i></template></div><div id="bad"><template shadowrootmode="bogus"><u>stays</u></template></div>');
			const h = d.querySelector("#h");
			return {
				open: h.shadowRoot && [h.shadowRoot.mode, h.shadowRoot.delegatesFocus, h.shadowRoot.serializable, h.shadowRoot.clonable, h.shadowRoot.innerHTML],
				closedHidden: d.querySelector("#c").shadowRoot,
				closedEmpty: d.querySelector("#c").childNodes.length,
				bad: d.querySelector("#bad").innerHTML,
				get: d.getHTML({ serializableShadowRoots: true }),
				inner: d.innerHTML,
				clone: (() => { const c = h.cloneNode(true); return c.shadowRoot ? c.shadowRoot.innerHTML : null; })(),
				shape: __shape(d),
			};
		})()`
	),
	differential(
		"declarative-shadow-other-sinks",
		`(() => {
			const html = '<div><template shadowrootmode="open"><a href="/x">x</a></template></div>';
			const r = {};
			const a = document.createElement("div"); a.innerHTML = html;
			r.innerHTML = [!!a.firstChild.shadowRoot, a.innerHTML];
			const b = document.createElement("div"); b.insertAdjacentHTML("beforeend", html);
			r.adjacent = [!!b.firstChild.shadowRoot, b.innerHTML];
			const doc = new DOMParser().parseFromString(html, "text/html");
			r.domparser = [!!doc.body.firstChild.shadowRoot, doc.body.innerHTML];
			if (Document.parseHTMLUnsafe) {
				const p = Document.parseHTMLUnsafe(html);
				r.parseHTMLUnsafe = [!!p.body.firstChild.shadowRoot, p.body.firstChild.shadowRoot && p.body.firstChild.shadowRoot.innerHTML];
			}
			const host = document.createElement("div");
			const sr = host.attachShadow({ mode: "open" });
			if (sr.setHTMLUnsafe) { sr.setHTMLUnsafe(html); r.shadowUnsafe = [!!sr.firstChild.shadowRoot, sr.firstChild.shadowRoot && sr.firstChild.shadowRoot.innerHTML]; }
			const range = document.createRange(); range.selectNodeContents(document.body);
			const frag = range.createContextualFragment(html);
			r.contextual = [!!frag.firstChild.shadowRoot, __shape(frag)];
			return r;
		})()`
	),

	// --- Sanitizer API ----------------------------------------------------------

	differential(
		"sethtml-sanitizer",
		`(() => {
			const d = document.createElement("div");
			if (typeof d.setHTML !== "function") return "n/a";
			const r = {};
			d.setHTML('<a href="/x" onclick="y">a</a><a href="javascript:alert(1)">j</a><script>z</script><img src="/i" onerror="q" srcset="/s 2x"><style>a{background:url(/b.png)}</style><iframe src="/f"></iframe><div style="background:url(/st.png)">s</div>');
			r.default = [d.innerHTML, __shape(d), __urls(d)];
			r.custom = __try(() => { d.setHTML('<a href="/x" title="t">a</a><b>b</b><i onclick="x">i</i>', { sanitizer: { elements: ["a", "i"], attributes: ["href"] } }); return [d.innerHTML, __shape(d)]; });
			const s = document.createElement("script"); s.type = "text/plain";
			r.script = __try(() => { s.setHTML("location.href"); return [s.innerHTML, s.textContent, s.childNodes.length]; });
			const st = document.createElement("style");
			r.style = __try(() => { st.setHTML("a{background:url(/z.png)} <b>"); return [st.innerHTML, st.textContent, st.childNodes.length]; });
			const host = document.createElement("div"); const sr = host.attachShadow({ mode: "open" });
			r.shadow = typeof sr.setHTML === "function" ? __try(() => { sr.setHTML('<a href="/sh" onclick="x">s</a><script>y</script>'); return sr.innerHTML; }) : "n/a";
			return r;
		})()`
	),

	// --- DOMParser --------------------------------------------------------------

	differential(
		"domparser-html",
		`(async () => {
			window.__elmDp = 0;
			const doc = new DOMParser().parseFromString('<!doctype html><html><head><base href="/sub/"><title>t &amp; t</title><style>a{background:url(/x.png)}</style><script>window.__elmDp++</script></head><body onload="window.__elmDp++"><a href="rel">r</a><img src="/i.png" onerror="window.__elmDp++"><noscript><p title="/n">ns</p></noscript><iframe srcdoc="<b>x</b>"></iframe></body></html>', "text/html");
			await __sleep(100);
			return {
				ran: window.__elmDp,
				url: doc.URL === location.href ? "same" : doc.URL,
				baseURI: doc.baseURI,
				aHref: doc.querySelector("a").href,
				outer: doc.documentElement.outerHTML,
				xml: new XMLSerializer().serializeToString(doc),
				shape: __shape(doc),
				attrs: __attrs(doc),
				title: doc.title,
				scriptText: doc.querySelector("script").textContent,
				noscriptKids: doc.querySelector("noscript").childNodes.length,
				compat: doc.compatMode, contentType: doc.contentType, charset: doc.characterSet,
			};
		})()`
	),
	differential(
		"domparser-html-quirks-fragments",
		`(() => {
			const p = new DOMParser();
			const r = {};
			for (const src of ['<a href="/x">x</a>', '<svg><style><img src="/s"></style></svg>', '<table><tr><td>a</td></tr></table>t', '', '<frameset><frame src="/f"></frameset>', '<html><head></head><body><body title="/b"></body>']) {
				const d = p.parseFromString(src, "text/html");
				r[src] = [d.documentElement.outerHTML, d.compatMode];
			}
			return r;
		})()`
	),
	differential(
		"domparser-xhtml",
		`(async () => {
			window.__elmDx = 0;
			const doc = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><head><script>window.__elmDx++</script><style>a{background:url(/x.png)}</style></head><body><a href="/xa" onclick="y">a</a><img src="/xi.png" onerror="window.__elmDx++"/><br/><p>&amp;<![CDATA[<b>]]></p></body></html>', "application/xhtml+xml");
			await __sleep(100);
			return {
				ran: window.__elmDx,
				url: doc.URL === location.href ? "same" : doc.URL,
				outer: doc.documentElement.outerHTML,
				xml: new XMLSerializer().serializeToString(doc),
				shape: __shape(doc),
				attrs: __attrs(doc),
				contentType: doc.contentType,
				bodyInner: doc.body && doc.body.innerHTML,
			};
		})()`
	),
	differential(
		"domparser-svg",
		`(async () => {
			window.__elmDs = 0;
			const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="window.__elmDs++"><script>window.__elmDs++</script><style>rect{fill:url(/g.svg#g)}</style><image href="/i.png" xlink:href="/j.png"/><a xlink:href="/l"><text>t</text></a><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><a href="/fa">fa</a></div></foreignObject></svg>', "image/svg+xml");
			await __sleep(100);
			return {
				ran: window.__elmDs,
				outer: doc.documentElement.outerHTML,
				inner: doc.documentElement.innerHTML,
				xml: new XMLSerializer().serializeToString(doc),
				shape: __shape(doc),
				attrs: __attrs(doc),
				image: [doc.querySelector("image").href.baseVal, doc.querySelector("image").getAttributeNS("http://www.w3.org/1999/xlink", "href")],
				contentType: doc.contentType,
			};
		})()`
	),
	differential(
		"domparser-xml",
		`(() => {
			const p = new DOMParser();
			const good = p.parseFromString('<?xml version="1.0"?><?pi data?><root xmlns:h="http://www.w3.org/1999/xhtml"><h:a href="/x">a</h:a><item src="/s" onclick="c"><![CDATA[<b href="/c">]]></item><!-- c --></root>', "text/xml");
			const appXml = p.parseFromString('<r><script>location</script></r>', "application/xml");
			const bad = p.parseFromString('<root><unclosed></root>', "text/xml");
			return {
				good: [new XMLSerializer().serializeToString(good), __shape(good), good.documentElement.outerHTML, good.contentType],
				appXml: [appXml.documentElement.outerHTML, appXml.contentType],
				badHasError: bad.getElementsByTagName("parsererror").length > 0,
				badRoot: bad.documentElement.localName,
				invalidType: __try(() => p.parseFromString("<a/>", "text/plain")),
			};
		})()`
	),
	differential(
		"domparser-adopt",
		`(() => {
			const doc = new DOMParser().parseFromString('<a href="/adopt?x=1&amp;y" onclick="z">a</a><img srcset="/a.png 1x"><style>b{background:url(/sb.png)}</style>', "text/html");
			const host = document.createElement("div");
			for (const n of Array.from(doc.body.childNodes)) host.appendChild(document.adoptNode(n));
			const imported = document.importNode(new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><a href="/sv">s</a></svg>', "image/svg+xml").documentElement, true);
			host.appendChild(imported);
			return { inner: host.innerHTML, shape: __shape(host), urls: __urls(host) };
		})()`
	),
	differential(
		"parsehtmlunsafe",
		`(() => {
			if (!Document.parseHTMLUnsafe) return "n/a";
			const d = Document.parseHTMLUnsafe('<!doctype html><base href="/b/"><a href="rel" onclick="x">r</a><script>window.__elmPh = 1</script><noscript><i>n</i></noscript><div><template shadowrootmode="open"><a href="/sh">sh</a></template></div>');
			return {
				url: d.URL, baseURI: d.baseURI, aHref: d.querySelector("a").href,
				outer: d.documentElement.outerHTML,
				ran: window.__elmPh === 1,
				noscriptKids: d.querySelector("noscript").childNodes.length,
				shadow: d.querySelector("div").shadowRoot && d.querySelector("div").shadowRoot.innerHTML,
				shape: __shape(d),
			};
		})()`
	),

	// --- createContextualFragment ------------------------------------------------

	differential(
		"contextual-contexts",
		`(() => {
			const r = {};
			const html = '<tr><td>c</td></tr><style>a{background:url(/c.png)}</style><path/><a href="/x" onclick="y">a</a><![CDATA[q]]>';
			const make = {
				div: () => document.createElement("div"),
				svg: () => document.createElementNS(SVG, "svg"),
				foreignObject: () => document.createElementNS(SVG, "svg").appendChild(document.createElementNS(SVG, "foreignObject")),
				math: () => document.createElementNS(MATH, "math"),
				mi: () => document.createElementNS(MATH, "math").appendChild(document.createElementNS(MATH, "mi")),
				table: () => document.createElement("table"),
				tbody: () => document.createElement("table").appendChild(document.createElement("tbody")),
				select: () => document.createElement("select"),
				template: () => document.createElement("template"),
				textarea: () => document.createElement("textarea"),
				style: () => document.createElement("style"),
				script: () => { const s = document.createElement("script"); s.type = "text/plain"; return s; },
			};
			for (const k in make) {
				const el = make[k]();
				const range = document.createRange();
				range.selectNodeContents(el);
				r[k] = __try(() => { const f = range.createContextualFragment(html); const holder = document.createElement("div"); holder.append(f.cloneNode(true)); return [__shape(f), holder.innerHTML]; });
			}
			const t = document.createElement("div"); t.textContent = "text";
			const range = document.createRange(); range.setStart(t.firstChild, 2);
			r.textStart = __shape(range.createContextualFragment(html));
			const dr = document.createRange(); dr.setStart(document, 0);
			r.documentStart = __try(() => __shape(dr.createContextualFragment(html)));
			return r;
		})()`
	),
	differential(
		"contextual-scripts-run",
		`(async () => {
			window.__elmCf = [];
			const range = document.createRange();
			range.selectNodeContents(document.body);
			const frag = range.createContextualFragment('<script>window.__elmCf.push("inline")<\\/script><img src="x:" onerror="window.__elmCf.push(\\'onerror\\')"><script type="text/plain">window.__elmCf.push("plain")<\\/script>');
			const beforeInsert = window.__elmCf.slice();
			const holder = document.createElement("div");
			document.body.append(holder);
			holder.append(frag);
			await __sleep(150);
			const viaInner = document.createElement("div");
			document.body.append(viaInner);
			viaInner.innerHTML = '<script>window.__elmCf.push("innerHTML")<\\/script>';
			viaInner.insertAdjacentHTML("beforeend", '<script>window.__elmCf.push("adjacent")<\\/script>');
			if (viaInner.setHTMLUnsafe) viaInner.setHTMLUnsafe('<script>window.__elmCf.push("unsafe")<\\/script>');
			await __sleep(50);
			const out = { beforeInsert, after: window.__elmCf.slice().sort(), holder: holder.innerHTML };
			holder.remove(); viaInner.remove();
			return out;
		})()`
	),

	// --- document.write ------------------------------------------------------------

	differential(
		"documentwrite-iframe",
		`(async () => {
			const f = document.createElement("iframe");
			document.body.append(f);
			const d = f.contentDocument;
			d.open();
			d.write('<!doctype html><html><head><style>a{background:url(/w.png)}</style></head><body><a href="/w" onclick="x">w</a><img src="rel.png" srcset="/a 1x">');
			d.write('<div cl', 'ass="c">split</d', 'iv>');
			d.writeln('<p title="&amp;">l</p>');
			d.close();
			const r = {
				outer: d.documentElement.outerHTML,
				bodyInner: d.body.innerHTML,
				shape: __shape(d),
				attrs: __attrs(d),
				urlSame: d.URL === location.href,
				aHref: d.querySelector("a").href,
				imgSrc: d.querySelector("img").src,
			};
			d.body.innerHTML = '<a href="/again">again</a>';
			r.reinner = [d.body.innerHTML, d.querySelector("a").href];
			f.remove();
			return r;
		})()`
	),
	differential(
		"documentwrite-scripts-and-noscript",
		`(async () => {
			window.__elmDw = [];
			const f = document.createElement("iframe");
			document.body.append(f);
			const d = f.contentDocument;
			d.open();
			d.write('<script>parent.__elmDw.push("script")<\\/script><noscript><a href="/n">n</a></noscript><img src="x:" onerror="parent.__elmDw.push(\\'onerror\\')"><xmp><b>x</b></xmp>');
			d.close();
			await __sleep(150);
			const r = { ran: window.__elmDw.slice().sort(), body: d.body.innerHTML, noscript: d.querySelector("noscript").childNodes.length };
			f.remove();
			return r;
		})()`
	),
	differential(
		"documentwrite-implementation-doc",
		`(() => {
			const d = document.implementation.createHTMLDocument("x");
			d.open();
			d.write('<base href="/b/"><a href="rel">r</a><svg><style><i>s</i></style></svg><noscript><u>n</u></noscript>');
			d.close();
			return { outer: d.documentElement.outerHTML, url: d.URL, aHref: d.querySelector("a").href, shape: __shape(d) };
		})()`
	),

	// --- frames -------------------------------------------------------------------

	differential(
		"frames-about-blank",
		`(() => {
			const f = document.createElement("iframe");
			const before = [f.contentWindow, f.contentDocument];
			document.body.append(f);
			const w = f.contentWindow, d = f.contentDocument;
			const r = {
				before,
				frames: w === window.frames[window.frames.length - 1],
				length: window.length,
				doc: d === w.document,
				parent: w.parent === window,
				frameElement: w.frameElement === f,
				url: d.URL,
				href: w.location.href,
				baseURI: d.baseURI === location.href,
				readyState: d.readyState,
				outer: d.documentElement.outerHTML,
				svg: f.getSVGDocument(),
				stable: f.contentWindow === w && f.contentDocument === d,
			};
			d.body.innerHTML = '<a href="/inframe" onclick="x">i</a><img src="rel.png">';
			r.inner = [d.body.innerHTML, d.querySelector("a").href, d.querySelector("img").src, __attrs(d.body)];
			f.remove();
			r.after = [f.contentWindow, f.contentDocument, f.getSVGDocument()];
			return r;
		})()`
	),
	differential(
		"frames-srcdoc",
		`(async () => {
			const f = document.createElement("iframe");
			f.srcdoc = '<p title="a&amp;b &quot;q&quot;">&lt;x&gt;</p><a href="/sd" onclick="c">l</a><script>window.__inner = 1<\\/script>';
			const loaded = __load(f);
			document.body.append(f);
			const state = await loaded;
			const d = f.contentDocument, w = f.contentWindow;
			const r = {
				state,
				srcdocAttr: f.getAttribute("srcdoc"),
				outerOfFrame: f.outerHTML,
				url: d.URL,
				href: w.location.href,
				baseURI: d.baseURI === location.href,
				body: d.body.innerHTML,
				aHref: d.querySelector("a").href,
				ran: w.__inner,
				frames: w === window.frames[window.frames.length - 1],
				svg: f.getSVGDocument(),
			};
			d.body.innerHTML = '<img src="/rt.png" srcset="/rt2.png 2x"><style>a{background:url(/sb.png)}</style>';
			r.roundtrip = [d.body.innerHTML, __attrs(d.body)];
			f.remove();
			r.after = [f.contentWindow, f.contentDocument];
			return r;
		})()`
	),
	differential(
		"frames-same-origin-src",
		`(async () => {
			const f = document.createElement("iframe");
			f.src = "/elmarkup-missing?q=1#h";
			const loaded = __load(f);
			document.body.append(f);
			const state = await loaded;
			const d = f.contentDocument;
			const r = {
				state,
				srcAttr: f.getAttribute("src"),
				src: f.src,
				url: d.URL,
				href: f.contentWindow.location.href,
				body: d.body && d.body.textContent,
				outer: d.documentElement.outerHTML,
				frameElement: f.contentWindow.frameElement === f,
			};
			f.remove();
			r.after = [f.contentWindow, f.contentDocument];
			return r;
		})()`
	),
	differential(
		"frames-detached-and-nested",
		`(() => {
			const r = {};
			const f = document.createElement("iframe");
			f.src = "/never";
			r.detached = [f.contentWindow, f.contentDocument, f.getSVGDocument()];
			const holder = document.createElement("div");
			holder.append(f);
			r.inDetachedDiv = [f.contentWindow, f.contentDocument];
			const outer = document.createElement("iframe");
			document.body.append(outer);
			const inner = outer.contentDocument.createElement("iframe");
			outer.contentDocument.body.append(inner);
			r.nested = [inner.contentWindow.parent === outer.contentWindow, inner.contentWindow.top === window.top, outer.contentWindow.frames[0] === inner.contentWindow, outer.contentWindow.length];
			const again = document.createElement("iframe");
			document.body.append(again);
			const w = again.contentWindow;
			again.remove();
			r.removed = [again.contentWindow, again.contentDocument, w.closed, w.parent === null];
			outer.remove();
			return r;
		})()`
	),
	differential(
		"frames-object-embed",
		`(() => {
			const r = {};
			const o = document.createElement("object");
			r.objectDetached = [o.contentWindow, o.contentDocument, o.getSVGDocument()];
			document.body.append(o);
			r.objectNoData = [o.contentWindow, o.contentDocument, o.getSVGDocument()];
			const e = document.createElement("embed");
			document.body.append(e);
			r.embed = [e.getSVGDocument(), "contentDocument" in e, "contentWindow" in e];
			o.remove(); e.remove();
			const div = document.createElement("div");
			div.innerHTML = '<object data="/o.svg" type="image/svg+xml"><img src="/fallback.png"></object><embed src="/e.svg" type="image/svg+xml">';
			r.markup = [div.innerHTML, __urls(div)];
			return r;
		})()`
	),
	differential(
		"frames-innerhtml-iframe",
		`(async () => {
			const d = document.createElement("div");
			d.innerHTML = '<iframe srcdoc="<a href=&quot;/in&quot;>in</a>" name="named"></iframe>';
			const f = d.firstChild;
			const loaded = __load(f);
			document.body.append(d);
			const state = await loaded;
			const r = {
				state,
				named: window.frames.named === f.contentWindow,
				body: f.contentDocument.body.innerHTML,
				href: f.contentDocument.querySelector("a") && f.contentDocument.querySelector("a").href,
				outer: d.innerHTML,
			};
			d.remove();
			return r;
		})()`
	),

	// --- escapes: the tokenizer context ---------------------------------------------

	// <style> is a container inside SVG and MathML, so a breakout tag in it is
	// a real element
	intoDiv("svg-style-breakout", `<svg><style>${IMG}</style></svg>`),
	markupEscape(
		"svg-innerhtml-style",
		`const root = document.createElement("div"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));`,
		(h) => `el.innerHTML = ${h};`
	)(`<style>${IMG}</style>`),
	intoDiv("math-style-breakout", `<math><style>${IMG}</style></math>`),
	// </p> is a breakout end tag, which leaves the SVG and puts the <style>
	// back in HTML's raw text
	intoDiv("svg-p-end-style-attr", `<svg></p><style><a title="</style>${IMG}">`),
	// <p> is a breakout start tag: what follows is HTML, where a CDATA section
	// is a bogus comment that ends at the first ">"
	intoDiv("svg-p-cdata", `<svg><p><![CDATA[>${IMG}]]></svg>`),
	intoDiv("math-b-cdata", `<math><b><![CDATA[>${IMG}]]></math>`),
	intoDiv(
		"svg-font-color-cdata",
		`<svg><font color="red"><![CDATA[>${IMG}]]></svg>`
	),
	intoDiv(
		"svg-foreignobject-cdata",
		`<svg><foreignObject><![CDATA[>${IMG}]]></foreignObject></svg>`
	),
	intoDiv("svg-desc-cdata", `<svg><desc><![CDATA[>${IMG}]]></desc></svg>`),
	intoDiv("svg-title-img", `<svg><title>${IMG}</title></svg>`),
	intoDiv("math-mi-cdata", `<math><mi><![CDATA[>${IMG}]]></mi></math>`),
	intoDiv(
		"math-annotation-xml-cdata",
		`<math><annotation-xml encoding="text/html"><![CDATA[>${IMG}]]></annotation-xml></math>`
	),
	markupEscape(
		"foreignobject-innerhtml-cdata",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"));`,
		(h) => `el.innerHTML = ${h};`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"svg-desc-innerhtml-cdata",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "desc"));`,
		(h) => `el.innerHTML = ${h};`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"math-mtext-innerhtml-cdata",
		`const root = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math"); const el = root.appendChild(document.createElementNS("http://www.w3.org/1998/Math/MathML", "mtext"));`,
		(h) => `el.innerHTML = ${h};`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"annotation-xml-innerhtml-cdata",
		`const root = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math"); const el = root.appendChild(document.createElementNS("http://www.w3.org/1998/Math/MathML", "annotation-xml")); el.setAttribute("encoding", "text/html");`,
		(h) => `el.innerHTML = ${h};`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"svg-innerhtml-p-cdata",
		`const root = document.createElement("div"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));`,
		(h) => `el.innerHTML = ${h};`
	)(`<p><![CDATA[>${IMG}]]>`),

	// --- escapes: raw text the two parsers disagree on ----------------------------

	// with scripting enabled <noscript> is raw text to the fragment parser
	intoDiv("noscript-attr", `<noscript><p title="</noscript>${IMG}">`),
	intoDiv("xmp-attr", `<xmp><p title="</xmp>${IMG}">`),
	intoDiv("iframe-text-attr", `<iframe><p title="</iframe>${IMG}">`),
	intoDiv("noembed-attr", `<noembed><p title="</noembed>${IMG}">`),
	intoDiv("noframes-attr", `<noframes><p title="</noframes>${IMG}">`),
	intoDiv("textarea-attr", `<textarea><p title="</textarea>${IMG}">`),
	intoDiv("title-attr", `<title><p title="</title>${IMG}">`),
	intoDiv("style-attr", `<style><p title="</style>${IMG}">`),

	// --- escapes: tokenizer quirks -----------------------------------------------------

	intoDiv("comment-abrupt", `<!-->${IMG}-->`),
	intoDiv("comment-abrupt-dash", `<!--->${IMG}-->`),
	intoDiv("comment-bang-close", `<!-- --!>${IMG}-->`),
	intoDiv("bogus-comment-pi", `<? >${IMG}?>`),
	intoDiv("slash-before-attr", `<img src=x: /onerror=checkglobal(top)>`),
	intoDiv(
		"entity-encoded-handler",
		`<img src=x: onerror="checkglobal&#40;top&#41;">`
	),
	intoDiv(
		"newline-uppercase-handler",
		`<IMG SRC=x:\nONERROR=checkglobal(top)>`
	),
	intoDiv("tab-before-equals", `<img src=x: onerror\t=\tcheckglobal(top)>`),

	// --- escapes: the other sinks --------------------------------------------------------

	markupEscape(
		"insertadjacent-beforebegin-in-svg",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));`,
		(h) => `el.insertAdjacentHTML("beforebegin", ${h});`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"insertadjacent-afterend-in-math",
		`const root = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math"); const el = root.appendChild(document.createElementNS("http://www.w3.org/1998/Math/MathML", "mrow"));`,
		(h) => `el.insertAdjacentHTML("afterend", ${h});`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"insertadjacent-beforebegin-in-foreignobject",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const fo = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")); const el = fo.appendChild(document.createElement("div"));`,
		(h) => `el.insertAdjacentHTML("beforebegin", ${h});`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"insertadjacent-afterend-svg-in-div",
		`const root = document.createElement("div"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));`,
		(h) => `el.insertAdjacentHTML("afterend", ${h});`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"insertadjacent-afterbegin-svg",
		`const root = document.createElement("div"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));`,
		(h) => `el.insertAdjacentHTML("afterbegin", ${h});`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"outerhtml-in-svg",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "rect"));`,
		(h) => `el.outerHTML = ${h};`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"outerhtml-in-foreignobject",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const fo = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")); const el = fo.appendChild(document.createElement("span"));`,
		(h) => `el.outerHTML = ${h};`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"sethtmlunsafe-svg",
		`const root = document.createElement("div"); const el = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));`,
		(h) => `el.setHTMLUnsafe(${h});`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"sethtmlunsafe-declarative-shadow",
		`const root = document.createElement("div"); const el = root;`,
		(h) => `el.setHTMLUnsafe(${h});`
	)(`<div><template shadowrootmode="open">${IMG}</template></div>`),
	markupEscape(
		"shadowroot-innerhtml",
		`const root = document.createElement("div"); const el = root.attachShadow({ mode: "open" });`,
		(h) => `el.innerHTML = ${h};`
	)(IMG),
	markupEscape(
		"shadowroot-sethtmlunsafe-nested-dsd",
		`const root = document.createElement("div"); const el = root.attachShadow({ mode: "open" });`,
		(h) => `el.setHTMLUnsafe(${h});`
	)(
		`<p><template shadowrootmode="open"><svg><style>${IMG}</style></svg></template></p>`
	),
	markupEscape(
		"shadowroot-innerhtml-noscript",
		`const root = document.createElement("div"); const el = root.attachShadow({ mode: "open" });`,
		(h) => `el.innerHTML = ${h};`
	)(`<noscript><p title="</noscript>${IMG}">`),
	markupEscape(
		"template-content-adopted",
		`const root = document.createElement("div"); const el = document.createElement("template");`,
		(h) => `el.innerHTML = ${h}; root.append(el.content.cloneNode(true));`
	)(`<svg><style>${IMG}</style></svg>`),
	markupEscape(
		"template-dsd-content-moved",
		`const root = document.createElement("div"); const el = document.createElement("div");`,
		(h) =>
			`el.innerHTML = ${h}; root.append(document.importNode(el.querySelector("template").content, true));`
	)(`<template shadowrootmode="open">${IMG}</template>`),
	markupEscape(
		"contextual-fragment-div",
		`const root = document.createElement("div"); const range = document.createRange(); range.selectNodeContents(document.body);`,
		(h) => `root.append(range.createContextualFragment(${h}));`
	)(IMG),
	markupEscape(
		"contextual-fragment-svg",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const range = document.createRange(); range.selectNodeContents(root);`,
		// the breakout <img> is an HTML element, which only loads outside the SVG
		(h) => `document.body.append(range.createContextualFragment(${h}));`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"contextual-fragment-foreignobject",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const fo = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")); const range = document.createRange(); range.selectNodeContents(fo);`,
		(h) => `fo.append(range.createContextualFragment(${h}));`
	)(`<![CDATA[>${IMG}]]>`),
	markupEscape(
		"contextual-fragment-text-in-svg",
		`const root = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const t = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "text")); t.textContent = "abc"; const range = document.createRange(); range.setStart(t.firstChild, 1);`,
		(h) => `root.append(range.createContextualFragment(${h}));`
	)(`<style>${IMG}</style>`),
	markupEscape(
		"contextual-fragment-noscript",
		`const root = document.createElement("div"); const range = document.createRange(); range.selectNodeContents(document.body);`,
		(h) => `root.append(range.createContextualFragment(${h}));`
	)(`<noscript><p title="</noscript>${IMG}">`),
	escapeTest(
		"contextual-fragment-script",
		`
			const range = document.createRange();
			range.selectNodeContents(document.body);
			document.body.append(range.createContextualFragment("<script>${PAYLOAD}</scr" + "ipt>"));
		`
	),
	escapeTest(
		"domparser-html-adopt",
		`
			const doc = new DOMParser().parseFromString(${JSON.stringify(IMG)}, "text/html");
			document.body.append(document.adoptNode(doc.body.firstChild));
			${SAFE_COMPLETION}
		`
	),
	escapeTest(
		"domparser-html-noscript-adopt",
		`
			// DOMParser parses with scripting disabled, so noscript content is
			// markup there - and a live element once it is moved
			const doc = new DOMParser().parseFromString('<noscript>${IMG}</noscript>', "text/html");
			document.body.append(document.adoptNode(doc.querySelector("img")));
			${SAFE_COMPLETION}
		`
	),
	// KNOWN: markup.ts does not rewrite XML or SVG documents at all (see the
	// TODO on DOMParser.parseFromString)
	escapeTest(
		"domparser-xhtml-adopt",
		`
			const doc = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="x:" onerror="checkglobal(top)"/></body></html>', "application/xhtml+xml");
			document.body.append(document.adoptNode(doc.querySelector("img")));
			${SAFE_COMPLETION}
		`
	),
	escapeTest(
		"domparser-svg-adopt",
		`
			const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><img xmlns="http://www.w3.org/1999/xhtml" src="x:" onerror="checkglobal(top)"/></foreignObject></svg>', "image/svg+xml");
			document.body.append(document.importNode(doc.documentElement, true));
			${SAFE_COMPLETION}
		`
	),
	escapeTest(
		"domparser-xml-adopt",
		`
			const doc = new DOMParser().parseFromString('<root><img xmlns="http://www.w3.org/1999/xhtml" src="x:" onerror="checkglobal(top)"/></root>', "text/xml");
			document.body.append(document.adoptNode(doc.documentElement.firstChild));
			${SAFE_COMPLETION}
		`
	),
	escapeTest(
		"srcdoc-via-innerhtml",
		`
			const d = document.createElement("div");
			d.innerHTML = '<iframe srcdoc="<script>${IFRAME_PAYLOAD}</scr' + 'ipt>"></iframe>';
			document.body.append(d);
		`
	),
	escapeTest(
		"srcdoc-via-insertadjacent-svg-breakout",
		`
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			document.body.append(svg);
			svg.insertAdjacentHTML("beforeend", '<style><p><iframe srcdoc="<img src=x: onerror=${IFRAME_PAYLOAD}>"></iframe></p></style>');
			// a frame only loads outside the SVG
			document.body.append(svg.querySelector("iframe"));
		`
	),
	escapeTest(
		"documentwrite-iframe-onerror",
		`
			const f = document.createElement("iframe");
			document.body.append(f);
			f.contentDocument.open();
			f.contentDocument.write('<noscript><p title="</noscript><img src=x: onerror=${IFRAME_PAYLOAD}>">');
			f.contentDocument.close();
		`
	),
	escapeTest(
		"iframe-body-innerhtml",
		`
			const f = document.createElement("iframe");
			document.body.append(f);
			f.contentDocument.body.innerHTML = '<svg></p><style><a title="</style><img src=x: onerror=${IFRAME_PAYLOAD}>">';
		`
	),
];
