import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv3-refresh-header",
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url!.startsWith("/next")) {
					res.writeHead(200, {
						"content-type": "text/html",
					});
					res.end(
						`<!doctype html><script>runTest(async () => { assertConsistent("landed", location.pathname); }, true);</script>`
					);
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
					refresh: "0; url=/next",
				});
				res.end(`<!doctype html><p>refreshing</p>`);
			});
		},
	}),
];
