import { serverTest } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";

// WebSocket from child realms of each kind: does it connect, and what Origin /
// Cookie does the server see? (hooked children use their own transport, built
// by hookSubcontext in the parent's realm)
const CHILD = String.raw`window.wsTest = (host) => new Promise((res) => {
  let ws; const t = setTimeout(() => res("timeout"), 4000);
  try { ws = new WebSocket("ws://" + host + "/sock"); } catch (e) { clearTimeout(t); return res("throw " + e.message); }
  ws.onmessage = (e) => { clearTimeout(t); res(String(e.data).replace(/localhost:\d+/g, "H") + " url=" + ws.url.replace(/localhost:\d+/g, "H")); ws.close(); };
  ws.onerror = () => { clearTimeout(t); res("error"); };
});`;
export default [
	serverTest({
		name: "rv14-child-ws",
		async start(server) {
			const wss = new WebSocketServer({
				server,
				path: "/sock",
			});
			wss.on("connection", (s, req) =>
				s.send(
					JSON.stringify({
						origin: req.headers.origin,
						cookie: req.headers.cookie || "",
					})
				)
			);
			server.on("request", (req, res) => {
				const p = req.url!.split("?")[0];
				if (p === "/child.html") {
					res.writeHead(200, {
						"content-type": "text/html",
					});
					res.end(
						`<!DOCTYPE html><html><body><script>${CHILD}</script></body></html>`
					);
					return;
				}
				if (p !== "/") {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(`<!DOCTYPE html><html><body><script>
runTest(async () => {
  document.cookie = "wsck=1; path=/";
  const ws = new WebSocket("ws://" + location.host + "/sock");
  const topRes = await new Promise((r) => { ws.onmessage = (e) => r(String(e.data).replace(/localhost:\\d+/g, "H")); ws.onerror = () => r("error"); });
  assertConsistent("top", topRes);
  const CHILD = ${JSON.stringify(CHILD)};
  const inject = (w) => { const s = w.document.createElement("script"); s.textContent = CHILD; w.document.body.appendChild(s); };
  for (const kind of ${JSON.stringify((process.env.RV14_WSKINDS || "blank,write,untouched,popupBlank").split(","))}) {
    let w, f;
    if (kind === "blank") { f = document.createElement("iframe"); document.body.appendChild(f); w = f.contentWindow; inject(w); }
    else if (kind === "write") { f = document.createElement("iframe"); document.body.appendChild(f); w = f.contentWindow; const d = w.document; d.open(); d.write("<!DOCTYPE html><html><body><script>" + CHILD + "<\\/script></body></html>"); d.close(); }
    else if (kind === "touched" || kind === "untouched") { f = document.createElement("iframe"); f.src = "/child.html"; const l = new Promise((r) => f.onload = r); document.body.appendChild(f); if (kind === "touched") void f.contentWindow; await l; w = f.contentWindow; }
    else if (kind === "popupBlank") { w = open(""); inject(w); }
    else if (kind === "popupUrl") { w = open("/child.html"); for (let i = 0; i < 100 && !(w.wsTest && w.document.readyState === "complete"); i++) await new Promise((r) => setTimeout(r, 50)); }
    let v; try { v = await w.wsTest(location.host); } catch (e) { v = "throw " + e.message; }
    assertConsistent(kind, v);
    if (f) f.remove(); else w.close();
  }
}, true);
</script></body></html>`);
			});
		},
	}),
];
