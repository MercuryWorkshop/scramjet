import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// <object data=icon.svg> / <embed src=icon.svg> / <iframe src=icon.svg>: the
// classic "style an external SVG through contentDocument" pattern. The SVG
// document gets no client of its own, so the parent hooks it on first access.
export const PARENT_JS = String.raw`
const out = {};
const T = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = "throw " + e.name + ": " + e.message; } };
const mk = (tag) => new Promise((res) => {
  const el = document.createElement(tag);
  if (tag === "embed" || tag === "iframe") el.src = "/icon.svg"; else el.data = "/icon.svg";
  el.type = "image/svg+xml";
  el.onload = () => res(el);
  document.body.appendChild(el);
  setTimeout(() => res(el), 3000);
});
for (const tag of ["object", "embed", "iframe"]) {
  const el = await mk(tag);
  T(tag + ".doc", () => { const d = tag === "embed" ? el.getSVGDocument() : el.contentDocument; return d ? d.constructor.name + " " + d.documentElement.nodeName : String(d); });
  T(tag + ".svgdoc", () => { const d = el.getSVGDocument(); return d ? d.documentElement.nodeName : String(d); });
  T(tag + ".circle", () => { const d = el.getSVGDocument(); const c = d.querySelector("circle"); c.setAttribute("fill", "blue"); c.style.stroke = "red"; return c.getAttribute("fill") + " " + c.getAttribute("style"); });
  T(tag + ".use", () => { const d = el.getSVGDocument(); const u = d.querySelector("use"); return u && (u.getAttribute("href") + " " + u.href.baseVal); });
  T(tag + ".image", () => { const d = el.getSVGDocument(); const i = d.querySelector("image"); return i && (i.getAttribute("href") + " " + i.href.baseVal); });
  T(tag + ".setImage", () => { const d = el.getSVGDocument(); const i = d.querySelector("image"); i.setAttribute("href", "/p.png"); return i.getAttribute("href"); });
  T(tag + ".win", () => { const w = tag === "embed" ? el.getSVGDocument().defaultView : el.contentWindow; return w && (w.location.href.replace(/localhost:\d+/, "H")); });
  T(tag + ".winscript", () => { const w = tag === "embed" ? el.getSVGDocument().defaultView : el.contentWindow; return w.__svgscript === undefined ? "noscript-global" : String(w.__svgscript).replace(/localhost:\d+/, "H"); });
  T(tag + ".xser", () => { const d = el.getSVGDocument(); return new XMLSerializer().serializeToString(d.querySelector("circle")); });
}
window.__lines = [JSON.stringify(out)]; window.__done = true;
`;
const SVG = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="50" height="50"><defs><circle id="c" cx="25" cy="25" r="20" fill="green"/></defs><use href="#c"/><circle cx="10" cy="10" r="5"/><image href="/p.png" width="5" height="5"/><script>window.__svgscript = location.href;</script></svg>`;
export function makeServer() {
	return http.createServer((req, res) => {
		const p = req.url!.split("?")[0];
		if (p === "/icon.svg") {
			res.writeHead(200, {
				"Content-Type": "image/svg+xml",
			});
			res.end(SVG);
			return;
		}
		if (p === "/s.js") {
			res.writeHead(200, {
				"Content-Type": "text/javascript",
			});
			res.end(`(async () => {${PARENT_JS}})();`);
			return;
		}
		if (p === "/p.png") {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {
			"Content-Type": "text/html",
		});
		res.end(`<!DOCTYPE html><body><script src="/s.js"></script></body>`);
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
		name: "rv14-svgobject",
		fn: async ({ page, navigate }) => {
			const server = makeServer();
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			page.on("pageerror", (e: Error) => errs.push(e.message));
			page.on("console", (m: any) => {
				if (m.type() === "error")
					errs.push("console: " + m.text().slice(0, 200));
			});
			try {
				await navigate(`http://localhost:${port}/`);
				const fr = () =>
					page
						.frames()
						.find(
							(f: any) =>
								f.url().includes("localhost%3A" + port) &&
								!f.url().includes("icon")
						);
				console.log(
					"RV14SVG " +
						(await collect(async (s) => fr()!.evaluate(s))) +
						"\nERRS " +
						JSON.stringify(errs)
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
