import { serverTest } from "../../../testcommon.ts";

// two same-origin iframes run the same external script, which posts to the
// parent. event.source has to name the frame that posted
export default [
	serverTest({
		name: "v3-pst-shared-script-source",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/lib.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
						"Cache-Control": "max-age=3600",
					});
					res.end(
						`window.addEventListener("message", (e) => { if (e.data === "go") parent.postMessage(location.hash, "*"); });`
					);
					return;
				}
				if (req.url!.startsWith("/child")) {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!doctype html><script src="/lib.js"></script>`);
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><iframe id=a src="/child#a"></iframe><iframe id=b src="/child#b"></iframe><iframe id=c src="/child#c"></iframe>
<script>
runTest(async () => {
	await new Promise((r) => window.addEventListener("load", r));
	const got = [];
	window.addEventListener("message", (e) => {
		const which = [a, b, c].findIndex((f) => f.contentWindow === e.source);
		got.push(e.data + "->" + (which === -1 ? "?" : "abc"[which]));
	});
	for (const f of [a, b, c]) {
		f.contentWindow.postMessage("go", "*");
		await new Promise((r) => setTimeout(r, 100));
	}
	assertConsistent("sources", got.join(","));
}, true);
</script>`);
			});
		},
	}),
];
