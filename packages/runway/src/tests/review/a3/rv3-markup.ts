import { basicTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + e.message; } assertConsistent(label, v); };`;

export default [
	basicTest({
		name: "rv3-markup-roundtrip",
		js: `${C}
const rt = (html, tag = "div") => { const d = document.createElement(tag); d.innerHTML = html; return d.innerHTML; };
c("amp-attr", () => rt('<a href="/x?a=1&amp;b=2" title="&quot;q&quot; &lt;">x</a>'));
c("nbsp", () => rt('a&nbsp;b <span title="c&nbsp;d">e</span>'));
c("entities-noSemi", () => rt('<a href="/x?a=1&copy=2&not=3">&copy &not</a>'));
c("valueless", () => rt('<input disabled><div hidden a="">x</div>'));
c("svg-empty", () => rt('<svg><path d="M0"/><circle r="1"></circle><g></g></svg>'));
c("svg-case", () => rt('<svg viewBox="0 0 1 1"><linearGradient gradientUnits="userSpaceOnUse"/><foreignObject><div>x</div></foreignObject></svg>'));
c("math", () => rt('<math><mi>x</mi><annotation-xml encoding="text/html"><div>y</div></annotation-xml></math>'));
c("template", () => rt('<template><tr><td>x</td></tr></template>'));
c("textarea", () => rt('<textarea>&lt;b&gt; &amp;</textarea>'));
c("style-text", () => rt('<style>a{background:url(/x.png)} b>c{}</style>'));
c("script-text", () => rt('<script>if (a<b && c>d) {}</script>'));
c("noscript", () => rt('<noscript><img src="/x.png"></noscript>'));
c("comment", () => rt('<!-- a --><!--[if IE]>x<![endif]-->'));
c("pre-newline", () => rt('<pre>\\n\\nx</pre><textarea>\\nfoo</textarea>'));
c("table-in-div", () => rt('<table><tr><td>1</td></tr></table>'));
c("tr-in-tbody", () => rt('<tr><td>1</td></tr>', "tbody"));
c("td-in-tr", () => rt('<td>1</td>', "tr"));
c("option-in-select", () => rt('<option>a</option><optgroup label=x><option>b</option></optgroup>', "select"));
c("svg-inner-set", () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.innerHTML = '<linearGradient gradientUnits="userSpaceOnUse"/><path d="M0"/>'; return s.innerHTML + "|" + s.firstChild.localName + "|" + s.firstChild.getAttribute("gradientUnits"); });
c("attr-case-html", () => rt('<div DATA-X="1" onClick="1">x</div>'));
c("dup-attrs", () => rt('<div a=1 a=2 A=3>x</div>'));
c("weird-attr-names", () => rt('<div "a"=1 b\\'=2 <c=3>x</div>'));
c("unclosed", () => rt('<p>a<p>b<div>c'));
c("image-tag", () => rt('<image src="/i.png">'));
c("plaintext", () => rt('<plaintext><b>x</b>'));
c("xmp", () => rt('<xmp><b>&amp;</b></xmp>'));
c("iframe-content", () => rt('<iframe><b>x</b></iframe>'));
c("srcset", () => rt('<img srcset="/a.png 1x, /b.png 2x">'));
c("meta-refresh", () => rt('<meta http-equiv="refresh" content="5;url=/x">'));
c("base-target", () => rt('<a target="_top" href="/x">x</a><a target="_parent">y</a><a target="_blank">z</a>'));
c("form", () => rt('<form action="/f"><button formaction="/b">b</button></form>'));
c("outer-svg-child", () => { const d = document.createElement("div"); d.innerHTML = '<svg><path d="M0"/></svg>'; return d.firstChild.firstChild.outerHTML; });
c("insertAdjacent-tr", () => { const t = document.createElement("table"); t.innerHTML = "<tbody><tr><td>1</td></tr></tbody>"; t.querySelector("tr").insertAdjacentHTML("afterend", "<tr><td>2</td></tr>"); return t.innerHTML; });
c("xml-doc-inner-get", () => { const d = new DOMParser().parseFromString("<root><Child a='1'/><x>t</x></root>", "application/xml"); return d.documentElement.innerHTML; });
c("xml-doc-inner-set", () => { const d = new DOMParser().parseFromString("<root/>", "application/xml"); d.documentElement.innerHTML = "<Item><br/></Item>"; return new XMLSerializer().serializeToString(d); });
c("xhtml-createdoc-inner", () => { const d = document.implementation.createDocument("http://www.w3.org/1999/xhtml", "html", null); const b = d.createElementNS("http://www.w3.org/1999/xhtml", "body"); d.documentElement.append(b); b.innerHTML = "<p>a<br/>b</p>"; return b.innerHTML; });
`,
	}),
];
