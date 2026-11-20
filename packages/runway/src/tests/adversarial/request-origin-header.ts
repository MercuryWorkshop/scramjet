import { serverTest } from "../../testcommon.ts";

export default [
	// https://fetch.spec.whatwg.org/#origin-header - a GET that is not CORS
	// carries no Origin. An image is the plainest one there is.
	serverTest({
		name: "request-plain-get-sends-no-origin",
		autoPass: true,
		js: `
			await new Promise((resolve) => {
				const img = new Image();
				img.onload = img.onerror = resolve;
				img.src = "/probe";
			});
			const seen = await (await fetch("/seen")).json();
			assertEqual(seen.origin, null);
		`,
		async start(server) {
			let origin: string | null = null;
			server.on("request", (req, res) => {
				if (req.url === "/probe") {
					origin = req.headers.origin ?? null;
					res.writeHead(204);
					res.end();
				} else if (req.url === "/seen") {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ origin }));
				}
			});
		},
	}),
];
