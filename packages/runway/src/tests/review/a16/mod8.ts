import { site, page } from "./lib.ts";

const files = {
	"/a1.js": "export default 'a1';",
	"/a2.js": "export default 'a2';",
	"/a3.js": "export default 'a3';",
	"/a4.js": "export default 'a4';",
	"/a5.js": "export default 'a5';",
};

const list = [
	// maps inserted through the HTML-rewriting sinks the browser does register
	site("rv16-map-sinks", {
		...files,
		"/": page(
			`
document.head.append(document.createRange().createContextualFragment('<script type="importmap">{"imports":{"ccf":"/a2.js"}}<\\/script>'));
{ const s = document.createElement("script"); s.type = "importmap"; s.innerHTML = '{"imports":{"sih":"/a3.js"}}'; document.head.append(s); }
{ const s = document.createElement("script"); s.type = "importmap"; s.text = '{"imports":{"stext":"/a4.js"}}'; document.head.append(s); }
{ const s = document.createElement("script"); s.setAttribute("type", "importmap"); document.head.append(s); s.append('{"imports":{"sapp":"/a5.js"}}'); }
c("docwrite", await tryImp("dw"));
c("ctxfrag", await tryImp("ccf"));
c("script.innerHTML", await tryImp("sih"));
c("script.text", await tryImp("stext"));
c("append-after", await tryImp("sapp"));
`,
			`<script>document.write('<script type="importmap">{"imports":{"dw":"/a1.js"}}<\\/script>')</script>`
		),
	}),
];

// the Turbo / htmx "activate script" pattern: markup parsed inert, then each script re-created from its text
const activate = site("rv16-map-activate-copy", {
	...files,
	"/": page(`
const tpl = document.createElement("template");
tpl.innerHTML = '<script type="importmap">{"imports":{"act":"/a1.js"}}<\\/script>';
const inert = tpl.content.querySelector("script");
c("readback", inert.textContent.replace(/localhost:[0-9]+/g, "HOST"));
const s = document.createElement("script");
for (const a of inert.attributes) s.setAttribute(a.name, a.value);
s.textContent = inert.textContent;
document.head.append(s);
c("dyn", await tryImp("act"));
const m = document.createElement("script"); m.type = "module"; m.textContent = 'import v from "act"; window.__st = v;';
m.onerror = () => { window.__st = "ERR"; };
window.addEventListener("error", (e) => { window.__st = window.__st || ("ERR " + e.message); }, { once: true });
document.body.append(m);
for (let i = 0; i < 40 && !window.__st; i++) await tick(25);
c("static", String(window.__st).slice(0, 60));
`),
});

export default [...list, activate];
