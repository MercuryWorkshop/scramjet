import { serverTest } from "../../../testcommon.ts";

// Chrome sends `Content-Length: 0` for a POST with no body; servers that
// require it (webcast.us.tiktok.com check_external_entry) answer 411 otherwise.
export default [
	serverTest({
		name: "rv1-bodyless-post-content-length",
		async start(server, _port, { pass, fail }) {
			const seen: Record<string, string> = {};
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<script>
						(async () => {
							await fetch("/rec?k=fetch", { method: "POST" });
							await fetch("/rec?k=fetchForm", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } });
							await new Promise((r) => { const x = new XMLHttpRequest(); x.open("POST", "/rec?k=xhr"); x.onloadend = r; x.send(); });
							await fetch("/done");
						})();
					</script>`);
				} else if (req.url!.startsWith("/rec")) {
					const k = new URL(req.url!, "http://x").searchParams.get("k")!;
					seen[k] =
						`cl=${req.headers["content-length"]} te=${req.headers["transfer-encoding"]}`;
					res.writeHead(200);
					res.end();
				} else if (req.url === "/done") {
					res.writeHead(200);
					res.end();
					const bad = Object.entries(seen).filter(
						([, v]) => !v.startsWith("cl=0")
					);
					if (bad.length)
						fail(
							"bodyless POST sent without Content-Length: 0: " +
								JSON.stringify(seen)
						);
					else pass(JSON.stringify(seen));
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
