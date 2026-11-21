import { serverTest } from "../testcommon.ts";

// An import map whose dependencies sit under a root scope ("./" or "/"), as
// @jspm/generator emits for a page's own modules. A static import from a
// module on the page's origin has to resolve through it.
const rootScope = (name: string, scope: string, crossOrigin: boolean) =>
	serverTest({
		name,
		start: async (server, port) => {
			server.on("request", (req, res) => {
				const u = (req.url || "/").split("?")[0];
				const js = (b: string) => {
					res.writeHead(200, {
						"content-type": "text/javascript",
						"access-control-allow-origin": "*",
					});
					res.end(b);
				};
				if (u === "/src/app.js")
					return js("import s from 'sver'; export const v = 'app+' + s;");
				if (u === "/vendor/sver.js") return js("export default 'sver';");
				if (u === "/") {
					const host = crossOrigin ? "127.0.0.1" : "localhost";
					res.writeHead(200, { "content-type": "text/html" });
					return res.end(`<!doctype html><html><head><script type="importmap">${JSON.stringify(
						{
							imports: { app: "./src/app.js" },
							scopes: {
								[scope]: { sver: `http://${host}:${port}/vendor/sver.js` },
							},
						}
					)}</script></head><body>
<script type="module">
import { v } from "app";
window.__v = v;
</script>
<script>
runTest(async () => { for (let i = 0; i < 60 && !window.__v; i++) await new Promise(r => setTimeout(r, 50)); assertConsistent("static-from-scoped-module", window.__v || "not loaded"); }, true);
</script></body></html>`);
				}
				res.writeHead(404);
				res.end();
			});
		},
	});

export default [
	rootScope("importmap-root-scope-dot", "./", false),
	rootScope("importmap-root-scope-slash", "/", false),
	rootScope("importmap-root-scope-dot-xo", "./", true),
	rootScope("importmap-root-scope-slash-xo", "/", true),
];
