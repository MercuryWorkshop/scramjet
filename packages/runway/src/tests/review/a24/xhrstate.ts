import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-xhrstates",
		autoPass: true,
		js: `
			const out = { rs: [] };
			const x = new XMLHttpRequest(); x.open("GET", "/slow");
			out.beforeSend = [x.getAllResponseHeaders(), x.getResponseHeader("x-a")];
			x.onreadystatechange = () => out.rs.push([x.readyState, x.getResponseHeader("x-a"), x.getAllResponseHeaders().split("\\r\\n").filter(l => /^x-/.test(l)).join("|")]);
			await new Promise(res => { x.onloadend = res; x.send(); });
			const y = new XMLHttpRequest(); y.open("GET", "/slow");
			await new Promise(res => { y.onreadystatechange = () => { if (y.readyState === 3) { y.abort(); res(); } }; y.send(); });
			out.afterAbort = [y.readyState, y.getAllResponseHeaders(), y.getResponseHeader("x-a"), y.status];
			const z = new XMLHttpRequest(); z.open("GET", "/404"); await new Promise(res => { z.onloadend = res; z.send(); });
			out.err404 = [z.status, z.getResponseHeader("x-a"), z.statusText];
			const w = new XMLHttpRequest(); w.open("GET", "/slow"); w.responseType = "json"; w.overrideMimeType("application/json");
			await new Promise(res => { w.onloadend = res; w.send(); });
			out.override = [w.getResponseHeader("content-type")];
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/slow") {
					res.writeHead(200, {
						"X-A": "1",
						"X-B": "2",
						"Content-Type": "text/plain",
					});
					res.write("a");
					setTimeout(() => res.end("b"), 300);
					return;
				}
				if (req.url === "/404") {
					res.writeHead(404, {
						"X-A": "nf",
						"Content-Type": "text/plain",
					});
					res.end("nf");
					return;
				}
			});
		},
	}),
];
