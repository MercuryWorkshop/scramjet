import { serverTest } from "../../../testcommon.ts";

// rv20: unusual worker script URLs: what the server sees, what the worker sees

export default [
	serverTest({
		name: "rv20-worker-urls",
		autoPass: true,
		js: String.raw`
		const urls = ["/w/my worker.js", "/w/%E2%9C%93.js", "/w/✓b.js", "/w/a%2Fb.js", "/w/q.js?a=1&b=%20c&d=%26", "/w/q.js?$top=mine&$dest=x", "/w/q.js?x#frag", "/w/../w/dots.js", "//" + location.host + "/w/proto.js"];
		const out = {};
		for (const u of urls) {
			out[u] = await new Promise((res) => { const w = new Worker(u); w.onmessage = (e) => { res(e.data); w.terminate(); }; w.onerror = () => res("error"); setTimeout(() => res("timeout"), 4000); });
		}
		for (const k of Object.keys(out)) assertConsistent("u." + k, out[k]);
		console.log("RV20DUMP wurls " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (p.startsWith("/w/")) {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(
						`postMessage({ server: ${JSON.stringify(req.url)}, href: location.href, search: location.search, path: location.pathname });`
					);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];
