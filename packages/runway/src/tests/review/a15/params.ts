import { serverTest, type Test } from "../../../testcommon.ts";

/* eslint-disable quotes */

type Route = [string, string] | [string, string, Record<string, string>];

/**
 * A server test whose pages report through `report(ok, msg)`, which hits
 * `/__r` and resolves the test from the server side, so it works from any
 * document (popups, navigated pages, frames). Every request path is counted
 * and the counts come back in the message.
 */
const REPORT = `<script>window.report = (ok, msg) => fetch("/__r?ok=" + (ok ? 1 : 0) + "&msg=" + encodeURIComponent(msg));</script>`;

function t(
	name: string,
	js: string,
	routes: Record<string, Route>,
	opts: {
		timeoutMs?: number;
	} = {}
): Test {
	const hits: Record<string, number> = {};
	return Object.assign(
		serverTest({
			name,
			js,
			start: async (server, _port, ctx) => {
				server.on("request", (req, res) => {
					const path = (req.url || "/").split("?")[0];
					if (path === "/") for (const k of Object.keys(hits)) delete hits[k];
					hits[path] = (hits[path] || 0) + 1;
					if (res.headersSent) return;
					if (path === "/" || path === "/script.js") return;
					if (path === "/__r") {
						const u = new URL(req.url!, "http://x");
						const msg =
							u.searchParams.get("msg") + " hits=" + JSON.stringify(hits);
						res.writeHead(204);
						res.end();
						if (u.searchParams.get("ok") === "1") ctx.pass(msg);
						else ctx.fail(msg);
						return;
					}
					if (path === "/__hits") {
						res.writeHead(200, {
							"Content-Type": "application/json",
						});
						res.end(JSON.stringify(hits));
						return;
					}
					const f = routes[path];
					if (!f) {
						res.writeHead(404);
						res.end("nf");
						return;
					}
					res.writeHead(200, {
						"Content-Type": f[0],
						...(f[2] || {}),
					});
					let body = f[1];
					if (f[0] === "text/html") body = REPORT + body;
					res.end(body);
				});
			},
		}),
		{
			timeoutMs: opts.timeoutMs ?? 20000,
		}
	);
}

const JS = "application/javascript";
const HTML = "text/html";
const CSS = "text/css";

export default [
	// A SharedWorker is shared by every same-origin document that names the
	// same script URL. develop stamps `$top=<page url>` on the worker URL, so
	// two pages of one site with different URLs get different workers.
	t(
		"rv15-shw-popup",
		`
		location.href = "/a";
		await new Promise(() => {});
		`,
		{
			"/shw.js": [
				JS,
				`let n = 0; onconnect = (e) => { e.ports[0].postMessage(++n); };`,
			],
			"/a": [
				HTML,
				`<script>
				const w = new SharedWorker("/shw.js");
				w.port.onmessage = (e) => {
					const first = e.data;
					addEventListener("message", (m) => {
						if (m.data && m.data.second !== undefined)
							report(m.data.second === 2, "first=" + first + " second=" + m.data.second);
					});
					window.open("/b");
				};
				</script>`,
			],
			"/b": [
				HTML,
				`<script>
				const w = new SharedWorker("/shw.js");
				w.port.onmessage = (e) => { opener.postMessage({ second: e.data }, "*"); };
				</script>`,
			],
		}
	),
	// the same page in two windows, differing only in the fragment
	t(
		"rv15-shw-fragment-popup",
		`
		location.href = "/app#inbox";
		await new Promise(() => {});
		`,
		{
			"/shw.js": [
				JS,
				`let n = 0; onconnect = (e) => { e.ports[0].postMessage(++n); };`,
			],
			"/app": [
				HTML,
				`<script>
				const w = new SharedWorker("/shw.js", "sync");
				w.port.onmessage = (e) => {
					if (opener) { opener.postMessage({ second: e.data }, "*"); return; }
					const first = e.data;
					addEventListener("message", (m) => {
						if (m.data && m.data.second !== undefined)
							report(m.data.second === 2, "first=" + first + " second=" + m.data.second);
					});
					window.open("/app#settings");
				};
				</script>`,
			],
		}
	),
	// a module worker's static import and its import() of the same module
	t(
		"rv15-shw-subframe-vs-top",
		`
		location.href = "/a";
		await new Promise(() => {});
		`,
		{
			"/shw.js": [
				JS,
				`let n = 0; onconnect = (e) => { e.ports[0].postMessage(++n); };`,
			],
			"/a": [
				HTML,
				`<script>
				const w = new SharedWorker("/shw.js");
				w.port.onmessage = (e) => {
					const first = e.data;
					addEventListener("message", (m) => {
						if (m.data && m.data.second !== undefined)
							report(m.data.second === 2, "first=" + first + " second=" + m.data.second);
					});
					const f = document.createElement("iframe"); f.src = "/b"; document.documentElement.appendChild(f);
				};
				</script>`,
			],
			"/b": [
				HTML,
				`<script>
				const w = new SharedWorker("/shw.js");
				w.port.onmessage = (e) => { parent.postMessage({ second: e.data }, "*"); };
				</script>`,
			],
		}
	),
	// A classic script whose src is a blob:/data: URL and that asks for CORS
	// (crossorigin) reaches the SW with no proxy params, which `isUnmarkedModule`
	// takes for an import-map module, so it is rewritten as a module.
	t(
		"rv15-blob-co-htmlcomment",
		`
		const src = "<!-- legacy\\nwindow.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-co-await-ident",
		`
		const src = "var await = 1; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-co-with",
		`
		const src = "with ({}) { window.__loc = location.href; } window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-co-octal",
		`
		const src = "var o = 010; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-co-this",
		`
		const src = "window.__loc = location.href; window.__ran = this === window ? 1 : 0;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-co-plain",
		`
		const src = "window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-nco-htmlcomment",
		`
		const src = "<!-- legacy\\nwindow.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-nco-await-ident",
		`
		const src = "var await = 1; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-nco-with",
		`
		const src = "with ({}) { window.__loc = location.href; } window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-nco-octal",
		`
		const src = "var o = 010; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-nco-this",
		`
		const src = "window.__loc = location.href; window.__ran = this === window ? 1 : 0;";
		const s = document.createElement("script");
		
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-blob-nco-plain",
		`
		const src = "window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-co-htmlcomment",
		`
		const src = "<!-- legacy\\nwindow.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-co-await-ident",
		`
		const src = "var await = 1; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-co-with",
		`
		const src = "with ({}) { window.__loc = location.href; } window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-co-octal",
		`
		const src = "var o = 010; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-co-this",
		`
		const src = "window.__loc = location.href; window.__ran = this === window ? 1 : 0;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-co-plain",
		`
		const src = "window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		s.crossOrigin = "anonymous";
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-nco-htmlcomment",
		`
		const src = "<!-- legacy\\nwindow.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-nco-await-ident",
		`
		const src = "var await = 1; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-nco-with",
		`
		const src = "with ({}) { window.__loc = location.href; } window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-nco-octal",
		`
		const src = "var o = 010; window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-nco-this",
		`
		const src = "window.__loc = location.href; window.__ran = this === window ? 1 : 0;";
		const s = document.createElement("script");
		
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	t(
		"rv15-data-nco-plain",
		`
		const src = "window.__loc = location.href; window.__ran = 1;";
		const s = document.createElement("script");
		
		s.src = "data:text/javascript," + encodeURIComponent(src);
		const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
		assertEqual(ev + ":" + window.__ran, "load:1", "event");
		assertEqual(window.__loc, location.href, "location inside script");
		pass();
		`,
		{}
	),
	// Import map prefix entries: a module reached through the prefix and the
	// same module reached through a relative import inside another module
	t(
		"rv15-importmap-prefix-dup",
		`
		location.href = "/im";
		await new Promise(() => {});
		`,
		{
			"/im": [
				HTML,
				`<script type="importmap">{"imports":{"lib/":"/lib/"}}</script>
				<script type="module">
				import { n } from "lib/a.js";
				import { m } from "lib/b.js";
				report(window.__a === 1 && m === n, "a.js evaluated " + window.__a + " times; same=" + (m === n));
				</script>`,
			],
			"/lib/a.js": [
				JS,
				`window.__a = (window.__a || 0) + 1; export const n = {};`,
			],
			"/lib/b.js": [JS, `export { n as m } from "./a.js";`],
		}
	),

	// the same through a script-inserted map (client-side rewrite) and import()
	t(
		"rv15-importmap-prefix-dup-dyn",
		`
		location.href = "/im2";
		await new Promise(() => {});
		`,
		{
			"/im2": [
				HTML,
				`<script>
				const s = document.createElement("script"); s.type = "importmap";
				s.textContent = JSON.stringify({ imports: { "lib/": "/lib/" } });
				document.head.appendChild(s);
				</script>
				<script type="module">
				import { m } from "lib/b.js";
				const d = await import("lib/a.js");
				report(window.__a === 1 && m === d.n, "a.js evaluated " + window.__a + " times; same=" + (m === d.n));
				</script>`,
			],
			"/lib/a.js": [
				JS,
				`window.__a = (window.__a || 0) + 1; export const n = {};`,
			],
			"/lib/b.js": [JS, `export { n as m } from "./a.js";`],
		}
	),
	// External stylesheet in the top page: every url() inside it now carries
	// `$top`, while the same URL from the HTML does not.
	t(
		"rv15-css-img-dup",
		`
		location.href = "/cp";
		await new Promise(() => {});
		`,
		{
			"/cp": [
				HTML,
				`<link rel="stylesheet" href="/s.css"><div class="bg" style="width:10px;height:10px"></div><img src="/i.png">
				<script>addEventListener("load", () => setTimeout(async () => {
					const h = await (await fetch("/__hits")).json();
					report(h["/i.png"] === 1 && h["/b.css"] === 1, "i.png=" + h["/i.png"] + " b.css=" + h["/b.css"]);
				}, 800));</script>
				<link rel="stylesheet" href="/b.css">`,
			],
			"/s.css": [CSS, `@import "/b.css"; .bg { background: url(/i.png); }`],
			"/b.css": [CSS, `body { color: red; }`],
			"/i.png": [
				"image/png",
				"x",
				{
					"Cache-Control": "max-age=3600",
				},
			],
		}
	),
	t(
		"rv15-font-preload-dup",
		`
		location.href = "/fp";
		await new Promise(() => {});
		`,
		{
			"/fp": [
				HTML,
				`<link rel="preload" as="font" type="font/woff2" href="/f.woff2" crossorigin>
				<link rel="stylesheet" href="/fonts.css">
				<p style="font-family: RvFont">hello</p>
				<script>addEventListener("load", () => setTimeout(async () => {
					const h = await (await fetch("/__hits")).json();
					report(h["/f.woff2"] === 1, "f.woff2 fetched " + h["/f.woff2"] + " times");
				}, 1200));</script>`,
			],
			"/fonts.css": [
				CSS,
				`@font-face { font-family: RvFont; src: url(/f.woff2) format("woff2"); }`,
			],
			"/f.woff2": [
				"font/woff2",
				"notafont",
				{
					"Cache-Control": "max-age=3600",
					"Access-Control-Allow-Origin": "*",
				},
			],
		}
	),

	// A subframe's target=_top link: the new top page is reached with the
	// subframe's `$top`, so its HTML URLs keep that `$top`.
	t(
		"rv15-top-link-from-iframe",
		`
		location.href = "/start";
		await new Promise(() => {});
		`,
		{
			"/start": [
				HTML,
				`<script>const f = document.createElement("iframe"); f.src = "/lf"; document.documentElement.appendChild(f);</script>`,
			],
			"/lf": [
				HTML,
				`<a id=l href="/pagec" target="_top">go</a><script>setTimeout(() => l.click(), 200)</script>`,
			],
			"/pagec": [
				HTML,
				`<a id=next href="/paged">next</a><script type="module" src="/a.js"></script><script type="module" src="/b.js"></script>
				<script>setTimeout(() => { let pu; try { pu = parent.location.href; } catch (e) { pu = "x"; } report(window.__acount === 1 && !pu.includes("/start"), "count=" + window.__acount + " parent=" + pu + " url=" + location.href); }, 1000);</script>`,
			],
			"/a.js": [
				JS,
				`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
			],
			"/b.js": [JS, `import { n } from "./a.js"; export const m = n;`],
		}
	),
	// ... and every page reached from there by a plain link keeps it
	t(
		"rv15-top-link-chain",
		`
		location.href = "/start";
		await new Promise(() => {});
		`,
		{
			"/start": [
				HTML,
				`<script>const f = document.createElement("iframe"); f.src = "/lf"; document.documentElement.appendChild(f);</script>`,
			],
			"/lf": [
				HTML,
				`<a id=l href="/pagec" target="_top">go</a><script>setTimeout(() => l.click(), 200)</script>`,
			],
			"/pagec": [
				HTML,
				`<a id=l href="/paged">next</a><script>setTimeout(() => l.click(), 300)</script>`,
			],
			"/paged": [
				HTML,
				`<a id=l href="/pagee">next</a><script>setTimeout(() => l.click(), 300)</script>`,
			],
			"/pagee": [
				HTML,
				`<script type="module" src="/a.js"></script><script type="module" src="/b.js"></script>
				<script>setTimeout(() => report(window.__acount === 1, "count=" + window.__acount + " url=" + location.href), 1000);</script>`,
			],
			"/a.js": [
				JS,
				`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
			],
			"/b.js": [JS, `import { n } from "./a.js"; export const m = n;`],
		}
	),
	// after one hash change, a hash-only location.href/assign/replace is a new document
	...["href", "assign", "replace"].map((how) =>
		t(
			"rv15-hash-then-" + how,
			`
			location.href = "/h";
			await new Promise(() => {});
			`,
			{
				"/h": [
					HTML,
					`<script>
					if (sessionStorage.rv15h) { report(false, "page reloaded, hash=" + location.hash); }
					else {
						sessionStorage.rv15h = 1;
						let changes = 0;
						addEventListener("hashchange", () => {
							changes++;
							if (changes === 1) {
								const how = ${JSON.stringify(how)};
								if (how === "href") location.href = "#two";
								else location[how]("#two");
							} else report(location.hash === "#two", "second hashchange, hash=" + location.hash);
						});
						location.hash = "one";
					}
					</script>`,
				],
			}
		)
	),
	// other ways a subframe navigates the top
	...[
		["open", `window.open("/pagec", "_top")`],
		["toploc", `top.location.href = "/pagec"`],
		// (a script-built form with target=_top escapes to the real top on both builds and kills the harness: bucket 4 #17)
		[
			"basetarget",
			`const b = document.createElement("base"); b.target = "_top"; document.head.appendChild(b); const a = document.createElement("a"); a.href = "/pagec"; document.body.appendChild(a); a.click()`,
		],
	].map(([k, code]) =>
		t(
			"rv15-topnav-" + k,
			`
			location.href = "/start";
			await new Promise(() => {});
			`,
			{
				"/start": [
					HTML,
					`<script>const f = document.createElement("iframe"); f.src = "/lf"; document.documentElement.appendChild(f);</script>`,
				],
				"/lf": [
					HTML,
					`<body><script>setTimeout(() => { ${code} }, 200)</script></body>`,
				],
				"/pagec": [
					HTML,
					`<script type="module" src="/a.js"></script><script type="module" src="/b.js"></script>
					<script>setTimeout(() => { let pu; try { pu = parent.location.href; } catch (e) { pu = "x"; } report(window.__acount === 1 && !pu.includes("/start"), "count=" + window.__acount + " parent=" + pu); }, 1000);</script>`,
				],
				"/a.js": [
					JS,
					`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
				],
				"/b.js": [JS, `import { n } from "./a.js"; export const m = n;`],
			}
		)
	),
	// the URL a second pushState leaves in the document carries $top, so a
	// reload (or a back navigation that refetches) of that entry is rewritten
	// with a stale $top
	...[
		["reload", `location.reload()`],
		["back", `location.href = "/away"`],
	].map(([k, code]) =>
		t(
			"rv15-pushstate2-" + k,
			`
			location.href = "/sp";
			await new Promise(() => {});
			`,
			{
				"/sp": [
					HTML,
					`<script type="module" src="/a.js"></script><script type="module" src="/b.js"></script>
					<script>
					const st = sessionStorage.rv15ps || "";
					if (!st) {
						sessionStorage.rv15ps = "1";
						setTimeout(() => {
							history.pushState(null, "", "/sp?r=1");
							history.pushState(null, "", "/sp?r=2");
							${code};
						}, 300);
					} else {
						setTimeout(() => report(window.__acount === 1, "after ${k}: count=" + window.__acount + " url=" + location.href), 1000);
					}
					</script>`,
				],
				"/away": [
					HTML,
					`<script>setTimeout(() => history.back(), 300)</script>`,
				],
				"/a.js": [
					JS,
					`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
				],
				"/b.js": [JS, `import { n } from "./a.js"; export const m = n;`],
			}
		)
	),
	// an iframe from the page's own HTML (SW-rewritten, no $tf) - its _top link
	t(
		"rv15-static-iframe-top-link",
		`
		location.href = "/start";
		await new Promise(() => {});
		`,
		{
			"/start": [HTML, `<iframe src="/lf"></iframe>`],
			"/lf": [
				HTML,
				`<a id=l href="/pagec" target="_top">go</a><script>setTimeout(() => l.click(), 200)</script>`,
			],
			"/pagec": [
				HTML,
				`<script>setTimeout(() => { let pu; try { pu = parent.location.href; } catch (e) { pu = "x"; } report(!pu.includes("/start"), "parent=" + pu + " target=" + ""); }, 300);</script>`,
			],
		}
	),
	// the order a script's type and src are set in
	...[
		["src-then-type", `s.src = "/m.js"; s.type = "module";`],
		["type-then-src", `s.type = "module"; s.src = "/m.js";`],
		[
			"setattr-src-then-type",
			`s.setAttribute("src", "/m.js"); s.setAttribute("type", "module");`,
		],
		["link-href-then-rel", null],
	].map(([k, code]) =>
		t(
			"rv15-order-" + k,
			code
				? `
			window.__loc = null;
			const s = document.createElement("script");
			${code}
			const ev = await new Promise((r) => { s.onload = () => r("load"); s.onerror = () => r("error"); document.body.appendChild(s); setTimeout(() => r("timeout"), 3000); });
			assertEqual(ev, "load", "event");
			assertEqual(window.__loc, location.href, "location inside module");
			assertEqual(window.__dep, 1, "dep");
			pass();
			`
				: `
			const l = document.createElement("link"); l.href = "/m.js"; l.rel = "modulepreload";
			document.head.appendChild(l);
			await new Promise((r) => setTimeout(r, 500));
			const s = document.createElement("script"); s.type = "module"; s.src = "/m.js";
			await new Promise((r) => { s.onload = r; s.onerror = r; document.body.appendChild(s); });
			const h = await (await fetch("/__hits")).json();
			assertEqual(h["/m.js"], 1, "m.js fetches");
			pass();
			`,
			{
				"/m.js": [JS, `import "./dep.js"; window.__loc = location.href;`],
				"/dep.js": [JS, `window.__dep = 1;`],
			}
		)
	),
	// <a ping>: hyperlink auditing URLs
	t(
		"rv15-a-ping",
		`
		location.href = "/pg";
		await new Promise(() => {});
		`,
		{
			"/pg": [
				HTML,
				`<body><script>
				const a = document.createElement("a");
				a.href = "/dest"; a.setAttribute("ping", "/pingrel " + location.origin.replace("localhost", "127.0.0.1") + "/pingabs");
				document.body.appendChild(a); a.click();
			</script></body>`,
			],
			"/dest": [
				HTML,
				`<script>setTimeout(async () => { const h = await (await fetch("/__hits")).json(); report(h["/pingrel"] === 1 && !h["/pingabs"], "pingrel=" + h["/pingrel"] + " pingabs=" + h["/pingabs"]); }, 800);</script>`,
			],
			"/pingrel": ["text/plain", ""],
			"/pingabs": ["text/plain", ""],
		}
	),
	// legacy background= attributes (body/table/td), which Chrome fetches as images
	t(
		"rv15-background-attr",
		`
		location.href = "/bgp";
		await new Promise(() => {});
		`,
		{
			"/bgp": [
				HTML,
				`<body background="/bg1.png"><table background="/bg2.png"><tr><td background="/bg3.png">x</td></tr></table>
				<script>addEventListener("load", () => setTimeout(async () => { const h = await (await fetch("/__hits")).json(); report(h["/bg1.png"] === 1 && h["/bg2.png"] === 1 && h["/bg3.png"] === 1, "bg1=" + h["/bg1.png"] + " bg2=" + h["/bg2.png"] + " bg3=" + h["/bg3.png"] + " attr=" + document.body.getAttribute("background")); }, 500));</script></body>`,
			],
			"/bg1.png": ["image/png", "x"],
			"/bg2.png": ["image/png", "x"],
			"/bg3.png": ["image/png", "x"],
		}
	),
	// a subframe navigated by name from the top page (no $top on the URL):
	// the SW takes the frame for a top-level document
	...[
		[
			"link",
			`const a = document.createElement("a"); a.href = "/fr2"; a.target = "nf"; document.body.appendChild(a); a.click();`,
		],
		["open", `window.open("/fr2", "nf");`],
		[
			"form",
			`const fm = document.createElement("form"); fm.action = "/fr2"; fm.method = "post"; fm.target = "nf"; document.body.appendChild(fm); fm.submit();`,
		],
		["src-control", `document.querySelector("iframe").src = "/fr2";`],
	].map(([k, code]) =>
		t(
			"rv15-named-" + k,
			`
			location.href = "/nt";
			await new Promise(() => {});
			`,
			{
				"/nt": [
					HTML,
					`<body><script>
					const f = document.createElement("iframe"); f.name = "nf"; f.src = "/blank"; document.body.appendChild(f);
					f.onload = () => { f.onload = null; setTimeout(() => { ${code} }, 100); };
				</script></body>`,
				],
				"/blank": [HTML, `<p>blank</p>`],
				"/fr2": [
					HTML,
					`<script type="module" src="/a.js"></script><script type="module">
					const m = await import("/a.js");
					setTimeout(() => report(window.__acount === 1, "count=" + window.__acount), 300);
				</script>`,
				],
				"/a.js": [
					JS,
					`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
				],
			}
		)
	),
	// a subframe's own GET form: the browser replaces the action's query (and
	// with it $top) by the form data
	...[
		["get", "get"],
		["post-control", "post"],
	].map(([k, method]) =>
		t(
			"rv15-frameform-" + k,
			`
			location.href = "/ft";
			await new Promise(() => {});
			`,
			{
				"/ft": [
					HTML,
					`<body><script>const f = document.createElement("iframe"); f.src = "/ff"; document.body.appendChild(f);</script></body>`,
				],
				"/ff": [
					HTML,
					`<form id=fm method=${method} action="/fr2"><input name=q value=1></form><script>setTimeout(() => fm.submit(), 100)</script>`,
				],
				"/fr2": [
					HTML,
					`<script type="module" src="/a.js"></script><script type="module">
					const m = await import("/a.js");
					setTimeout(() => report(window.__acount === 1, "count=" + window.__acount + " url=" + location.href), 300);
				</script>`,
				],
				"/a.js": [
					JS,
					`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
				],
			}
		)
	),
	// preloaded LCP background image referenced from an external stylesheet
	t(
		"rv15-image-preload-dup",
		`
		location.href = "/ip";
		await new Promise(() => {});
		`,
		{
			"/ip": [
				HTML,
				`<link rel="preload" as="image" href="/hero.jpg"><link rel="stylesheet" href="/hero.css"><div class="hero" style="width:50px;height:50px"></div>
				<script>addEventListener("load", () => setTimeout(async () => {
					const h = await (await fetch("/__hits")).json();
					report(h["/hero.jpg"] === 1, "hero.jpg fetched " + h["/hero.jpg"] + " times");
				}, 800));</script>`,
			],
			"/hero.css": [CSS, `.hero { background-image: url(/hero.jpg); }`],
			"/hero.jpg": [
				"image/jpeg",
				"x",
				{
					"Cache-Control": "max-age=3600",
				},
			],
		}
	),
	// blob: and srcdoc preview iframes
	...[
		[
			"blob",
			`f.src = URL.createObjectURL(new Blob([html], { type: "text/html" }));`,
		],
		["srcdoc", `f.srcdoc = html;`],
	].map(([k, code]) =>
		t(
			"rv15-preview-" + k,
			`
			location.href = "/pv";
			await new Promise(() => {});
			`,
			{
				"/pv": [
					HTML,
					`<body><script>
					const A = location.origin + "/a.js";
					const html = '<script type="module" src="' + A + '"><' + '/script><script type="module">await import("' + A + '"); setTimeout(() => parent.postMessage({ c: window.__acount }, "*"), 300);<' + '/script>';
					addEventListener("message", (e) => { if (e.data && e.data.c !== undefined) report(e.data.c === 1, "count=" + e.data.c); });
					const f = document.createElement("iframe");
					${code}
					document.body.appendChild(f);
				</script></body>`,
				],
				"/a.js": [
					JS,
					`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
				],
			}
		)
	),
	// what the page can read after its document URL picked up $top
	t(
		"rv15-leak-after-reload",
		`
		location.href = "/lk?q=1#h";
		await new Promise(() => {});
		`,
		{
			"/lk": [
				HTML,
				`<a id=rel href="x?y=2">r</a><script>
				if (!sessionStorage.rv15lk) {
					sessionStorage.rv15lk = 1;
					setTimeout(() => { history.pushState(null, "", "/lk?q=2"); history.pushState(null, "", "/lk?q=3#z"); location.reload(); }, 200);
				} else setTimeout(() => {
					const nav = performance.getEntriesByType("navigation")[0];
					const vals = {
						href: location.href, url: document.URL, base: document.baseURI, search: location.search,
						rel: document.getElementById("rel").href, nav: nav && nav.name,
						req: new Request("z").url, docurl: document.documentURI,
					};
					const bad = Object.entries(vals).filter(([k, v]) => String(v).includes("$") || String(v).includes("%24") || String(v).includes("/~/"));
					report(bad.length === 0, JSON.stringify(vals));
				}, 300);
				</script>`,
			],
		}
	),
	// a URL-keyed import map (cache busting) in a top page reloaded after two pushStates
	t(
		"rv15-pushstate2-importmap",
		`
		location.href = "/ipm";
		await new Promise(() => {});
		`,
		{
			"/ipm": [
				HTML,
				`<script type="importmap">{"imports":{"/v/x.js":"/v/x.abc.js"}}</script>
				<script type="module" src="/m.js"></script>
				<script>
				addEventListener("error", (e) => report(false, "error: " + (e.message || (e.target && e.target.src))), true);
				setTimeout(() => {
					if (!window.__x) return report(false, "x not loaded, reloaded=" + !!sessionStorage.rv15ipm);
					if (!sessionStorage.rv15ipm) {
						sessionStorage.rv15ipm = 1;
						history.pushState(null, "", "/ipm?r=1"); history.pushState(null, "", "/ipm?r=2"); location.reload();
					} else report(true, "loaded after reload");
				}, 600);
				</script>`,
			],
			"/m.js": [JS, `import "/v/x.js";`],
			"/v/x.abc.js": [JS, `window.__x = 1;`],
		}
	),
] as Test[];
