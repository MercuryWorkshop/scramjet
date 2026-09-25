import { basicTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + e.message; } assertConsistent(label, v); };`;

export default [
	basicTest({
		name: "rv3-base-sinks",
		js: `${C}
const html = '<base href="/"><a id=bl href="page">p</a>';
c("innerHTML", () => { const d = document.createElement("div"); d.innerHTML = html; return d.querySelector("a").getAttribute("href"); });
c("insertAdjacentHTML", () => { const d = document.createElement("div"); d.insertAdjacentHTML("beforeend", html); return d.children.length; });
c("outerHTML", () => { const w = document.createElement("div"); const d = document.createElement("div"); w.append(d); d.outerHTML = html; return w.children.length; });
c("DOMParser", () => new DOMParser().parseFromString('<!doctype html><html><head><base href="/"></head><body><a href="x">x</a></body></html>', "text/html").querySelector("a").getAttribute("href"));
c("createContextualFragment", () => document.createRange().createContextualFragment(html).childNodes.length);
c("template", () => { const t = document.createElement("template"); t.innerHTML = html; return t.content.childNodes.length; });
c("setHTMLUnsafe", () => { const d = document.createElement("div"); d.setHTMLUnsafe(html); return d.children.length; });
c("parseHTMLUnsafe", () => Document.parseHTMLUnsafe(html).querySelector("a").getAttribute("href"));
c("docwrite", () => { const doc = document.implementation.createHTMLDocument(""); doc.open(); doc.write(html); doc.close(); return doc.querySelector("a") && doc.querySelector("a").getAttribute("href"); });
c("badbase", () => { const d = document.createElement("div"); d.innerHTML = '<base href="http://[bad"><img src="/x.png">'; return d.children.length; });
`,
	}),
];
