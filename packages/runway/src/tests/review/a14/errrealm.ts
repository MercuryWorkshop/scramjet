import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// Where do uncaught exceptions from a child realm's callbacks get reported:
// the child's window 'error' event (as in Chrome), or the realm that hooked it?
const CHILD_JS = String.raw`
window.__errs = [];
addEventListener("error", (e) => { __errs.push("err:" + (e.error && e.error.message)); e.preventDefault(); });
addEventListener("unhandledrejection", (e) => { __errs.push("rej:" + (e.reason && e.reason.message)); e.preventDefault(); });
window.runErr = () => {
  const d = document.createElement("div"); document.body.appendChild(d);
  d.addEventListener("x", () => { throw new Error("listener"); }); d.dispatchEvent(new Event("x"));
  d.onclick = () => { throw new Error("onclick"); }; d.click();
  setTimeout(() => { throw new Error("timeout"); }, 5);
  requestAnimationFrame(() => { throw new Error("raf"); });
  new MutationObserver(() => { throw new Error("mo"); }).observe(d, { attributes: true }); d.setAttribute("a", "1");
  Promise.reject(new Error("promise"));
  addEventListener("message", () => { throw new Error("message"); }); postMessage("m", "*");
  fetch("/nope-" + Math.random()).then(() => { throw new Error("fetchthen"); });
};`;
export const PARENT_JS = String.raw`
window.__perrs = [];
addEventListener("error", (e) => { __perrs.push("err:" + (e.error && e.error.message)); e.preventDefault(); });
addEventListener("unhandledrejection", (e) => { __perrs.push("rej:" + (e.reason && e.reason.message)); e.preventDefault(); });
const out = [];
const kinds = ["blank", "touched", "untouched", "popup"];
for (const k of kinds) {
  window.__perrs.length = 0;
  let w, f;
  if (k === "popup") { w = open("/child.html"); for (let i = 0; i < 100 && !(w.runErr && w.document.readyState === "complete"); i++) await new Promise((r) => setTimeout(r, 50)); }
  else {
    f = document.createElement("iframe");
    if (k === "blank") { document.body.appendChild(f); w = f.contentWindow; const s = w.document.createElement("script"); s.textContent = __CHILD__; w.document.body.appendChild(s); }
    else { f.src = "/child.html"; const l = new Promise((r) => f.onload = r); document.body.appendChild(f); if (k === "touched") void f.contentWindow.document; await l; w = f.contentWindow; }
  }
  w.runErr();
  await new Promise((r) => setTimeout(r, 1500));
  out.push(k + " child=[" + w.__errs.slice().sort().join(",") + "] parent=[" + __perrs.slice().sort().join(",") + "]");
  if (f) f.remove(); else w.close();
}
window.__lines = out; window.__done = true;
`;
export function makeServer() {
	return http.createServer((req, res) => {
		const p = req.url!.split("?")[0];
		if (p === "/s.js") {
			res.writeHead(200, {
				"Content-Type": "text/javascript",
			});
			res.end(
				`(async () => {${PARENT_JS.replace("__CHILD__", JSON.stringify(CHILD_JS))}})();`
			);
			return;
		}
		res.writeHead(p.startsWith("/nope") ? 404 : 200, {
			"Content-Type": "text/html",
		});
		if (p === "/")
			res.end(`<!DOCTYPE html><body><script src="/s.js"></script></body>`);
		else if (p === "/child.html")
			res.end(`<!DOCTYPE html><body>c<script>${CHILD_JS}</script></body>`);
		else res.end("x");
	});
}
export async function collect(evalFn: (s: string) => Promise<any>) {
	for (let i = 0; i < 80; i++) {
		if (await evalFn("!!window.__done").catch(() => false)) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	return await evalFn("JSON.stringify(window.__lines || [])");
}
export default [
	playwrightTest({
		name: "rv14-errrealm",
		fn: async ({ page, navigate }) => {
			const server = makeServer();
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			try {
				await navigate(`http://localhost:${port}/`);
				const fr = () =>
					page
						.frames()
						.find(
							(f: any) =>
								f.url().includes("localhost%3A" + port) &&
								!f.url().includes("child")
						);
				console.log(
					"RV14ERR " + (await collect(async (s) => fr()!.evaluate(s)))
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
