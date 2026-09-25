import { serverTest, type Test } from "../../../testcommon.ts";

const FILES: Record<string, [string, string]> = {
	"/a.js": [
		"application/javascript",
		`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
	],
	"/b.js": [
		"application/javascript",
		`import { n } from "./a.js"; export const m = n;`,
	],
	"/el.js": [
		"application/javascript",
		`window.__defs = (window.__defs||0)+1; try { customElements.define("rv-el", class extends HTMLElement {}); } catch (e) { window.__err = e.message; }`,
	],
	"/app.js": ["application/javascript", `import "./el.js";`],
	"/linkframe": [
		"text/html",
		`<!doctype html><body><a id=l href="/pagec" target="_top">go</a><script>setTimeout(() => l.click(), 100)</script></body>`,
	],
	"/pagec": [
		"text/html",
		`<!doctype html><body><script type="module" src="/a.js"></script><script type="module" src="/b.js"></script><script>
		setTimeout(() => runTest(async () => { throw new Error("RESULT count=" + window.__acount + " url=" + location.href); }), 800);
	</script></body>`,
	],
	"/linkframe2": [
		"text/html",
		`<!doctype html><body><script>setTimeout(() => { top.location.href = "/pagec"; }, 100)</script></body>`,
	],
	"/paged": [
		"text/html",
		`<!doctype html><body><script>runTest(async () => { assert(true); });</script></body>`,
	],
	"/linkframe3": [
		"text/html",
		`<!doctype html><body><a id=l href="/paged" target="_top">go</a><script>setTimeout(() => l.click(), 100)</script></body>`,
	],
	"/data.json": ["application/json", `{"k": 42}`],
	"/jm.js": [
		"application/javascript",
		`import d from "./data.json" with { type: "json" }; export default d;`,
	],
	"/sheet.css": ["text/css", `body { --rv6: 1; }`],
	"/cm.js": [
		"application/javascript",
		`import s from "./sheet.css" with { type: "css" }; export default s;`,
	],
	"/hb.js": [
		"application/javascript",
		"#!/usr/bin/env node\nexport const hb = 1;",
	],
	"/frame": [
		"text/html",
		`<!doctype html><body><script src="/frame.js"></script></body>`,
	],
	"/frame.js": [
		"application/javascript",
		`
		(async () => {
			const s = document.createElement("script"); s.type = "module"; s.src = "/a.js";
			await new Promise((r) => { s.onload = r; s.onerror = r; document.body.appendChild(s); });
			await import("/b.js");
			await import("/a.js");
			parent.postMessage({ count: window.__acount }, "*");
		})();
	`,
	],
};

const t = (name: string, js: string) =>
	Object.assign(
		serverTest({
			name,
			autoPass: true,
			js,
			start: async (server) => {
				server.on("request", (req, res) => {
					if (res.headersSent) return;
					const path = (req.url || "/").split("?")[0];
					if (path === "/" || path === "/script.js") return;
					const f = FILES[path];
					if (!f) {
						res.writeHead(404);
						res.end("nf");
						return;
					}
					res.writeHead(200, {
						"Content-Type": f[0],
					});
					res.end(f[1]);
				});
			},
		}),
		{
			timeoutMs: 15000,
		}
	);

export default [
	t(
		"rv6-top-module-dedupe",
		`
		const s = document.createElement("script"); s.type = "module"; s.src = "/a.js";
		await new Promise((r) => { s.onload = r; s.onerror = r; document.body.appendChild(s); });
		assertEqual(window.__acount, 1, "script element");
		await import("/b.js");
		assertEqual(window.__acount, 1, "after importing b.js (imports ./a.js): " + window.__acount);
		await import("/a.js");
		assertEqual(window.__acount, 1, "after import(a.js)");
	`
	),
	t(
		"rv6-top-module-dedupe-static-html",
		`
		const s = document.createElement("script"); s.type = "module"; s.src = "/app.js";
		await new Promise((r) => { s.onload = r; s.onerror = r; document.body.appendChild(s); });
		await import("/el.js");
		assertEqual(window.__err, undefined, String(window.__err));
		assertEqual(window.__defs, 1);
	`
	),
	t(
		"rv6-top-module-dedupe-iframe",
		`
		const p = new Promise((r) => addEventListener("message", (e) => r(e.data), { once: true }));
		const f = document.createElement("iframe"); f.src = "/frame"; document.body.appendChild(f);
		const d = await p;
		assertEqual(d.count, 1, "a.js evaluated in frame " + d.count + " times");
	`
	),
	t(
		"rv6-top-link-from-iframe-to-top",
		`
		const f = document.createElement("iframe"); f.src = "/linkframe"; document.body.appendChild(f);
		await new Promise(() => {});
	`
	),
	t(
		"rv6-top-location-from-iframe-to-top",
		`
		const f = document.createElement("iframe"); f.src = "/linkframe2"; document.body.appendChild(f);
		await new Promise(() => {});
	`
	),
	t(
		"rv6-top-link-nomodule-sanity",
		`
		const f = document.createElement("iframe"); f.src = "/linkframe3"; document.body.appendChild(f);
		await new Promise(() => {});
	`
	),
	t(
		"rv6-top-json-module",
		`
		const m = await import("/jm.js");
		assertEqual(m.default.k, 42);
		const d = await import("/data.json", { with: { type: "json" } });
		assertEqual(d.default.k, 42);
	`
	),
	t(
		"rv6-top-css-module",
		`
		const m = await import("/cm.js");
		assert(m.default instanceof CSSStyleSheet, "css module");
	`
	),
	t(
		"rv6-top-hashbang-module",
		`
		const m = await import("/hb.js");
		assertEqual(m.hb, 1);
		assertEqual(eval("#!x\n5"), 5);
	`
	),
] as Test[];
