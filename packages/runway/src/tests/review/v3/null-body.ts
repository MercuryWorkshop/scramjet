import { serverTest } from "../../../testcommon.ts";

// responses that must not carry a body: 204, 205, 304 and a HEAD
export default [
	serverTest({
		name: "v3-null-body-status",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/204") {
					res.writeHead(204);
					res.end();
					return;
				}
				if (req.url === "/205") {
					res.writeHead(205);
					res.end();
					return;
				}
				if (req.url === "/etag") {
					if (req.headers["if-none-match"] === '"v1"') {
						res.writeHead(304, { ETag: '"v1"' });
						res.end();
						return;
					}
					res.writeHead(200, {
						ETag: '"v1"',
						"Cache-Control": "no-cache",
						"Content-Type": "text/plain",
					});
					res.end("body");
					return;
				}
				if (req.url === "/head") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Content-Length": "4",
					});
					res.end(req.method === "HEAD" ? undefined : "body");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><script>
runTest(async () => {
	const r = async (u, i) => { try { const x = await fetch(u, i); return x.status + ":" + (await x.text()); } catch (e) { return "threw:" + e.name; } };
	assertConsistent("204", await r("/204"));
	assertConsistent("205", await r("/205"));
	assertConsistent("head", await r("/head", { method: "HEAD" }));
	assertConsistent("etag1", await r("/etag"));
	assertConsistent("etag2", await r("/etag", { headers: { "If-None-Match": '"v1"' } }));
	assertConsistent("beacon", navigator.sendBeacon("/204", "x"));
}, true);
</script>`);
			});
		},
	}),
];
