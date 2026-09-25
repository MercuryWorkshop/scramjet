import { site, page } from "./lib.ts";

const body = `
window.__r = {};
const C = (k) => "import d from './sub/dep.js'; window.__r[" + JSON.stringify(k) + "] = [d, import.meta.url.replace(/localhost:[0-9]+/, 'HOST').replace(/#.*/, ''), typeof import.meta.resolve]; import('./sub/dep.js').then(m => { window.__r[" + JSON.stringify(k + '.dyn') + "] = m.default; });";
// 1: text before connect
{ const s = document.createElement("script"); s.type = "module"; s.textContent = C("text-before"); document.body.append(s); }
// 2: text after connect
{ const s = document.createElement("script"); s.type = "module"; document.body.append(s); s.textContent = C("text-after"); }
// 3: append(Text) after connect
{ const s = document.createElement("script"); s.type = "module"; document.body.append(s); s.append(document.createTextNode(C("append-text"))); }
// 4: type set after text, before connect
{ const s = document.createElement("script"); s.text = C("type-after-text"); s.type = "module"; document.body.append(s); }
// 5: setAttribute type after text
{ const s = document.createElement("script"); s.textContent = C("setattr-type"); s.setAttribute("type", "module"); document.body.append(s); }
// 6: createContextualFragment
{ const f = document.createRange().createContextualFragment('<script type="module">' + C("ctxfrag") + '<\\/script>'); document.body.append(f); }
// 7: innerHTML then cloneNode (clones of parser-inserted are already started; should not run)
{ const d = document.createElement("div"); d.innerHTML = '<script type="module">' + C("innerhtml-clone") + '<\\/script>'; document.body.append(d.firstChild.cloneNode(true)); }
// 8: two text nodes
{ const s = document.createElement("script"); s.type = "module"; s.append("window.__two = 1;", document.createTextNode(C("two-nodes"))); document.body.append(s); }
// 9: script.innerHTML assignment
{ const s = document.createElement("script"); s.type = "module"; s.innerHTML = C("script-innerhtml"); document.body.append(s); }
// 10: DOMParser + importNode (importNode clone is not already-started)
{ const doc = new DOMParser().parseFromString('<script type="module">' + C("domparser-import") + '<\\/script>', "text/html"); document.body.append(document.importNode(doc.querySelector("script"), true)); }
// 11: DOMParser adopt directly (parser-inserted flag: should not run)
{ const doc = new DOMParser().parseFromString('<script type="module">' + C("domparser-adopt") + '<\\/script>', "text/html"); document.body.append(doc.querySelector("script")); }
// 12: text node data changed after connect
{ const s = document.createElement("script"); s.type = "module"; const t = document.createTextNode(""); s.append(t); document.body.append(s); t.data = C("data-change"); }
await tick(800);
for (const k of Object.keys(window.__r).sort()) c(k, JSON.stringify(window.__r[k]));
c("keys", Object.keys(window.__r).sort().join());
`;

export default [
	site("rv16-inline-module-insertion", {
		"/sub/dep.js": "export default 'dep@sub';",
		"/": page(body, "", false),
	}),
];
