import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-originprefixed",
		autoPass: true,
		js: `
			const out = {};
			const r = await fetch("/h");
			out.keys = [...r.headers].filter(([k]) => !/date|keep|conn/.test(k));
			out.ct = r.headers.get("content-type");
			const x = new XMLHttpRequest(); x.open("GET", "/h"); await new Promise(res => { x.onload = res; x.send(); });
			out.xhrAll = x.getAllResponseHeaders().split("\\r\\n").filter(l => !/^(date|keep|conn)/.test(l));
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/h") {
					res.setHeader("X-Scramjet-Content-Type", "text/html");
					res.setHeader("X-Scramjet-Trace", "abc");
					res.setHeader("Content-Type", "text/plain");
					res.end("x");
					return;
				}
			});
		},
	}),
];
