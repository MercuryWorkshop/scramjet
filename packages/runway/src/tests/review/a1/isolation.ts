import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv1-storage-scope-spoof-url-origin",
		scramjetOnly: true,
		async start(server, port, { pass, fail }) {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!DOCTYPE html><html><body><script>
						addEventListener("message", (e) => {
							if (e.data !== "written") return;
							// scramjet keys storage on client.url.origin, read through the
							// page-writable URL.prototype.origin getter
							const d = Object.getOwnPropertyDescriptor(URL.prototype, "origin");
							Object.defineProperty(URL.prototype, "origin", { get() { return "http://127.0.0.1:${port}"; }, configurable: true });
							let stolen;
							try { stolen = localStorage.getItem("secret"); } finally { Object.defineProperty(URL.prototype, "origin", d); }
							fetch("/result?stolen=" + encodeURIComponent(String(stolen)));
						});
						const f = document.createElement("iframe");
						f.src = "http://127.0.0.1:${port}/sub";
						document.body.appendChild(f);
					</script></body></html>`);
				} else if (req.url === "/sub") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<script>localStorage.setItem("secret", "from-127"); parent.postMessage("written", "*");</script>`
					);
				} else if (req.url!.startsWith("/result")) {
					const stolen = new URL(req.url!, "http://x").searchParams.get(
						"stolen"
					);
					res.writeHead(204);
					res.end();
					if (stolen === "from-127")
						fail(
							"read another origin's localStorage by spoofing URL.prototype.origin"
						);
					else pass();
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
