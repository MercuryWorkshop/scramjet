import { serverTest } from "../../../testcommon.ts";
import { site } from "./lib.ts";

// a map whose only entries are under a root scope ("./" or "/"), which is what
// @jspm/generator emits for a page's own local dependencies
const scopePage = (
	scope: string
) => `<!doctype html><html><head><script type="importmap">${JSON.stringify({
	imports: {
		app: "./src/app.js",
	},
	scopes: {
		[scope]: {
			sver: "/vendor/sver.js",
		},
	},
})}</script></head><body>
<script type="module">
import { v } from "app";
runTest(async () => { assertConsistent("static-from-scoped-module", v); }, true);
</script></body></html>`;

const files = {
	"/src/app.js": "import s from 'sver'; export const v = 'app+' + s;",
	"/vendor/sver.js": "export default 'sver';",
};

const tests = [
	site("rv16-root-scope-dot", {
		...files,
		"/": scopePage("./"),
	}),
	site("rv16-root-scope-slash", {
		...files,
		"/": scopePage("/"),
	}),
	site("rv16-root-scope-dir", {
		...files,
		"/": scopePage("/src/"),
	}),
];

// the same, with the scope's addresses on another origin (as jspm's ga.jspm.io URLs are)
const xoScope = (name: string, scope: string) =>
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
					res.writeHead(200, {
						"content-type": "text/html",
					});
					return res.end(`<!doctype html><html><head><script type="importmap">${JSON.stringify(
						{
							imports: {
								app: "./src/app.js",
							},
							scopes: {
								[scope]: {
									sver: `http://127.0.0.1:${port}/vendor/sver.js`,
								},
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
tests.push(
	xoScope("rv16-root-scope-xo-dot", "./"),
	xoScope("rv16-root-scope-xo-slash", "/")
);

export default tests;
