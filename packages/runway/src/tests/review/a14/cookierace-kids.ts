import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// document.cookie = x, then an immediate request, from child realms of each kind.
const CHILD = String.raw`window.ckTest = async (tag) => {
  const has = (s, k) => String(s).split("; ").includes(k);
  const r = {};
  document.cookie = tag + "f=1; path=/";
  r.fetch = has(await (await fetch("/echo?f" + tag)).text(), tag + "f=1");
  document.cookie = tag + "x=1; path=/";
  r.xhr = has(await new Promise((res) => { const q = new XMLHttpRequest(); q.open("GET", "/echo?x" + tag); q.onload = () => res(q.responseText); q.send(); }), tag + "x=1");
  document.cookie = tag + "d=1; path=/";
  await new Promise((res) => { const q = new XMLHttpRequest(); q.open("GET", "/data?" + tag); q.onload = res; q.onerror = res; q.send(); });
  await new Promise((res) => { const q = new XMLHttpRequest(); q.open("GET", "/data?" + tag + "2"); q.onload = res; q.onerror = res; q.send(); });
  r.xhrLater = has(await new Promise((res) => { const q = new XMLHttpRequest(); q.open("GET", "/echo?d" + tag); q.onload = () => res(q.responseText); q.send(); }), tag + "d=1");
  r.docCookie = has(document.cookie, tag + "f=1");
  return r;
};`;
export function makeServer() {
	return http.createServer((req, res) => {
		const p = req.url!.split("?")[0];
		const nost = {
			"cache-control": "no-store",
		};
		if (p === "/echo") {
			res.writeHead(200, {
				"content-type": "text/plain",
				...nost,
			});
			res.end(req.headers.cookie || "(none)");
			return;
		}
		if (p === "/data") {
			res.writeHead(200, {
				"content-type": "text/plain",
				...nost,
			});
			res.end("d");
			return;
		}
		if (p === "/child.html") {
			res.writeHead(200, {
				"content-type": "text/html",
				...nost,
			});
			res.end(
				`<!DOCTYPE html><html><body><script>${CHILD}</script></body></html>`
			);
			return;
		}
		if (p === "/s.js") {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(`(async () => {
  const CHILD = ${JSON.stringify(CHILD)};
  const inject = (w) => { const s = w.document.createElement("script"); s.textContent = CHILD; w.document.body.appendChild(s); };
  eval(CHILD);
  const out = { top: await window.ckTest("t") };
  for (const kind of ["blank", "touched", "untouched", "popupUrl"]) {
    let w, f;
    if (kind === "blank") { f = document.createElement("iframe"); document.body.appendChild(f); w = f.contentWindow; inject(w); }
    else if (kind === "touched" || kind === "untouched") { f = document.createElement("iframe"); f.src = "/child.html"; const l = new Promise((r) => f.onload = r); document.body.appendChild(f); if (kind === "touched") void f.contentWindow; await l; w = f.contentWindow; }
    else { w = open("/child.html"); for (let i = 0; i < 100 && !(w.ckTest && w.document.readyState === "complete"); i++) await new Promise((r) => setTimeout(r, 50)); await new Promise((r) => setTimeout(r, 300)); }
    try { out[kind] = await w.ckTest(kind.slice(0, 3)); } catch (e) { out[kind] = "throw " + e.message; }
    if (f) f.remove(); else w.close();
  }
  window.__lines = [JSON.stringify(out)]; window.__done = true;
})();`);
			return;
		}
		res.writeHead(200, {
			"content-type": "text/html",
		});
		res.end(
			`<!DOCTYPE html><html><body><script src="/s.js"></script></body></html>`
		);
	});
}
export async function collect(evalFn: (s: string) => Promise<any>) {
	for (let i = 0; i < 60; i++) {
		if (await evalFn("!!window.__done").catch(() => false)) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	return await evalFn("JSON.stringify(window.__lines || [])");
}
export default [
	playwrightTest({
		name: "rv14-cookie-race-kids",
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
					"RV14CK " + (await collect(async (s) => fr()!.evaluate(s)))
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
