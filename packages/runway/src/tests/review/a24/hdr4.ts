import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
function srv(server) {
	server.on("request", (req, res) => {
		const u = new URL(req.url, "http://x");
		const p = u.pathname;
		if (p === "/sse") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-cache",
				"X-Accel-Buffering": "no",
			});
			let i = 0;
			const t = setInterval(() => {
				res.write(`id: ${i}\ndata: ${Date.now()}\n\n`);
				if (++i === 5) {
					clearInterval(t);
					res.end();
				}
			}, 200);
			req.on("close", () => clearInterval(t));
			return;
		}
		if (p === "/stream") {
			res.writeHead(200, {
				"Content-Type": "text/plain",
			});
			let i = 0;
			const t = setInterval(() => {
				res.write(Date.now() + "\n");
				if (++i === 5) {
					clearInterval(t);
					res.end();
				}
			}, 200);
			req.on("close", () => clearInterval(t));
			return;
		}
	});
}
export default [
	serverTest({
		name: "rv24-sse",
		autoPass: true,
		js: `
			const out = {};
			// EventSource
			const lat = [];
			await new Promise((res) => {
				const es = new EventSource("/sse");
				let n = 0;
				es.onmessage = (e) => { lat.push(Date.now() - Number(e.data)); if (++n === 5) { es.close(); res(); } };
				es.onerror = () => { es.close(); res(); };
				setTimeout(res, 5000);
			});
			out.esCount = lat.length;
			out.esMaxLat = Math.max(...lat);
			// fetch stream
			const r = await fetch("/stream");
			const rd = r.body.getReader(); const td = new TextDecoder(); const fl = [];
			for (;;) { const { value, done } = await rd.read(); if (done) break; for (const l of td.decode(value).split("\\n").filter(Boolean)) fl.push(Date.now() - Number(l)); }
			out.fetchChunks = fl.length; out.fetchMaxLat = Math.max(...fl);
			out.ct = r.headers.get("content-type");
			// XHR progress
			const x = new XMLHttpRequest(); x.open("GET", "/stream"); let prog = 0; const xl = [];
			x.onprogress = () => { const lines = x.responseText.split("\\n").filter(Boolean); xl.push(Date.now() - Number(lines[lines.length-1])); };
			await new Promise(res => { x.onloadend = res; x.send(); });
			out.xhrProgress = xl.length; out.xhrMaxLat = Math.max(...xl);
			assertConsistent("esCount", out.esCount);
			assertConsistent("fetchChunks", out.fetchChunks);
			assertConsistent("ct", out.ct);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			srv(server);
		},
	}),
];
