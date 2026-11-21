import { serverTest } from "../../../testcommon.ts";

// a synchronous XHR from a document: Chrome still allows it (with a console
// deprecation warning) and still routes it through a service worker
export default [
	serverTest({
		name: "v3-sync-xhr",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/data") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("hello-sync");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><script>
runTest(async () => {
	let out;
	try {
		const x = new XMLHttpRequest();
		x.open("GET", "/data", false);
		x.send();
		out = x.status + ":" + x.responseText;
	} catch (e) { out = "threw:" + e.name; }
	assertConsistent("sync", out);
}, true);
</script>`);
			});
		},
	}),
];
