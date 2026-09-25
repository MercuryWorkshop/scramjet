import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
let preloads = [];
export default [
	serverTest({
		name: "rv24-dupreal",
		autoPass: true,
		js: `
			const out = {};
			await fetch("/st");
			await new Promise(r => setTimeout(r, 200));
			const e = performance.getEntriesByType("resource").find(e => e.name.includes("/st"));
			out.serverTiming = e ? e.serverTiming.map(s => s.name + ":" + s.duration) : "no entry";
			await fetch("/reset");
			const f = document.createElement("iframe"); f.src = "/linkdoc"; document.body.append(f);
			await new Promise(r => { f.onload = r; setTimeout(r, 4000); });
			await new Promise(r => setTimeout(r, 800));
			out.preloaded = (await (await fetch("/seen")).json()).sort();
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				if (u.pathname === "/st") {
					res.setHeader("Server-Timing", ["db;dur=53", "app;dur=47"]);
					res.setHeader("Timing-Allow-Origin", "*");
					res.end("x");
					return;
				}
				if (u.pathname === "/reset") {
					preloads = [];
					res.end();
					return;
				}
				if (u.pathname.startsWith("/pre")) {
					preloads.push(u.pathname);
					res.setHeader(
						"Content-Type",
						u.pathname.endsWith(".css") ? "text/css" : "text/javascript"
					);
					res.setHeader("Cache-Control", "no-store");
					res.end("");
					return;
				}
				if (u.pathname === "/linkdoc") {
					res.setHeader("Link", [
						"</pre1.css>; rel=preload; as=style",
						"</pre2.js>; rel=preload; as=script",
					]);
					res.setHeader("Content-Type", "text/html");
					res.end("<title>x</title>doc");
					return;
				}
				if (u.pathname === "/seen") {
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify(preloads));
					return;
				}
			});
		},
	}),
];
