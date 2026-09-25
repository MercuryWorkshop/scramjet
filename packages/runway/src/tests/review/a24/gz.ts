import { serverTest } from "../../../testcommon.ts";
import zlib from "node:zlib";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-gzip",
		autoPass: true,
		js: `
			const out = {};
			for (const enc of ["gzip", "br", "deflate"]) {
				const r = await fetch("/z?e=" + enc);
				const t = await r.text();
				out[enc] = [r.headers.get("content-encoding"), r.headers.get("content-length"), t.length, r.headers.get("vary"), r.headers.get("transfer-encoding")];
				const x = new XMLHttpRequest(); x.open("GET", "/z?e=" + enc);
				await new Promise(res => { x.onload = res; x.send(); });
				out["xhr-" + enc] = [x.getResponseHeader("content-encoding"), x.getResponseHeader("content-length"), x.responseText.length];
			}
			const r = await fetch("/chunked"); out.chunked = [r.headers.get("transfer-encoding"), r.headers.get("content-length"), (await r.text()).length];
			const h = await fetch("/z?e=gzip", { method: "HEAD" }); out.head = [h.status, h.headers.get("content-length"), h.headers.get("content-encoding")];
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			const body = "hello world ".repeat(500);
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				if (u.pathname === "/z") {
					const e = u.searchParams.get("e");
					const z =
						e === "gzip"
							? zlib.gzipSync(body)
							: e === "br"
								? zlib.brotliCompressSync(body)
								: zlib.deflateSync(body);
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Content-Encoding": e,
						"Content-Length": z.length,
						Vary: "Accept-Encoding",
					});
					res.end(req.method === "HEAD" ? undefined : z);
					return;
				}
				if (u.pathname === "/chunked") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.write("a".repeat(10));
					setTimeout(() => res.end("b".repeat(10)), 50);
					return;
				}
			});
		},
	}),
];
