import { serverTest } from "../../../testcommon.ts";

// every kind of realm the client installs into, for `pnpm inspect` to watch the
// console for "failed to install scramjet module"
export default [
	serverTest({
		name: "v3-module-install-contexts",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/w.js") {
					res.writeHead(200, { "Content-Type": "text/javascript" });
					res.end(
						`if (self.postMessage) postMessage("w:" + typeof fetch); self.onconnect = (e) => e.ports[0].postMessage("sw");`
					);
					return;
				}
				if (req.url === "/child") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!doctype html><p>child</p>`);
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html>
<iframe src="/child"></iframe><iframe srcdoc="<p>s</p>"></iframe><iframe></iframe>
<script>
runTest(async () => {
	await new Promise((r) => window.addEventListener("load", r));
	const got = [];
	const w = new Worker("/w.js");
	got.push(await new Promise((r) => (w.onmessage = (e) => r(e.data))));
	const m = new Worker("/w.js", { type: "module" });
	got.push(await new Promise((r) => (m.onmessage = (e) => r(e.data))));
	const s = new SharedWorker("/w.js");
	got.push(await new Promise((r) => { s.port.onmessage = (e) => r(e.data); s.port.start(); }));
	const b = new Worker(URL.createObjectURL(new Blob(["postMessage('b')"], { type: "text/javascript" })));
	got.push(await new Promise((r) => (b.onmessage = (e) => r(e.data))));
	assertConsistent("workers", got.join(","));
}, true);
</script>`);
			});
		},
	}),
];
