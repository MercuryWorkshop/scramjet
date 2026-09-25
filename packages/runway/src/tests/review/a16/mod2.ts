import { site, page } from "./lib.ts";

const counter = (name: string) =>
	`window.__c = window.__c || {}; window.__c[${JSON.stringify(name)}] = (window.__c[${JSON.stringify(name)}] || 0) + 1; export const who = ${JSON.stringify(name)}; export const url = import.meta.url.replace(/localhost:\\d+/, "HOST");`;

const waitFor = `const waitFor = async (f, n = 60) => { for (let i = 0; i < n; i++) { if (f()) return true; await tick(50); } return false; };`;

export default [
	// module instance identity in the top frame, across every way of loading it
	site("rv16-dedupe-top", {
		"/c.js": counter("c"),
		"/d.js": counter("d"),
		"/e.js": counter("e"),
		"/f.js": counter("f"),
		"/imp-c.js":
			"import { who } from './c.js'; export { who }; import './f.js';",
		"/": page(
			`${waitFor}
await waitFor(() => window.__c && window.__c.c);
const m1 = await import("/c.js");
const m2 = await import("./c.js");
const m3 = await import(location.origin + "/c.js");
const m4 = await import("/imp-c.js");
c("same.12", m1 === m2); c("same.13", m1 === m3);
const pre = await import("/d.js");
const s = document.createElement("script"); s.type = "module"; s.src = "/e.js"; document.head.append(s);
await waitFor(() => window.__c.e);
const e = await import("/e.js");
const f = await import("./f.js");
await tick(200);
c("counts", JSON.stringify(window.__c));
c("url", m1.url);
`,
			`<script type="module" src="/c.js"></script><link rel="modulepreload" href="/d.js"><link rel="modulepreload" href="/f.js">`
		),
	}),
	// src set before the type flips to module
	site("rv16-script-src-before-type", {
		"/c.js": counter("c"),
		"/g.js":
			"import { who as cw } from './c.js'; window.__g = cw; " + counter("g"),
		"/": page(`${waitFor}
const s = document.createElement("script"); s.src = "/g.js"; s.type = "module"; document.head.append(s);
await waitFor(() => window.__g);
c("g", window.__g || "not-run");
const s2 = document.createElement("script"); s2.src = "/c.js"; s2.setAttribute("type", "module"); document.head.append(s2);
await waitFor(() => window.__c && window.__c.c >= 1);
await import("/c.js");
await tick(200);
c("counts", JSON.stringify(window.__c || {}));
`),
	}),
	// which base import() resolves against, called from different kinds of code
	site("rv16-import-referrer", {
		"/m.js": "export default 'root';",
		"/sub/dir/m.js": "export default 'sub';",
		"/sub/dir/classic.js": `
window.__r = {};
const g = (k, p) => p.then(m => { window.__r[k] = m.default; }, e => { window.__r[k] = "ERR " + e.name; });
g("classic", import("./m.js"));
g("eval", eval('import("./m.js")'));
g("indirect-eval", (0, eval)('import("./m.js")'));
g("fn", new Function('return import("./m.js")')());
setTimeout('window.__r.pending = 1; import("./m.js").then(m => { window.__r["timeout-string"] = m.default; })', 0);
window.__later = () => import("./m.js");
`,
		"/sub/dir/mod.js": `
const g = (k, p) => p.then(m => { window.__r[k] = m.default; }, e => { window.__r[k] = "ERR " + e.name; });
g("module", import("./m.js"));
g("module-eval", eval('import("./m.js")'));
g("module-fn", new Function('return import("./m.js")')());
`,
		"/": page(
			`${waitFor}
await waitFor(() => window.__r && window.__r.classic);
await import("/sub/dir/mod.js");
const b = document.getElementById("b"); b.click();
g2("later", window.__later());
await tick(500);
const keys = Object.keys(window.__r).sort();
for (const k of keys) c(k, window.__r[k]);
function g2(k, p) { p.then(m => { window.__r[k] = m.default; }, e => { window.__r[k] = "ERR " + e.name; }); }
`,
			`<script src="/sub/dir/classic.js"></script>`
		).replace(
			"<body>",
			`<body><button id="b" onclick="import('./m.js').then(m => { window.__r.handler = m.default; })">x</button>`
		),
	}),
	// import.meta in various module flavours
	site("rv16-import-meta", {
		"/q.js":
			"export const u = import.meta.url; export const r = import.meta.resolve('./x.js'); export const r2 = import.meta.resolve('https://a.test/z'); export const keys = Object.keys(import.meta).join();",
		"/": page(`
const norm = (s) => String(s).replace(/localhost:\\d+/g, "HOST");
c("inline.url", norm(import.meta.url));
c("inline.resolve", norm(import.meta.resolve("./a/b.js")));
c("inline.keys", Object.keys(import.meta).join());
const q = await import("/q.js?x=1#frag");
c("q.url", norm(q.u)); c("q.r", norm(q.r)); c("q.r2", norm(q.r2)); c("q.keys", q.keys);
const dm = await import("data:text/javascript,export const u = import.meta.url; export default 1;");
c("data.url", dm.u);
const blob = URL.createObjectURL(new Blob(["export const u = import.meta.url; export default 2;"], { type: "text/javascript" }));
const bm = await import(blob);
c("blob.url.eq", bm.u === blob);
const bm2 = await import(blob);
c("blob.same", bm === bm2);
c("meta.desc", JSON.stringify(Object.getOwnPropertyDescriptor(import.meta, "url")).replace(/localhost:\\d+/g, "HOST"));
c("meta.proto", Object.getPrototypeOf(import.meta));
`),
	}),
	// dynamic import errors
	site("rv16-import-errors", {
		"/syn.js": "export const x = ;",
		"/throws.js": "throw new RangeError('boom');",
		"/missing-export.js": "import { nope } from './m.js';",
		"/m.js": "export default 1;",
		"/html.js": {
			type: "text/html",
			body: "<p>hi</p>",
		},
		"/": page(`
const e = async (label, f) => { let p; try { p = f(); } catch (err) { c(label + ".sync", "SYNC THROW " + err.name); return; } try { await p; c(label, "ok"); } catch (err) { c(label + ".name", err && err.name); c(label + ".proto", Object.getPrototypeOf(err) === (err && globalThis[err.name] && globalThis[err.name].prototype)); c(label + ".msg", String(err && err.message).replace(/localhost:\\d+/g, "HOST")); } };
await e("404", () => import("./404.js"));
await e("syntax", () => import("./syn.js"));
await e("throws", () => import("./throws.js"));
await e("missing-export", () => import("./missing-export.js"));
await e("mime", () => import("./html.js"));
await e("bare", () => import("nope"));
await e("bad-url", () => import("http://[bad/x.js"));
await e("undef", () => import(undefined));
await e("sym", () => import(Symbol("x")));
await e("url-obj", () => import(new URL("./m.js", location.href)));
await e("obj", () => import({ toString() { return "./m.js"; } }));
`),
	}),
	// top level await, cycles, re-exports
	site("rv16-module-graph", {
		"/tla.js":
			"await new Promise(r => setTimeout(r, 20)); export const v = 'tla';",
		"/cyc-a.js":
			"import { b } from './cyc-b.js'; export const a = 'a'; export const fromB = () => b;",
		"/cyc-b.js":
			"import { a } from './cyc-a.js'; export const b = 'b'; export const fromA = () => a;",
		"/re.js":
			"export * from './cyc-a.js'; export { v as tlaV } from './tla.js'; export * as ns from './cyc-b.js'; export { default } from './def.js';",
		"/def.js": "export default 'def';",
		"/": page(`
const r = await import("/re.js");
c("re", JSON.stringify([r.a, r.fromB(), r.tlaV, r.ns.b, r.ns.fromA(), r.default]));
c("ns.tag", Object.prototype.toString.call(r));
c("keys", Object.keys(r).join());
`),
	}),
	// nomodule, innerHTML, document.write module scripts
	site("rv16-module-insertion", {
		"/w.js": counter("w"),
		"/x.js": counter("x"),
		"/y.js": counter("y"),
		"/": page(
			`${waitFor}
const d = document.createElement("div");
d.innerHTML = '<script type="module" src="/x.js"><\\/script><script type="module">window.__ih = 1<\\/script>';
document.body.append(d);
const d2 = document.createElement("div");
d2.append(document.createRange().createContextualFragment('<script type="module" src="/y.js"><\\/script>'));
document.body.append(d2);
await tick(400);
c("counts", JSON.stringify(window.__c || {}));
c("ih", window.__ih || 0);
c("nomodule", window.__nm || 0);
c("dw", window.__dw || 0);
`,
			`<script nomodule>window.__nm = 1</script><script>document.write('<script type="module" src="/w.js"><\\/script><script type="module">window.__dw = 1<\\/script>')</script>`
		),
	}),
];
