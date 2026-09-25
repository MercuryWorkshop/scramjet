import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
function big(res, n, size) {
	for (let i = 0; i < n; i++) res.setHeader("X-Big-" + i, "v".repeat(size));
}
export default [
	serverTest({
		name: "rv24-bighdr",
		autoPass: true,
		js: `
			const out = {};
			for (const [n, s] of [[10, 4000], [40, 4000], [60, 4000], [1, 90000], [1, 200000]]) {
				const k = n + "x" + s;
				try {
					const t0 = performance.now();
					const r = await fetch("/big?n=" + n + "&s=" + s);
					out[k] = [r.status, [...r.headers.keys()].filter(x => x.startsWith("x-big")).length, (await r.text()).length];
				} catch (e) { out[k] = "ERR " + e.message; }
			}
			// navigation of a big-header document in an iframe
			for (const [n, s] of [[40, 4000], [60, 4000]]) {
				const f = document.createElement("iframe"); f.src = "/bigdoc?n=" + n + "&s=" + s; document.body.append(f);
				await new Promise(r => { f.onload = r; setTimeout(r, 5000); });
				try { out["doc" + n] = f.contentDocument && f.contentDocument.title; } catch (e) { out["doc" + n] = "ERR " + e.message; }
			}
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				const n = +u.searchParams.get("n"),
					s = +u.searchParams.get("s");
				if (u.pathname === "/big") {
					big(res, n, s);
					res.setHeader("Content-Type", "text/plain");
					res.end("ok");
					return;
				}
				if (u.pathname === "/bigdoc") {
					big(res, n, s);
					res.setHeader("Content-Type", "text/html");
					res.end("<title>loaded</title>ok");
					return;
				}
			});
		},
	}),
];
