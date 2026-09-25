import { serverTest, type Test } from "../../../testcommon.ts";

const t = serverTest({
	name: "rv21-urlsources",
	autoPass: true,
	js: `
		const R = {};
		const norm = (s) => String(s).replace(location.origin, "SELF");
		await import("/m.js").then((m) => { R.importMetaUrl = norm(m.u); R.resolved = norm(m.r); });
		const sc = document.createElement("script"); sc.src = "/c.js"; await new Promise((r) => { sc.onload = r; document.head.appendChild(sc); });
		R.currentScript = norm(window.__cs);
		R.stackUrl = norm(window.__st);
		const lk = document.createElement("link"); lk.rel = "stylesheet"; lk.href = "/s.css"; await new Promise((r) => { lk.onload = r; document.head.appendChild(lk); });
		R.sheetHref = norm(lk.sheet.href);
		R.errFilename = await new Promise((res) => { const h = (e) => { removeEventListener("error", h); e.preventDefault(); res(norm(e.filename)); }; addEventListener("error", h); const s = document.createElement("script"); s.src = "/throw.js"; document.head.appendChild(s); });
		R.docURL = norm(document.URL);
		R.baseURI = norm(document.baseURI);
		console.log("RV21", JSON.stringify(R));
		for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);
	`,
	start: async (server) => {
		server.on("request", (req, res) => {
			if (res.headersSent) return;
			const u = (req.url || "/").split("?")[0];
			const f: Record<string, [string, string]> = {
				"/m.js": [
					"application/javascript",
					`export const u = import.meta.url; export const r = import.meta.resolve("./x.js");`,
				],
				"/c.js": [
					"application/javascript",
					`window.__cs = document.currentScript.src; window.__st = (new Error().stack.split("\\n")[1].match(/(https?:[^)\\s]+?):\\d+:\\d+/) || [])[1];`,
				],
				"/s.css": ["text/css", `body{}`],
				"/throw.js": ["application/javascript", `throw new Error("x")`],
			};
			const x = f[u];
			if (x) {
				res.writeHead(200, {
					"Content-Type": x[0],
				});
				res.end(x[1]);
			} else if (u !== "/" && u !== "/script.js") {
				res.writeHead(404);
				res.end();
			}
		});
	},
});
export default [t] as Test[];
