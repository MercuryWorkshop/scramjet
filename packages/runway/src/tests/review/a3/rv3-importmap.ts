import { serverTest } from "../../../testcommon.ts";

function importmapTest(
	name: string,
	map: string,
	moduleBody: string,
	extra: Record<string, string> = {}
) {
	return serverTest({
		name,
		async start(server) {
			const files: Record<string, string> = {
				"/lib/a.js": "export default 'A';",
				"/lib/sub/b.js":
					"export default 'B'; export { default as A } from 'a';",
				"/lib/c.js?v=1": "export default 'C1';",
				"/cdn/x.js": "export default 'X';",
				"/app/main.js":
					"import a from 'a'; import b from 'lib/sub/b.js'; export default a + b;",
				"/scoped/y.js": "export default 'Y-scoped';",
				"/lib/y.js": "export default 'Y-global';",
				"/app/usey.js": "import y from 'y'; export default y;",
				...extra,
			};
			server.on("request", (req, res) => {
				if (files[req.url!] !== undefined) {
					res.writeHead(200, {
						"content-type": "text/javascript",
						"access-control-allow-origin": "*",
					});
					res.end(files[req.url!]);
					return;
				}
				if (req.url === "/") {
					res.writeHead(200, {
						"content-type": "text/html",
					});
					res.end(`<!doctype html><html><head><script type="importmap">${map}</script></head><body>
<script type="module">
const c = (label, v) => assertConsistent(label, v);
const tryImp = async (s) => { try { const m = await import(s); return m.default; } catch (e) { return "ERR " + e.name; } };
${moduleBody}
</script></body></html>`);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	});
}

export default [
	importmapTest(
		"rv3-importmap-static",
		`{"imports":{"a":"/lib/a.js","lib/":"/lib/","y":"/lib/y.js"},"scopes":{"/app/":{"y":"/scoped/y.js"}}}`,
		`import a from "a";
c("static.a", a);
runTest(async () => {
  c("dyn.a", await tryImp("a"));
  c("dyn.prefix", await tryImp("lib/sub/b.js"));
  c("dyn.prefix.nested", (await import("lib/sub/b.js").then(m => m.A).catch(e => "ERR " + e.name)));
  c("dyn.appmain", await tryImp("/app/main.js"));
  c("dyn.scoped", await tryImp("/app/usey.js"));
  c("dyn.bare-missing", await tryImp("nope"));
}, true);`
	),
	importmapTest(
		"rv3-importmap-static-prefix",
		`{"imports":{"lib/":"/lib/","a":"/lib/a.js"}}`,
		`import b from "lib/sub/b.js";
c("static.prefix", b);
runTest(async () => { c("ok", 1); }, true);`
	),
	importmapTest(
		"rv3-importmap-debug-prefix",
		`{"imports":{"lib/":"/lib/","a":"/lib/a.js"}}`,
		`runTest(async () => {
  const raw = document.querySelector("script[type=importmap]").textContent;
  const out = [raw];
  let url = null;
  try { url = JSON.parse(raw).imports["lib/"]; } catch (e) {}
  if (url && url !== "/lib/") {
    const r = await fetch(url + "sub/b.js").then(async r => r.status + " " + (await r.text()).slice(0, 200)).catch(e => "FETCHERR " + e);
    out.push(r);
  }
  fail(out.join(" || "));
}, true);`
	),
	importmapTest(
		"rv3-importmap-url-key",
		`{"imports":{"/cdn/x.js":"/lib/a.js"}}`,
		`import x from "/cdn/x.js";
c("static.urlkey", x);
runTest(async () => { c("dyn.urlkey", await tryImp("/cdn/x.js")); }, true);`
	),
];
