// rv23: documents served without a Content-Type header (user-sync pixel iframes on
// imgur/giphy ad stacks: syncingbridge.com/userIframe, measureadv.com/userIframe)
import { serverTest } from "../../../testcommon.ts";

const child = `<html><body><img src="IMG"><script>parent.postMessage({host: location.host, sj: typeof $scramjet}, "*")</script></body></html>`;

export default [
	serverTest({
		name: "rv23-noct-iframe",
		start: async (server, port, { pass, fail }) => {
			let direct = 0;
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<script>
						addEventListener("message", (e) => {
							if (e.data.host === location.host) window.pass("iframe document was rewritten");
							else window.fail("iframe served raw: location.host=" + e.data.host + " sj=" + e.data.sj);
						});
					</script><iframe src="/noct"></iframe>`);
				} else if (req.url === "/noct") {
					res.writeHead(200); // no Content-Type, like syncingbridge.com
					res.end(child.replace("IMG", `http://localhost:${port}/pixel.gif`));
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
