import { basicTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + e.message; } assertConsistent(label, v); };
const shape = (n) => { if (n.nodeType === 3) return "#" + n.data; if (n.nodeType === 8) return "<!" + n.data + ">"; if (n.nodeType !== 1) return "?" + n.nodeType; return "<" + n.localName + [...n.attributes].map(a => " " + a.name + "=" + a.value).join("") + ">" + [...n.childNodes].map(shape).join("") + "</>"; };`;

export default [
	basicTest({
		name: "rv3-fw-templates",
		js: `${C}
// lit-html style template: markers in comments, attribute names and PIs
const litHtml = '<div class$lit$="x" ?disabled$lit$="" @click$lit$="" .prop$lit$=""><!--?lit$1234$--><?lit$5678$>text</div><img src$lit$="">';
c("lit", () => { const t = document.createElement("template"); t.innerHTML = litHtml; return [...t.content.childNodes].map(shape).join(""); });
c("lit.inner", () => { const t = document.createElement("template"); t.innerHTML = litHtml; return t.innerHTML; });
// knockout containerless bindings
c("ko", () => { const d = document.createElement("div"); d.innerHTML = '<!-- ko if: x --><span data-bind="text: y"></span><!-- /ko -->'; return [...d.childNodes].map(shape).join(""); });
// client templates in script tags
c("tmpl-script", () => { const d = document.createElement("div"); d.innerHTML = '<script type="text/x-template" id="t"><div :class="a" @click="b"><img :src="c"></div></script><script type="text/html">{{#each}}<a href="{{u}}">{{/each}}</script>'; return d.querySelector("script").textContent + "|" + d.innerHTML; });
// jQuery.parseHTML
c("jq-parse", () => {
  const doc = document.implementation.createHTMLDocument("");
  const base = doc.createElement("base"); base.href = document.location.href; doc.head.appendChild(base);
  const div = doc.createElement("div"); div.innerHTML = '<a href="/x?y=1">x</a><img src="rel.png">';
  const a = div.firstChild, img = div.lastChild;
  return [a.href.replace(location.origin, "O"), a.getAttribute("href"), img.getAttribute("src"), base.getAttribute("href").replace(location.origin, "O")].join(" | ");
});
// Angular / Vue attribute syntaxes
c("ng", () => { const d = document.createElement("div"); d.innerHTML = '<a [href]="u" (click)="f()" *ngIf="x" #ref v-bind:href="h" :href="h2" href="/real">x</a>'; return shape(d.firstChild); });
// style with custom properties and urls
c("style-attr", () => { const d = document.createElement("div"); d.innerHTML = '<div style="--bg:url(/a.png);background:var(--bg) center/cover"></div>'; return d.firstChild.getAttribute("style") + " | " + d.firstChild.style.getPropertyValue("--bg"); });
// big innerHTML round trip size consistency
c("big", () => { const d = document.createElement("div"); let h = ""; for (let i = 0; i < 2000; i++) h += '<li class="i' + i + '"><a href="/p/' + i + '?a=1&amp;b=2">item &amp; ' + i + '</a></li>'; d.innerHTML = "<ul>" + h + "</ul>"; return d.innerHTML.length + ":" + d.querySelectorAll("a").length; });
// insertAdjacentHTML sequences
c("iah", () => { const d = document.createElement("div"); d.innerHTML = "<p>x</p>"; const p = d.firstChild; p.insertAdjacentHTML("beforebegin", "<i>1</i>"); p.insertAdjacentHTML("afterbegin", "<b>2</b>"); p.insertAdjacentHTML("beforeend", "<u>3</u>"); p.insertAdjacentHTML("afterend", "<s>4</s>"); return d.innerHTML; });
// outerHTML getter on elements with mirrors
c("outer-mirror", () => { const d = document.createElement("div"); d.innerHTML = '<iframe src="/f" sandbox="allow-scripts" srcdoc="<p>x</p>"></iframe><script src="/s.js" integrity="sha256-x" nonce="n"></script>'; return d.innerHTML; });
`,
	}),
];
