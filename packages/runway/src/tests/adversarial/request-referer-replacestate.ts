import { serverTest } from "../../testcommon.ts";

export default [
	// A request's referrer is fixed when the request is made. The document's
	// URL changing straight afterwards - replaceState, with no request of its
	// own - must not reach back into it.
	serverTest({
		name: "request-referer-fixed-before-replacestate",
		autoPass: true,
		js: `
			history.replaceState(null, "", "/?token=runway");
			const sent = fetch("/probe");
			history.replaceState(null, "", "/");
			await sent;
			const seen = await (await fetch("/seen")).json();
			assertEqual(seen.referer, location.origin + "/?token=runway");
		`,
		async start(server) {
			let referer: string | null = null;
			server.on("request", (req, res) => {
				if (req.url === "/probe") {
					referer = req.headers.referer ?? null;
					res.writeHead(204);
					res.end();
				} else if (req.url === "/seen") {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ referer }));
				}
			});
		},
	}),
];
