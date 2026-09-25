import { serverTest, type Test } from "../../../testcommon.ts";

// dynamic import() vs static import through an import map: a module must be
// instantiated once, whichever way it is reached
function mapTest(name: string, map: object, body: string): Test {
	return serverTest({
		name,
		async start(server) {
			server.on("request", (req, res) => {
				const u = req.url || "/";
				if (u === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!DOCTYPE html><html><head>
<script type="importmap">${JSON.stringify(map)}</script>
</head><body>
<script type="module">
${body}
</script></body></html>`);
				} else if (u.startsWith("/lib/") || u.startsWith("/exact.js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`window.__count = (window.__count || 0) + 1; export const id = Math.random(); export const url = import.meta.url;`
					);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	});
}

export default [
	mapTest(
		"rv8-importmap-exact-static-dynamic",
		{
			imports: {
				exact: "/exact.js",
			},
		},
		`import { id } from "exact";
runTest(async () => {
  const m = await import("exact");
  assertEqual(m.id, id, "same module instance");
  assertEqual(window.__count, 1, "evaluated once");
  pass();
}, false);`
	),
	mapTest(
		"rv8-importmap-prefix-static-dynamic",
		{
			imports: {
				"lib/": "/lib/",
			},
		},
		`import { id } from "lib/a.js";
runTest(async () => {
  const m = await import("lib/a.js");
  assertEqual(m.id, id, "same module instance");
  assertEqual(window.__count, 1, "evaluated once");
  pass();
}, false);`
	),
	mapTest(
		"rv8-importmap-dynamic-only",
		{
			imports: {
				exact: "/exact.js",
				"lib/": "/lib/",
			},
		},
		`runTest(async () => {
  const m = await import("exact");
  const n = await import("lib/b.js");
  const m2 = await import("exact");
  assertEqual(m.id, m2.id, "same module instance");
  assertEqual(window.__count, 2, "each evaluated once");
  pass();
}, false);`
	),
	mapTest(
		"rv8-dynamic-import-relative-twice",
		{},
		`import { id } from "/exact.js";
runTest(async () => {
  const m = await import("/exact.js");
  const m2 = await import("./exact.js");
  assertEqual(m.id, id, "static vs dynamic");
  assertEqual(m2.id, id, "relative dynamic");
  assertEqual(window.__count, 1, "evaluated once");
  pass();
}, false);`
	),
];
