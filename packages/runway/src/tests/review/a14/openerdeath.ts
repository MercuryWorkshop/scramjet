import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// A window.open popup is hooked by the opener's client code (openWindowSteps ->
// hookSubcontext), so every interceptor in the popup is a function from the
// opener's realm. What still works in the popup once the opener navigates away?
const POPUP = `<!DOCTYPE html><body><div id=d></div><a id=a href="/rel">x</a><script>
window.__r = {};
window.runTests = () => {
  const r = window.__r;
  r.started = true;
  Promise.resolve().then(() => { r.promise = "ok"; });
  try { setTimeout(() => { r.timeout = "ok"; }, 10); } catch (e) { r.timeout = "throw " + e.message; }
  try { requestAnimationFrame(() => { r.raf = "ok"; }); } catch (e) { r.raf = "throw " + e.message; }
  try { const d = document.getElementById("d"); d.addEventListener("x", () => { r.listener = "ok"; }); d.dispatchEvent(new Event("x")); } catch (e) { r.listener = "throw " + e.message; }
  try { const d = document.getElementById("d"); d.onclick = () => { r.onclick = "ok"; }; d.click(); } catch (e) { r.onclick = "throw " + e.message; }
  try { addEventListener("message", (e) => { r.message = "ok " + e.data; }); postMessage("hi", "*"); } catch (e) { r.message = "throw " + e.message; }
  try { new MutationObserver(() => { r.mo = "ok"; }).observe(document.body, { childList: true }); document.body.append("t"); } catch (e) { r.mo = "throw " + e.message; }
  try { fetch("/data.txt").then((x) => x.text()).then((t) => { r.fetch = "ok " + t; }, (e) => { r.fetch = "reject " + e.message; }); } catch (e) { r.fetch = "throw " + e.message; }
  try { const x = new XMLHttpRequest(); x.open("GET", "/data.txt"); x.onload = () => { r.xhr = "ok " + x.status + " " + x.responseText; }; x.onerror = () => { r.xhr = "error"; }; x.send(); } catch (e) { r.xhr = "throw " + e.message; }
  try { localStorage.setItem("k", "v"); r.ls = localStorage.getItem("k"); } catch (e) { r.ls = "throw " + e.message; }
  try { document.cookie = "c=1"; r.cookie = document.cookie; } catch (e) { r.cookie = "throw " + e.message; }
  try { r.href = location.href; r.ahref = document.getElementById("a").href; } catch (e) { r.href = "throw " + e.message; }
  try { const i = document.createElement("img"); i.onload = () => { r.img = "ok"; }; i.onerror = () => { r.img = "error"; }; i.src = "/img.gif"; document.body.append(i); } catch (e) { r.img = "throw " + e.message; }
  try { caches.open("c").then(() => { r.caches = "ok"; }, (e) => { r.caches = "reject " + e.message; }); } catch (e) { r.caches = "throw " + e.message; }
  try { import("/mod.js").then((m) => { r.import = "ok " + m.v; }, (e) => { r.import = "reject " + e.message; }); } catch (e) { r.import = "throw " + e.message; }
  const P = (k, f) => { try { Promise.resolve(f()).then((v) => { r[k] = "ok " + (typeof v === "object" ? typeof v : v); }, (e) => { r[k] = "reject " + e.message; }); } catch (e) { r[k] = "throw " + e.message; } };
  P("fetchReq", () => fetch(new Request("/data.txt")).then((x) => x.text()));
  P("cssReplace", () => new CSSStyleSheet().replace("a{color:red}").then(() => 1));
  P("cookieStoreGet", () => cookieStore.get("c").then((c) => c && c.value));
  P("idbDatabases", () => indexedDB.databases().then((d) => d.length));
  P("cachesMatch", () => caches.match("/nothing").then((x) => String(x)));
  P("opfs", () => navigator.storage.getDirectory().then((d) => d.kind));
  P("responseText", () => new Response("x").text());
  P("blobText", () => new Blob(["b"]).text());
  try { document.cookie = "late=1; path=/"; const x2 = new XMLHttpRequest(); x2.open("GET", "/echo"); x2.onload = () => { r.lateCookieSent = x2.responseText; }; x2.send(); } catch (e) { r.lateCookieSent = "throw " + e.message; }
  try { const ws = new WebSocket("ws://" + location.host + "/sock"); ws.onopen = () => { r.ws = "open"; ws.close(); }; ws.onerror = () => { r.ws = "error"; }; } catch (e) { r.ws = "throw " + e.message; }
  try { const w = new Worker("/w.js"); w.onmessage = (e) => { r.worker = "ok " + e.data; }; w.onerror = () => { r.worker = "error"; }; } catch (e) { r.worker = "throw " + e.message; }
};
</script></body>`;

function mk(opener: "navigate" | "stay" | "close-iframe") {
	return playwrightTest({
		name: "rv14-openerdeath-" + opener,
		fn: async ({ page, frame, navigate }) => {
			const GIF = Buffer.from(
				"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
				"base64"
			);
			const server = http.createServer((req, res) => {
				const p = req.url!.split("?")[0];
				if (p === "/popup.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(POPUP);
				} else if (p === "/data.txt") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("data");
				} else if (p === "/img.gif") {
					res.writeHead(200, {
						"Content-Type": "image/gif",
					});
					res.end(GIF);
				} else if (p === "/mod.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end("export const v = 1;");
				} else if (p === "/w.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end("postMessage('w');");
				} else if (p === "/echo") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end(req.headers.cookie || "");
				} else if (p === "/gone.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end("<body>gone</body>");
				} else if (p === "/opener-frame.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<body><button id=b>open</button><script>document.getElementById("b").onclick = () => { window.__w = window.open("/popup.html", "_blank"); };</script></body>`
					);
				} else {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					if (opener === "close-iframe") {
						res.end(
							`<body><iframe id=f src="/opener-frame.html"></iframe><script>window.killFrame = () => document.getElementById("f").remove();</script></body>`
						);
					} else {
						res.end(
							`<body><button id=b>open</button><script>document.getElementById("b").onclick = () => { window.__w = window.open("/popup.html", "_blank"); };</script></body>`
						);
					}
				}
			});
			if (process.env.RV14_WS) {
				const { WebSocketServer } = await import("ws");
				new WebSocketServer({
					server,
					path: "/sock",
				});
			}
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			page.on("pageerror", (e: Error) => errs.push("opener: " + e.message));
			try {
				await navigate(`http://localhost:${port}/`);
				await new Promise((r) => setTimeout(r, 1000));
				const popupP = page.context().waitForEvent("page");
				if (opener === "close-iframe") {
					const inner = frame.frameLocator("#f");
					await inner.locator("#b").click();
				} else {
					await frame.locator("#b").click();
				}
				const popup = await popupP;
				popup.on("pageerror", (e: Error) => errs.push("popup: " + e.message));
				await popup.waitForLoadState("load");
				await new Promise((r) => setTimeout(r, 1000));
				const outer = page
					.frames()
					.find(
						(f: any) =>
							f.url().includes("localhost%3A" + port) &&
							!f.url().includes("opener-frame")
					);
				if (opener === "navigate")
					await outer.evaluate(`location.href = "/gone.html"`);
				if (opener === "close-iframe") await outer.evaluate(`killFrame()`);
				await new Promise((r) => setTimeout(r, 1500));
				await popup.evaluate("window.runTests()");
				await new Promise((r) => setTimeout(r, 3000));
				const r = await popup.evaluate("JSON.stringify(window.__r)");
				console.log(
					"RV14-OPENERDEATH " +
						opener +
						" " +
						r +
						"\nERRS " +
						JSON.stringify(errs.slice(0, 8))
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	});
}

export default [mk("stay"), mk("navigate"), mk("close-iframe")];
