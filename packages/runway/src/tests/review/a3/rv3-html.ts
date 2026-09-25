import { htmlTest, basicTest } from "../../../testcommon.ts";

// Parsed-page fidelity: the served HTML goes through the SW rewriter; the DOM
// (read back through scramjet's hooks) must match bare Chrome.
const tricky = String.raw`<!DOCTYPE html>
<html><head><title>T &amp; &lt;t&gt;</title>
<meta charset="utf-8">
<noscript><link rel="stylesheet" href="/ns.css"></noscript>
</head><body>
<div id="ents" title="a&amp;b &copy &notit; &#65;&#x42; &nbsp;x" data-q='"q"'>&copy; &notin &noti; &lt;b&gt; &#128512; &ampx</div>
<a id="amp" href="/x?a=1&amp;b=2&copy=3&lang=en">x</a>
<a id="frag" href="#top">f</a><a id="hash" href="#">h</a><a id="empty" href="">e</a>
<textarea id="ta"><b>&amp;</b></textarea>
<noscript id="ns"><img src="/n.png"> &amp; </noscript>
<template id="tpl"><tr><td>x</td></tr><img src="/t.png"><script>1</script></template>
<svg id="svg" viewBox="0 0 10 10"><foreignObject><div>fo</div></foreignObject><linearGradient gradientUnits="userSpaceOnUse"></linearGradient><![CDATA[ <cd> ]]><a xlink:href="/xl" href="/l">l</a></svg>
<math id="math"><mi>x</mi></math>
<div id="attrs" a b=c A=1 a=2 data-x=\`y\` CLASS=foo onclick="window.__c=1">x</div>
<!--[if IE]><p>ie</p><![endif]--><div id="afterc">ac</div>
<table id="tbl"><tr><td>a</td></tr>stray</table>
<p id="pp">1<p>2
<select id="sel"><option>a<option>b</select>
<img id="srcset" srcset="/a.png 1x, /b.png 2x" src="/c.png">
<script id="s1">var __s = "</scr" + "ipt>"; window.__inline = 1; /* <!-- x --> */</script>
<style id="st">a > b { content: "</p>&amp;"; }</style>
<div id="end"></div>
<script>
runTest(async () => {
  const q = (s) => document.querySelector(s);
  const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + e.message; } assertConsistent(label, v); };
  c("compatMode", () => document.compatMode);
  c("title", () => document.title);
  c("ents.title", () => q("#ents").getAttribute("title"));
  c("ents.dataq", () => q("#ents").dataset.q);
  c("ents.text", () => q("#ents").textContent);
  c("ents.outer", () => q("#ents").outerHTML);
  c("amp.href.attr", () => q("#amp").getAttribute("href"));
  c("amp.href", () => q("#amp").href.replace(location.origin, "ORIGIN"));
  c("amp.search", () => q("#amp").search);
  c("frag", () => q("#frag").getAttribute("href") + " " + q("#frag").hash);
  c("hash", () => q("#hash").getAttribute("href") + " " + q("#hash").href.replace(location.origin, "ORIGIN"));
  c("empty", () => q("#empty").getAttribute("href") + " " + q("#empty").href.replace(location.origin, "ORIGIN"));
  c("ta", () => q("#ta").value + "|" + q("#ta").innerHTML);
  c("ns.inner", () => q("#ns").innerHTML);
  c("ns.text", () => q("#ns").textContent);
  c("ns.children", () => q("#ns").children.length);
  c("headns", () => document.head.querySelector("noscript").innerHTML);
  c("tpl.inner", () => q("#tpl").innerHTML);
  c("tpl.content", () => q("#tpl").content.childNodes.length);
  c("svg.inner", () => q("#svg").innerHTML);
  c("svg.viewBox", () => q("#svg").getAttribute("viewBox") + " " + q("#svg").viewBox.baseVal.width);
  c("svg.fo", () => q("#svg").querySelector("foreignObject") ? q("#svg").querySelector("foreignObject").namespaceURI : null);
  c("math", () => q("#math").outerHTML);
  c("attrs.outer", () => q("#attrs").outerHTML);
  c("attrs.names", () => q("#attrs").getAttributeNames().join(","));
  c("afterc", () => q("#afterc").previousSibling.nodeType + " " + q("#afterc").previousSibling.data);
  c("tbl", () => q("#tbl").outerHTML + "|" + q("#tbl").previousSibling.textContent);
  c("pp", () => q("#pp").outerHTML + q("#pp").nextElementSibling.outerHTML);
  c("sel", () => q("#sel").innerHTML);
  c("srcset", () => q("#srcset").getAttribute("srcset") + "|" + q("#srcset").outerHTML);
  c("s1.text", () => q("#s1").textContent);
  c("s1.inner", () => q("#s1").innerHTML);
  c("s1.run", () => window.__inline);
  c("st.text", () => q("#st").textContent);
  c("click", () => { q("#attrs").click(); return window.__c; });
  c("bodyChildCount", () => document.body.children.length);
  c("headChildren", () => Array.from(document.head.children).map(e => e.tagName).join(","));
}, true);
</script>
</body></html>`;

export default [
	htmlTest({
		name: "rv3-html-fidelity",
		html: tricky,
	}),
	htmlTest({
		name: "rv3-html-quirks",
		html: `<html><head><title>q</title></head><body><script>runTest(async () => { assertConsistent("compat", document.compatMode); assertConsistent("dt", String(document.doctype)); }, true);</script></body></html>`,
	}),
	htmlTest({
		name: "rv3-html-limited-quirks",
		html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html><body><script>runTest(async () => { assertConsistent("compat", document.compatMode); assertConsistent("dt", document.doctype && document.doctype.publicId + "|" + document.doctype.systemId); }, true);</script></body></html>`,
	}),
	htmlTest({
		name: "rv3-html-quirks-dt401",
		html: `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"><html><body><script>runTest(async () => { assertConsistent("compat", document.compatMode); assertConsistent("dt", document.doctype && document.doctype.name + "|" + document.doctype.publicId + "|" + document.doctype.systemId); }, true);</script></body></html>`,
	}),
	htmlTest({
		name: "rv3-html-leading-comment",
		html: `<!-- hi --><!DOCTYPE html><html><body><script>runTest(async () => { assertConsistent("compat", document.compatMode); assertConsistent("first", document.firstChild.nodeType); }, true);</script></body></html>`,
	}),
];
