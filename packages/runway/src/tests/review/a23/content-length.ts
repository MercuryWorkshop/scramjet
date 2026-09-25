// rv23: POST bodies reach the origin without Content-Length (Bing/IIS answers 411 Length Required:
// bing.com/web/xlsc.aspx (XHR logging) and bing.com/identity/idtokenv2 (form POST navigation))
import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv23-post-content-length",
		start: async (server, port, { pass, fail }) => {
			const seen: Record<string, string> = {};
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<form id=f method=post action="/form" target=fr><input name=a value=b></form><iframe name=fr></iframe><script>
						(async () => {
							await fetch("/fetch-empty", { method: "POST" });
							await new Promise((r) => { const x = new XMLHttpRequest(); x.open("POST", "/xhr-empty"); x.onloadend = r; x.send(); });
							await fetch("/fetch-string", { method: "POST", body: "hello" });
							await fetch("/fetch-blob", { method: "POST", body: new Blob(["hello"]) });
							await fetch("/fetch-form", { method: "POST", body: new URLSearchParams({ a: "b" }) });
							await new Promise((r) => { const x = new XMLHttpRequest(); x.open("POST", "/xhr-string"); x.onloadend = r; x.send("hello"); });
							await new Promise((r) => { const x = new XMLHttpRequest(); x.open("POST", "/xhr-blob"); x.onloadend = r; x.send(new Blob(["hello"])); });
							document.getElementById("f").submit();
						})();
					</script>`);
				} else if (req.method === "POST") {
					seen[req.url!] =
						`cl=${req.headers["content-length"] ?? "none"} te=${req.headers["transfer-encoding"] ?? "none"}`;
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("ok");
					if (req.url === "/form") {
						const bad = Object.entries(seen).filter(([, v]) =>
							v.startsWith("cl=none")
						);
						if (bad.length) fail("no Content-Length: " + JSON.stringify(seen));
						else pass(JSON.stringify(seen));
					}
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
