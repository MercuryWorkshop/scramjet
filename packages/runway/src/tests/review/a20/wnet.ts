import { serverTest } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";

// rv20: network APIs inside a dedicated worker (besides WebSocket, known)

const WORKER = String.raw`
const guard = async (f, ms = 4000) => { try { return await Promise.race([f(), new Promise((r) => setTimeout(() => r("timeout"), ms))]); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 160); } };
onmessage = async () => {
	const out = {};
	out.wss = await guard(async () => {
		if (!("WebSocketStream" in self)) return "absent";
		const s = new WebSocketStream("ws://" + location.host + "/");
		const { readable, writable } = await s.opened;
		const w = writable.getWriter(); await w.write("hey");
		const { value } = await readable.getReader().read();
		s.close();
		return [value, s.url];
	});
	out.es = await guard(() => new Promise((res) => { const es = new EventSource("sse"); es.onmessage = (e) => { res([e.data, es.url, e.origin]); es.close(); }; es.onerror = () => { res("es error"); es.close(); }; }));
	out.esAbs = await guard(() => new Promise((res) => { const es = new EventSource(location.origin + "/w/sse", { withCredentials: true }); es.onmessage = (e) => { res([e.data, es.withCredentials]); es.close(); }; es.onerror = () => { res("es error"); es.close(); }; }));
	out.xhrUpload = await guard(() => new Promise((res) => { const x = new XMLHttpRequest(); let prog = 0; x.upload.onprogress = () => prog++; x.open("POST", "echo"); x.onload = () => res([x.status, x.responseText, x.getResponseHeader("x-echo-len"), x.responseURL.replace(/:\d+/, ":P")]); x.send("abcdef"); }));
	out.fetchStream = await guard(async () => { const r = await fetch("echo", { method: "POST", body: new Blob(["xyz"]) }); return [r.status, await r.text(), r.headers.get("x-echo-len"), r.redirected, r.type]; });
	out.fetchRedirect = await guard(async () => { const r = await fetch("redir"); return [r.status, r.url.replace(/:\d+/, ":P"), r.redirected, await r.text()]; });
	out.fetchCookie = await guard(async () => { await fetch("setcookie"); const r = await fetch("readcookie"); return await r.text(); });
	out.xhrCookie = await guard(() => new Promise((res) => { const x = new XMLHttpRequest(); x.open("GET", "readcookie"); x.onload = () => res(x.responseText); x.send(); }));
	out.fetchNoCors = await guard(async () => { const r = await fetch("https://example.com/", { mode: "no-cors" }); return [r.type, r.status]; });
	out.fetchAbort = await guard(async () => { const ac = new AbortController(); const p = fetch("slow", { signal: ac.signal }); ac.abort(); try { await p; return "no abort"; } catch (e) { return e.name; } });
	out.reqReferrer = await guard(async () => { const r = await fetch("referrer"); return (await r.text()).replace(/:\d+/, ":P"); });
	postMessage(out);
};`;

export default [
	Object.assign(
		serverTest({
			name: "rv20-wnet",
			autoPass: true,
			js: String.raw`
			document.cookie = "pagec=1; path=/";
			const w = new Worker("/w/net.js");
			const r = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error " + e.message); w.postMessage(1); setTimeout(() => res("timeout"), 40000); });
			for (const k of Object.keys(r)) assertConsistent("wnet." + k, r[k]);
			console.log("RV20DUMP wnet " + JSON.stringify(r));
			`,
			start: async (server) => {
				const wss = new WebSocketServer({
					server,
				});
				wss.on("connection", (s) =>
					s.on("message", (m, bin) =>
						s.send(m, {
							binary: bin,
						})
					)
				);
				server.on("request", (req: any, res: any) => {
					if (res.headersSent) return;
					const p = (req.url || "/").split("?")[0];
					if (p === "/" || p === "/script.js") return;
					if (p === "/w/net.js") {
						res.writeHead(200, {
							"Content-Type": "text/javascript",
						});
						res.end(WORKER);
						return;
					}
					if (p === "/w/sse") {
						res.writeHead(200, {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-store",
						});
						res.write("data: tick\n\n");
						setTimeout(() => res.end(), 2000);
						return;
					}
					if (p === "/w/echo") {
						let n = 0;
						req.on("data", (c: Buffer) => (n += c.length));
						req.on("end", () => {
							res.writeHead(200, {
								"Content-Type": "text/plain",
								"x-echo-len": String(n),
								"Access-Control-Expose-Headers": "x-echo-len",
							});
							res.end(req.method);
						});
						return;
					}
					if (p === "/w/redir") {
						res.writeHead(302, {
							Location: "/w/target",
						});
						res.end();
						return;
					}
					if (p === "/w/target") {
						res.writeHead(200, {
							"Content-Type": "text/plain",
						});
						res.end("target");
						return;
					}
					if (p === "/w/setcookie") {
						res.writeHead(200, {
							"Set-Cookie": "wc=2; Path=/",
							"Content-Type": "text/plain",
						});
						res.end("ok");
						return;
					}
					if (p === "/w/readcookie") {
						res.writeHead(200, {
							"Content-Type": "text/plain",
						});
						res.end((req.headers.cookie || "").split("; ").sort().join("; "));
						return;
					}
					if (p === "/w/referrer") {
						res.writeHead(200, {
							"Content-Type": "text/plain",
						});
						res.end(String(req.headers.referer));
						return;
					}
					if (p === "/w/slow") {
						setTimeout(() => {
							res.writeHead(200);
							res.end("slow");
						}, 3000);
						return;
					}
					res.writeHead(404);
					res.end();
				});
			},
		}),
		{
			timeoutMs: 60000,
		}
	),
];
