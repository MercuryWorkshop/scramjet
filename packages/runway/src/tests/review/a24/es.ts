import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-es-origin",
		autoPass: true,
		js: `
			const out = {};
			const other = location.protocol + "//127.0.0.1:" + location.port;
			for (const [k, u, o] of [["same", "/sse", undefined], ["cross", other + "/sse", undefined], ["crossCred", other + "/sse", { withCredentials: true }], ["redir", "/sser", undefined]]) {
				out[k] = await new Promise((res) => {
					const es = new EventSource(u, o);
					const t = setTimeout(() => { es.close(); res("timeout rs=" + es.readyState); }, 4000);
					es.onmessage = (e) => { clearTimeout(t); es.close(); res({ origin: e.origin.replace(location.port, "P"), id: e.lastEventId, data: e.data, url: es.url.replace(location.port, "P"), wc: es.withCredentials, type: e.type, custom: null }); };
					es.onerror = () => { clearTimeout(t); es.close(); res("error rs=" + es.readyState); };
				});
			}
			out.named = await new Promise((res) => {
				const es = new EventSource("/sse?named=1");
				setTimeout(() => { es.close(); res("timeout"); }, 4000);
				es.addEventListener("ping", (e) => { es.close(); res([e.type, e.data, e.origin.replace(location.port, "P")]); });
			});
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				if (u.pathname === "/sser") {
					res.writeHead(302, {
						Location: "/sse",
					});
					res.end();
					return;
				}
				if (u.pathname === "/sse") {
					const h = {
						"Content-Type": "text/event-stream",
					};
					if (req.headers.origin) {
						h["Access-Control-Allow-Origin"] = req.headers.origin;
						h["Access-Control-Allow-Credentials"] = "true";
					}
					res.writeHead(200, h);
					if (u.searchParams.get("named"))
						res.write("event: ping\ndata: p\n\n");
					else res.write("id: 7\ndata: hello\n\n");
					setTimeout(() => res.end(), 1500);
					return;
				}
			});
		},
	}),
];
