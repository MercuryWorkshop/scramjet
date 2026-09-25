import { basicTest } from "../../../testcommon.ts";

const cases = [
	"<a href='?a=1&copy=2&amp;b=3&lt'>x</a>",
	'<a href="?x=&notit;&notin;&not">x</a>',
	"<p>&copy &copy; &#x41; &#65; &#0; &#xD800; &nbsp&amp</p>",
	"<table><tr><td>a</td></tr><div>foster</div></table>",
	"<p><div>x</div></p>",
	"<b><i>1</b>2</i>",
	"<a href=/1><div><a href=/2>x</a></div></a>",
	"<select><option>1<option>2</select>",
	"<ul><li>1<li>2</ul>",
	"<svg viewBox='0 0 1 1' preserveAspectRatio='none'><foreignObject><div>x</div></foreignObject><clipPath id=c></clipPath><feGaussianBlur stdDeviation=1 /></svg>",
	"<math><mi>x</mi><annotation-xml encoding='text/html'><div>h</div></annotation-xml></math>",
	"<svg><![CDATA[ a < b ]]></svg>",
	"<!--> x <!-- a -- b --> <!---->",
	"</br><br/>",
	"<image src='/i.png'>",
	"<DIV CLASS=A ID=B>x</DIV>",
	"<div a=1 a=2 b c=\"\" d=''>x</div>",
	"<div title=a\u0000b>\u0000</div>",
	"<pre>\nleading newline</pre><textarea>\nx</textarea><listing>\nl</listing>",
	"<plaintext><b>raw",
	"<noscript><p>ns</p></noscript>",
	"<template><tr><td>t</td></tr></template>",
	"<table><template><tr></tr></template></table>",
	"<frameset><frame src='/f'></frameset>",
	'<input type=checkbox checked disabled value="a&quot;b">',
	"<a href='  /spaced  '>s</a>",
	"<a HREF=/upper>u</a>",
	"<img src=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>\">",
	'<div style="background:url(&quot;/q.png&quot;)">q</div>',
	"<a href=\"javascript:alert('&lt;x&gt;')\">j</a>",
	"<script>if (a<b && c>d) { x = '</div>' }</script>",
	"<style>a > b { content: '</p>' }</style>",
	"<p>a</p>\n\n<p>b</p>   ",
	"<button><button>x</button></button>",
	"<form><form><input></form></form>",
	"<h1><h2>x</h2></h1>",
	"<a><table><a>x</a></table></a>",
	"<ruby>a<rt>b</rt><rp>(</rp></ruby>",
	"<dl><dt>a<dd>b</dl>",
	"<object><param name=a value=b><embed src=/e></object>",
	"<iframe src='/f'>fallback <b>x</b></iframe>",
	"<xmp><b>x</b></xmp><noembed><b>n</b></noembed>",
	"<div><!-- c --><?pi x?></div>",
	"<svg><title><b>t</b></title><desc>d</desc><a href='/sa' xlink:title='t'>a</a></svg>",
	"<svg><style>.a{fill:url(#g)}</style><script>var a = 1 < 2;</script></svg>",
	'<p id="a" id="b">dup</p>',
	"<a href='x' target=_top>t</a><a target=_parent>p</a><base target=_top>",
	"<meta charset=utf-8><link rel=preload as=image href=/p.png imagesrcset='/a.png 1x' imagesizes=100vw>",
	"<details open><summary>s</summary>d</details>",
	"<video controls autoplay muted playsinline src=/v.mp4><track src=/t.vtt kind=subtitles default></video>",
	"<picture><source srcset='/a.webp' type=image/webp><img src='/a.jpg' loading=lazy decoding=async></picture>",
	"<a href='https://example.com/path?query=1#frag' rel='noopener noreferrer' download=file.txt ping='/ping'>d</a>",
	"<custom-element some-attr='/x' src='/y' href='/z' onclick='f()'><slot name=s></slot></custom-element>",
	"<div onclick=\"alert(&quot;x&quot;)\" onmouseover='return false;' onfoo='bar'>h</div>",
	"<body onload='init()'><p>b</p></body>",
];

export default [
	basicTest({
		name: "rv2-parsing-roundtrip",
		js: `
			const cases = ${JSON.stringify(cases)};
			const sig = (n) => {
				if (n.nodeType === 3) return "#t(" + n.data + ")";
				if (n.nodeType === 8) return "#c(" + n.data + ")";
				if (n.nodeType === 4) return "#cd(" + n.data + ")";
				if (n.nodeType === 7) return "#pi(" + n.target + ")";
				if (n.nodeType !== 1) return "#" + n.nodeType;
				const attrs = n.getAttributeNames().map(a => a + "=" + n.getAttribute(a)).join(",");
				const kids = Array.from(n.childNodes).map(sig).join("");
				const tpl = n.localName === "template" ? "{" + Array.from(n.content.childNodes).map(sig).join("") + "}" : "";
				return "<" + (n.namespaceURI || "").slice(-6) + ":" + n.localName + "[" + attrs + "]" + tpl + kids + ">";
			};
			cases.forEach((h, i) => {
				const d = document.createElement("div");
				d.innerHTML = h;
				assertConsistent(i + " tree", sig(d));
				assertConsistent(i + " html", d.innerHTML);
				const b = document.createElement("div");
				b.insertAdjacentHTML("afterbegin", h);
				assertConsistent(i + " iah", sig(b));
				const doc = new DOMParser().parseFromString(h, "text/html");
				assertConsistent(i + " dp", sig(doc.documentElement));
			});
		`,
	}),
];
