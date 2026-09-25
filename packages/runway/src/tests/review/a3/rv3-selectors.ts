import { htmlTest } from "../../../testcommon.ts";

// TodoMVC-JavaScript-ES5 / ES6-Webpack: qs(`.filters [href="#/${page}"]`) on a
// parsed <a href="#/active"> (the served HTML has its href rewritten).
export default [
	htmlTest({
		name: "rv3-selectors-href",
		html: `<!doctype html><body><ul class="filters"><li><a href="#/" class="selected">All</a></li><li><a href="#/active">Active</a></li></ul>
<img id="im" src="/img/a.png"><link id="ln" rel="x" href="style.css"><form id="fm" action="/submit"></form><iframe id="if" src="/frame"></iframe>
<style>a[href="#/active"] { color: rgb(1, 2, 3); } img[src$="a.png"] { width: 7px; }</style>
<script>
runTest(async () => {
  const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name; } assertConsistent(label, v === undefined ? "UNDEF" : v); };
  const t = (el) => el ? (el.id || el.textContent) : null;
  c("doc.qs", () => t(document.querySelector('.filters [href="#/active"]')));
  c("el.qs", () => t(document.querySelector(".filters").querySelector('[href="#/active"]')));
  c("qsa", () => document.querySelectorAll('[href^="#/"]').length);
  c("contains", () => document.querySelectorAll('a[href*="act"]').length);
  c("ends", () => t(document.querySelector('img[src$="a.png"]')));
  c("ci", () => t(document.querySelector('a[href="#/ACTIVE" i]')));
  c("is", () => t(document.querySelector(':is(a[href="#/active"])')));
  c("not", () => document.querySelectorAll('a:not([href="#/"])').length);
  c("has", () => t(document.querySelector('li:has(> a[href="#/active"])')));
  c("matches", () => document.querySelectorAll("a")[1].matches('[href="#/active"]'));
  c("closest", () => t(document.querySelectorAll("a")[1].closest('[href="#/active"]')));
  c("frag.qs", () => { const f = document.createRange().createContextualFragment('<a href="#/x">x</a>'); return t(f.querySelector('[href="#/x"]')); });
  c("link", () => t(document.querySelector('link[href="style.css"]')));
  c("form", () => t(document.querySelector('form[action="/submit"]')));
  c("iframe", () => t(document.querySelector('iframe[src="/frame"]')));
  c("getElementsBy", () => document.getElementsByTagName("a")[1].getAttribute("href"));
  c("css-rule-a", () => getComputedStyle(document.querySelectorAll("a")[1]).color);
  c("css-rule-img", () => getComputedStyle(document.getElementById("im")).width);
  c("dynamic-set", () => { const a = document.createElement("a"); a.href = "#/dyn"; document.body.append(a); return !!document.querySelector('a[href="#/dyn"]'); });
  c("setAttribute", () => { const a = document.createElement("a"); a.setAttribute("href", "#/sa"); document.body.append(a); return !!document.querySelector('[href="#/sa"]'); });
  c("css-escape", () => !!document.querySelector('a[href="\\\\23/active"]'));
  c("attr-no-quote", () => !!document.querySelector('a[href=\\\\#\\\\/active]'));
}, true);
</script></body>`,
	}),
];
