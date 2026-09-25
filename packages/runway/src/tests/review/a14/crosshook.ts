import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// Child frame A (a real page, own bundle) creates an about:blank iframe F in
// its PARENT's document and touches F.contentWindow. F is hooked by A's bundle
// (A's HTMLIFrameElement.prototype.contentWindow interceptor). Then A navigates.
// F is still alive (child of the top page); what still works inside F?
const BATTERY = String.raw`
window.__r = {};
window.runTests = () => {
  const r = window.__r;
  Promise.resolve().then(() => { r.promise = "ok"; });
  try { setTimeout(() => { r.timeout = "ok"; }, 10); } catch (e) { r.timeout = "throw " + e.message; }
  try { const d = document.createElement("div"); d.addEventListener("x", () => { r.listener = "ok"; }); d.dispatchEvent(new Event("x")); } catch (e) { r.listener = "throw " + e.message; }
  try { fetch("/data.txt").then((x) => x.status).then((t) => { r.fetch = "ok " + t; }, (e) => { r.fetch = "reject " + e.message; }); } catch (e) { r.fetch = "throw " + e.message; }
  try { const x = new XMLHttpRequest(); x.open("GET", "/data.txt"); x.onload = () => { r.xhr = "ok " + x.status; }; x.send(); } catch (e) { r.xhr = "throw " + e.message; }
  try { indexedDB.databases().then(() => { r.idb = "ok"; }, (e) => { r.idb = "reject " + e.message; }); } catch (e) { r.idb = "throw " + e.message; }
};`;
export default [
	playwrightTest({
		name: "rv14-crosshook-sibling",
		fn: async ({ page, navigate }) => {
			const server = http.createServer((req, res) => {
				const p = req.url!.split("?")[0];
				if (p === "/data.txt") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("d");
					return;
				}
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				if (p === "/a.html")
					res.end(`<body>a<script>
					const f = document.createElement("iframe"); f.id = "F";
					parent.document.body.appendChild(f);
					const w = f.contentWindow;
					const s = w.document.createElement("script"); s.textContent = ${JSON.stringify(BATTERY)}; w.document.body.appendChild(s);
				</script></body>`);
				else if (p === "/gone.html") res.end("<body>gone</body>");
				else res.end(`<body><iframe id=A src="/a.html"></iframe></body>`);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			try {
				await navigate(`http://localhost:${port}/`);
				await new Promise((r) => setTimeout(r, 1500));
				const top = page
					.frames()
					.find(
						(f: any) =>
							f.url().includes("localhost%3A" + port) &&
							!f.url().includes("a.html")
					);
				const mode = process.env.RV14_CROSS || "navigate";
				if (mode === "navigate")
					await top.evaluate(`document.getElementById("A").src = "/gone.html"`);
				await new Promise((r) => setTimeout(r, 1500));
				await top.evaluate(
					`document.getElementById("F").contentWindow.runTests()`
				);
				await new Promise((r) => setTimeout(r, 2500));
				console.log(
					"RV14CROSS " +
						mode +
						" " +
						(await top.evaluate(
							`JSON.stringify(document.getElementById("F").contentWindow.__r)`
						))
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
