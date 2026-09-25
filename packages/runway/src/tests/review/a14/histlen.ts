import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// history.length after repeated iframe.src changes, touched vs untouched
export const PARENT = String.raw`
const load = (f) => new Promise((res) => f.addEventListener("load", () => res(), { once: true }));
const log = [];
const variants = ["untouched", "touched", "touchedAfter", "blankThenSrc", "srcAttr"];
for (const v of variants) {
  const f = document.createElement("iframe");
  const base = history.length;
  let l;
  if (v === "blankThenSrc") { document.body.appendChild(f); void f.contentWindow; l = load(f); f.src = "/c.html?1"; await l; }
  else if (v === "srcAttr") { f.setAttribute("src", "/c.html?1"); l = load(f); document.body.appendChild(f); await l; }
  else { f.src = "/c.html?1"; l = load(f); document.body.appendChild(f); if (v === "touched") void f.contentWindow.document; await l; }
  const a = history.length - base;
  if (v === "touchedAfter") void f.contentWindow.document;
  l = load(f); f.src = "/c.html?2"; await l;
  const b = history.length - base;
  l = load(f); f.src = "/c.html?3"; await l;
  const c = history.length - base;
  l = load(f); f.contentWindow.location.href = "/c.html?4"; await l;
  const d = history.length - base;
  l = load(f); f.contentWindow.location.replace("/c.html?5"); await l;
  const e = history.length - base;
  log.push(v + ":" + [a, b, c, d, e].join(","));
  f.remove();
  await new Promise((r) => setTimeout(r, 50));
}
window.__lines = log; window.__done = true;
`;
export function makeServer() {
	return http.createServer((req, res) => {
		const p = req.url!.split("?")[0];
		res.writeHead(200, {
			"Content-Type": p === "/s.js" ? "text/javascript" : "text/html",
		});
		if (p === "/")
			res.end(`<!DOCTYPE html><body><script src="/s.js"></script></body>`);
		else if (p === "/s.js") res.end(`(async () => {${PARENT}})();`);
		else res.end(`<!DOCTYPE html><body>c</body>`);
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
		name: "rv14-histlen",
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
								!f.url().includes("c.html")
						);
				console.log(
					"RV14HIST " + (await collect(async (s) => fr()!.evaluate(s)))
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
