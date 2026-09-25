import { serverTest } from "../../../testcommon.ts";

const page = (map: string, body: string) => `<!DOCTYPE html><html><head>
<script type="importmap">${map}</script>
</head><body><script type="module">
runTest(async () => {
${body}
}, true);
</script></body></html>`;

const deps: Record<string, string> = {
	"/lib.js": "export const v = 'lib1';",
	"/lib2.js": "export const v = 'lib2';",
	"/pkg/w.js": "export const w = 'w';",
	"/scoped/s.js": "import { v } from 'lib'; export const s = 'scoped:' + v;",
	"/static.js": "import { v } from 'lib'; export const st = 'static:' + v;",
};

const mk = (name: string, map: string, body: string) =>
	serverTest({
		name: `rv2-importmap-${name}`,
		start: async (server) => {
			server.on("request", (req, res) => {
				const path = (req.url ?? "").split("?")[0];
				const src = path === "/" ? page(map, body) : deps[path];
				if (src === undefined) {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, {
					"Content-Type": path === "/" ? "text/html" : "application/javascript",
				});
				res.end(src);
			});
		},
	});

export default [
	mk(
		"static",
		`{"imports": {"lib": "/lib.js"}}`,
		`const m = await import("/static.js"); assertEqual(m.st, "static:lib1");`
	),
	mk(
		"dynamic-bare",
		`{"imports": {"lib": "/lib.js"}}`,
		`const m = await import("lib"); assertEqual(m.v, "lib1");`
	),
	mk(
		"dynamic-absolute-map",
		`{"imports": {"lib": "http://localhost:" + 0 + "/nope"}}`.replace(
			`"http://localhost:" + 0 + "/nope"`,
			`"./lib.js"`
		),
		`const m = await import("lib"); assertEqual(m.v, "lib1");`
	),
	mk(
		"prefix",
		`{"imports": {"pkg/": "/pkg/"}}`,
		`const m = await import("pkg/w.js"); assertEqual(m.w, "w");`
	),
	mk(
		"scopes",
		`{"imports": {"lib": "/lib.js"}, "scopes": {"/scoped/": {"lib": "/lib2.js"}}}`,
		`const m = await import("/scoped/s.js"); assertEqual(m.s, "scoped:lib2");`
	),
];
