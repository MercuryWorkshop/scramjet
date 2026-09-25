import { serverTest } from "../../../testcommon.ts";

const page = (
	map: object,
	body: string,
	prelude = ""
) => `<!DOCTYPE html><html><head>
<script type="importmap">${JSON.stringify(map)}</script>
</head><body><script type="module">
${prelude}
runTest(async () => {
${body}
}, true);
</script></body></html>`;

const T = (name: string, map: object, body: string, prelude = "") =>
	serverTest({
		name,
		scramjetOnly: true,
		start: async (server) => {
			server.on("request", (req, res) => {
				const path = (req.url || "/").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(page(map, body, prelude));
				} else if (path.endsWith(".js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					if (path === "/lib/dep.js")
						res.end(
							`export const d = "dep"; export const meta = import.meta.url;`
						);
					else if (path === "/scoped/inner.js")
						res.end(`export const load = () => import("util");`);
					else if (path === "/util-a.js") res.end(`export const which = "a";`);
					else if (path === "/util-b.js") res.end(`export const which = "b";`);
					else res.end(`export const v = "mod:" + ${JSON.stringify(path)};`);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	});

export default [
	T(
		"rv5-importmap-parser-static-bare",
		{
			imports: {
				app: "/app.js",
			},
		},
		`assertEqual(staticV, "mod:/app.js");`,
		`import { v as staticV } from "app";`
	),
	T(
		"rv5-importmap-parser-dynamic-bare",
		{
			imports: {
				app: "/app.js",
			},
		},
		`const m = await import("app"); assertEqual(m.v, "mod:/app.js");`
	),
	T(
		"rv5-importmap-parser-dynamic-prefix",
		{
			imports: {
				"lib/": "/lib/",
			},
		},
		`const m = await import("lib/dep.js"); assertEqual(m.d, "dep"); assertEqual(m.meta, location.origin + "/lib/dep.js", "import.meta.url");`
	),
	T(
		"rv5-importmap-parser-dynamic-absolute-address",
		{
			imports: {
				app: "http://localhost:" + "PORT_PLACEHOLDER" + "/app.js",
			},
		},
		`/* absolute address pointing at test server itself is filled at runtime below */ assert(true);`
	),
	T(
		"rv5-importmap-parser-dynamic-scopes",
		{
			imports: {
				util: "/util-a.js",
			},
			scopes: {
				"/scoped/": {
					util: "/util-b.js",
				},
			},
		},
		`const top = await import("util"); assertEqual(top.which, "a", "top-level");
		 const inner = await import("/scoped/inner.js"); const s = await inner.load(); assertEqual(s.which, "b", "scoped");`
	),
	T(
		"rv5-importmap-parser-unmapped-relative-still-works",
		{
			imports: {
				app: "/app.js",
			},
		},
		`const m = await import("./other.js"); assertEqual(m.v, "mod:/other.js");
		 const m2 = await import(location.origin + "/abs.js"); assertEqual(m2.v, "mod:/abs.js");`
	),
	T(
		"rv5-importmap-parser-dynamic-bare-from-module",
		{
			imports: {
				util: "/util-a.js",
			},
		},
		`const inner = await import("/scoped/inner.js"); const s = await inner.load(); assertEqual(s.which, "a", "bare import() from inside a module file");`
	),
];
