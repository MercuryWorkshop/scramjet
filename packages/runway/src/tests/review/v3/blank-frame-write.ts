import { serverTest } from "../../../testcommon.ts";

// an about:blank frame made by script and written into, reached three ways
export default [
	serverTest({
		name: "v3-blank-frame-write",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/data") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("ok");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><body><script>
runTest(async () => {
	const out = {};
	for (const way of ["contentWindow", "contentDocument", "frames"]) {
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const doc = way === "contentWindow" ? f.contentWindow.document : way === "contentDocument" ? f.contentDocument : frames[frames.length - 1].document;
		doc.open();
		doc.write('<script>window.r = [location.href, parent.location.pathname, document.referrer === parent.location.href, typeof fetch]; fetch("/data").then(r => r.text()).then(t => window.f = t, e => window.f = "err")<\\/script><img src="/data">');
		doc.close();
		await new Promise((r) => setTimeout(r, 300));
		out[way] = [f.contentWindow.r, f.contentWindow.f, f.contentDocument.querySelector("img").src];
	}
	assertConsistent("frames", out);
}, true);
</script></body>`);
			});
		},
	}),
];
