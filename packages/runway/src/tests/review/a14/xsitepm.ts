import http from "node:http";
import { serverTest } from "../../../testcommon.ts";

// Cross-site child (another port = another origin), touched before load vs not:
// postMessage both ways, origin checks, storage separation, cookies, location.
export const CHILD = String.raw`<!DOCTYPE html><html><body><script>
window.__got = [];
addEventListener("message", (e) => {
  __got.push(e.origin.replace(/localhost:\d+/, "H" + (e.origin.endsWith(location.port) ? "self" : "other")) + " src=" + (e.source === parent) + " " + e.data);
  if (e.data === "ping") e.source.postMessage("pong", e.origin);
  if (e.data === "probe") parent.postMessage({ probe: window.probe() }, "*");
});
window.probe = () => {
  const r = {};
  const T = (k, f) => { try { r[k] = f(); } catch (e) { r[k] = "throw " + e.name; } };
  T("origin", () => self.origin === location.origin);
  T("ls", () => { localStorage.setItem("xs", "child"); return localStorage.getItem("xs"); });
  T("parentHref", () => { try { return parent.location.href.length > 0 ? "readable" : "empty"; } catch (e) { return "blocked"; } });
  T("frameElement", () => frameElement === null ? "null" : "element");
  T("domain", () => document.domain === location.hostname);
  T("cookie", () => { document.cookie = "xs=child; path=/"; return document.cookie; });
  T("got", () => __got.join("|"));
  return r;
};
</script></body></html>`;
let other: http.Server;
export default [
	serverTest({
		name: "rv14-xsite-pm",
		async start(server) {
			other = http.createServer((req, res) => {
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(CHILD);
			});
			await new Promise<void>((r) => other.listen(0, r));
			const op = (other.address() as any).port;
			server.on("close", () => other.close());
			server.on("request", (req, res) => {
				if (req.url !== "/") {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(`<!DOCTYPE html><html><body><script>
runTest(async () => {
  localStorage.setItem("xs", "parent");
  document.cookie = "xs=parent; path=/";
  const got = [];
  let probeRes;
  addEventListener("message", (e) => { if (e.data && e.data.probe) { probeRes(e.data.probe); return; } got.push(e.origin.replace(/localhost:\\d+/, "H" + (e.origin.endsWith(location.port) ? "self" : "other")) + " " + e.data); });
  for (const kind of ${JSON.stringify((process.env.RV14_XKINDS || "untouched,touched").split(","))}) {
    got.length = 0;
    const f = document.createElement("iframe");
    f.src = "http://localhost:${op}/c?" + kind;
    const l = new Promise((r) => f.onload = r);
    document.body.appendChild(f);
    if (kind === "touched") void f.contentWindow;
    await l;
    const w = f.contentWindow;
    w.postMessage("ping", "http://localhost:${op}");
    w.postMessage("wrong-origin", location.origin);
    await new Promise((r) => setTimeout(r, 400));
    const p = await new Promise((r) => { probeRes = r; w.postMessage("probe", "*"); });
    p.parentGot = got.join("|");
    p.parentLs = localStorage.getItem("xs");
    p.parentCookie = document.cookie;
    for (const k of Object.keys(p)) assertConsistent(kind + "." + k, p[k]);
    f.remove();
  }
}, true);
</script></body></html>`);
			});
		},
	}),
];
