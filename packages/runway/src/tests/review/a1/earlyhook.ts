import { serverTest } from "../../../testcommon.ts";

// A parent that touches iframe.contentWindow while the child document is
// still loading hooks the child realm from outside (hookSubcontext). On
// develop core's chrome.ts now deletes Navigator.prototype.serviceWorker in
// *that* realm (main deleted it in the bundle's own realm), so when the child
// document's own controller.inject.js evaluates, its top-level
// `navigator.serviceWorker.controller` throws, `$scramjetController` is never
// defined, and the injected `$scramjetController.load(...)` throws too -
// two uncaught errors in the child, and `syncDocumentInit` (the child's own
// cookies / initHeaders / history) never runs.
const filler = "<p>filler</p>".repeat(20000);

export default [
	serverTest({
		name: "rv1-early-contentwindow-hook-breaks-child-inject",
		scramjetOnly: true,
		async start(server, port, { pass, fail }) {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!DOCTYPE html><html><body><script>
						const f = document.createElement("iframe");
						f.src = "/child";
						document.body.appendChild(f);
						const iv = setInterval(() => { try { f.contentWindow.document; } catch {} }, 0);
						setTimeout(() => clearInterval(iv), 4000);
						addEventListener("message", (e) => {
							if (e.data && e.data.childReport) fetch("/result?" + new URLSearchParams(e.data.childReport));
						});
					</script></body></html>`);
				} else if (req.url === "/child") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Set-Cookie": "childcookie=1; Path=/",
					});
					res.end(`<!DOCTYPE html><html><head><script>
						window.__errors = [];
						addEventListener("error", (e) => __errors.push(e.message));
					</script></head><body>${filler}<script>
						parent.postMessage({ childReport: {
							errors: __errors.join(" || "),
							cookie: document.cookie,
						} }, "*");
					</script></body></html>`);
				} else if (req.url!.startsWith("/result")) {
					const q = new URL(req.url!, "http://x").searchParams;
					res.writeHead(204);
					res.end();
					const errors = q.get("errors");
					if (errors)
						fail(
							"child realm saw uncaught errors: " +
								errors +
								" (cookie=" +
								q.get("cookie") +
								")"
						);
					else if (!q.get("cookie")!.includes("childcookie=1"))
						fail(
							"child's own Set-Cookie missing from document.cookie: " +
								q.get("cookie")
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
