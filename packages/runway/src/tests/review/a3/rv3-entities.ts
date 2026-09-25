import { htmlTest } from "../../../testcommon.ts";

const cases = [
	`&copy; &copy &notin &noti; &not &ampx &amp &lt &gt; &AMP; &quot`,
	`&#x80; &#150; &#0; &#xD800; &#x110000; &#128512; &#x1F600 &#65x &#; &#x;`,
	`&NotANamedEntity; &Aacute &aacute; &nbsp;&nbsp &ensp;`,
];
const attrs = [
	`/x?a=1&copy=2`,
	`/x?a=1&copy;2`,
	`/x?a&lang=en`,
	`/x?a=1&amp;b=2`,
	`/x?q=&notin`,
	`/x?q=&not;x`,
	`/x#&nbsp`,
	`/x?a=&#x26;b`,
	`/x?&quot`,
];

let body = "";
cases.forEach((t, i) => (body += `<p id="t${i}">${t}</p>\n`));
attrs.forEach(
	(a, i) =>
		(body += `<a id="a${i}" href="${a}" title="${a}" data-v="${a}">x</a>\n`)
);
body += `<img id="img" alt="a&b&c" src="/i.png?x=1&y=2" srcset="/s.png?a=1&amp;b=2 1x, /s2.png?c&d 2x">\n`;
body += `<div id="w1" a='single "q"' b=unq&amp;uoted c = spaced d="x"e="y" f=="z"></div>\n`;
body += `<div id="w2" /x="1" "q"="2" <b="3" data-=4 :c=5 @click="6" #h=7 [x]=8 (y)=9></div>\n`;

const js = `<script>runTest(async () => {
  const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.message; } assertConsistent(label, v); };
  for (let i = 0; i < ${cases.length}; i++) c("text" + i, () => document.getElementById("t" + i).textContent);
  for (let i = 0; i < ${attrs.length}; i++) {
    c("href" + i, () => document.getElementById("a" + i).getAttribute("href"));
    c("title" + i, () => document.getElementById("a" + i).title);
    c("dataset" + i, () => document.getElementById("a" + i).dataset.v);
    c("search" + i, () => document.getElementById("a" + i).search + "|" + document.getElementById("a" + i).hash);
  }
  c("img.alt", () => document.getElementById("img").alt);
  c("img.src", () => document.getElementById("img").getAttribute("src"));
  c("img.srcset", () => document.getElementById("img").getAttribute("srcset"));
  c("w1", () => document.getElementById("w1").getAttributeNames().map(n => n + "=" + document.getElementById("w1").getAttribute(n)).join(" | "));
  c("w2", () => document.getElementById("w2").getAttributeNames().map(n => n + "=" + document.getElementById("w2").getAttribute(n)).join(" | "));
}, true);</script>`;

export default [
	htmlTest({
		name: "rv3-entities",
		html: `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}${js}</body></html>`,
	}),
];
