import { serverTest } from "../testcommon.ts";

// A module reached through an import-map prefix, statically
// and with import(), must be one module instance.
function identityTest(name: string, map: object, spec: string) {
	return serverTest({
		// one server serves both harnesses, and the bare side's answer would
		// settle the test before scramjet's
		scramjetOnly: true,
		name,
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				const path = (req.url ?? "").split("?")[0];
				if (path === "/") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!doctype html>
<script type="importmap">${JSON.stringify({ imports: map })}</script>
<script type="module" src="/main.js"></script>`);
				} else if (path === "/main.js") {
					res.writeHead(200, { "Content-Type": "text/javascript" });
					res.end(`import { registry } from ${JSON.stringify(spec)};
registry.set("static", 1);
const again = await import(${JSON.stringify(spec)});
fetch(again.registry === registry ? "/same" : "/different?runs=" + globalThis.__runs);`);
				} else if (path === "/lib/state.js") {
					res.writeHead(200, { "Content-Type": "text/javascript" });
					res.end(
						`globalThis.__runs = (globalThis.__runs ?? 0) + 1; export const registry = new Map();`
					);
				} else if (path === "/same") {
					res.writeHead(204);
					res.end();
					pass("one module instance");
				} else if (path === "/different") {
					res.writeHead(204);
					res.end();
					fail(`two module instances (${req.url})`);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	});
}

export default [
	identityTest(
		"importmap-identity-prefix-static-and-dynamic",
		{ "pkg/": "/lib/" },
		"pkg/state.js"
	),
	identityTest(
		"importmap-identity-exact-static-and-dynamic",
		{ "pkg/state.js": "/lib/state.js" },
		"pkg/state.js"
	),
	identityTest(
		"importmap-identity-none-static-and-dynamic",
		{},
		"/lib/state.js"
	),
];
