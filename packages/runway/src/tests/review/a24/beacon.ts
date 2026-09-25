import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
const seen = {};
export default [
	serverTest({
		name: "rv24-beacon",
		autoPass: true,
		js: `
			const out = {};
			const tok = Math.random().toString(36).slice(2);
			const cases = {
				blob: () => new Blob(["{}"], { type: "text/plain" }),
				str: () => "str",
				usp: () => new URLSearchParams("a=1"),
				none: () => undefined,
				nul: () => null,
				fd: () => { const f = new FormData(); f.append("a", "b"); return f; },
				ab: () => new Uint8Array([1,2,3]),
				json: () => JSON.stringify({ a: 1 }),
			};
			out.ret = {};
			for (const k in cases) { try { out.ret[k] = navigator.sendBeacon("/beacon?t=" + tok + "&k=" + k + "&s=" + Date.now(), cases[k]()); } catch (e) { out.ret[k] = "ERR " + e.message; } }
			out.retUrlObj = navigator.sendBeacon(new URL("/beacon?t=" + tok + "&k=urlobj", location.href), "u");
			await new Promise(r => setTimeout(r, 2500));
			out.seen = await (await fetch("/seen?t=" + tok)).json();
			out.lat = Object.fromEntries(Object.entries(out.seen).map(([k,v]) => [k, v.at])); for (const k in out.seen) delete out.seen[k].at; for (const k in out) if (k !== "lat") assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				const t = u.searchParams.get("t");
				if (u.pathname === "/beacon") {
					let b = "";
					req.on("data", (d) => (b += d));
					req.on("end", () => {
						(seen[t] ||= {})[u.searchParams.get("k")] = {
							ct: req.headers["content-type"] || null,
							len: b.length,
							m: req.method,
							at: Date.now() - Number(u.searchParams.get("s")),
						};
						res.end();
					});
					return;
				}
				if (u.pathname === "/seen") {
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify(seen[t] || {}));
					return;
				}
			});
		},
	}),
];
