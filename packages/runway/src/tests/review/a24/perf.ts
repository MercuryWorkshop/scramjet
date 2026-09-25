import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-hdrperf",
		autoPass: true,
		js: `
			const out = {};
			const r = await fetch("/h");
			const time = (k, n, fn) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i); out[k] = +((performance.now() - t0) * 1000 / n).toFixed(2) + "us"; };
			time("respHeadersGetter", 10000, () => r.headers);
			const h = r.headers;
			time("get", 10000, () => h.get("x-h-10"));
			time("has", 10000, () => h.has("x-h-10"));
			time("spread", 500, () => [...h]);
			time("forEach", 500, () => h.forEach(() => {}));
			time("fromEntries", 500, () => Object.fromEntries(h));
			time("newHeaders", 500, () => new Headers(h));
			const x = new XMLHttpRequest(); x.open("GET", "/h"); await new Promise(res => { x.onload = res; x.send(); });
			time("xhrGet", 10000, () => x.getResponseHeader("x-h-10"));
			time("xhrAll", 500, () => x.getAllResponseHeaders());
			const t0 = performance.now();
			for (let i = 0; i < 100; i++) { const rr = await fetch("/h"); rr.headers.get("content-type"); await rr.text(); }
			out.fetch100 = +((performance.now() - t0) / 100).toFixed(2) + "ms";
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				if (u.pathname === "/h") {
					for (let i = 0; i < 60; i++)
						res.setHeader("X-H-" + i, "value-" + "v".repeat(40));
					res.setHeader("Content-Type", "text/plain");
					res.end("x");
					return;
				}
			});
		},
	}),
];
