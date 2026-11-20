import { serverTest } from "../../testcommon.ts";

export default [
	// A frame's document.referrer is its creator's URL when the navigation
	// began - including a URL the creator only ever reached by replaceState,
	// which no request records.
	serverTest({
		name: "document-referrer-keeps-replacestate-url",
		autoPass: true,
		js: `
			history.replaceState(null, "", "/?token=runway");
			const iframe = document.createElement("iframe");
			iframe.src = "/child";
			const loaded = new Promise((resolve) => (iframe.onload = resolve));
			document.body.append(iframe);
			history.replaceState(null, "", "/");
			await loaded;
			assertEqual(iframe.contentDocument.referrer, location.origin + "/?token=runway");
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/child") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end("<!DOCTYPE html><p>child</p>");
				}
			});
		},
	}),
];
