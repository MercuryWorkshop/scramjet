import http from "http";
import { playwrightTest } from "../../../testcommon.ts";

// Functional effect (ignoring the pageerrors) of the touched-frame crash on a
// classic script's dynamic import() - the crazygames gameframe pattern.
export default [
	playwrightTest({
		name: "rv5-touched2-dynimport",
		fn: async ({ page, navigate }) => {
			const base = Number(process.env.RUNWAY_PORT_BASE) + 64;
			const A = base,
				B = base + 1;
			const mk = (port: number) =>
				http.createServer((req, res) => {
					const path = (req.url || "/").split("?")[0];
					const js = (b: string) => {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(b);
					};
					if (path === "/") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<body><script>
						window.results = {};
						addEventListener("message", (e) => { window.results[e.data.which] = e.data; });
						for (const which of ["touched", "untouched", "touched-im", "untouched-im"]) {
							const f = document.createElement("iframe"); f.src = "http://localhost:${B}/game.html?which=" + which; document.body.appendChild(f);
							if (which.startsWith("touched")) void f.contentWindow.document;
						}
					</script></body>`);
					} else if (path === "/game.html") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						const im = (req.url || "").includes("-im")
							? `<script type="importmap">{"imports":{"react":"https://esm.sh/react"}}</script>`
							: "";
						res.end(
							im +
								`<script>window.which = new URLSearchParams(location.search).get("which"); const s = document.createElement("script"); s.src = "http://localhost:${B}/gf/v2.10/bundle.js"; document.head.appendChild(s);</script>`
						);
					} else if (path === "/gf/v2.10/bundle.js") {
						js(
							`(function(){ import("./static/chunk.js").then(m => parent.postMessage({ which, where: m.where, meta: m.meta }, "*"), e => parent.postMessage({ which, err: String(e) }, "*")); })();`
						);
					} else if (path.endsWith("chunk.js")) {
						js(
							`export const where = "chunk"; export const meta = import.meta.url;`
						);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
			const sa = mk(A),
				sb = mk(B);
			await new Promise<void>((r) => sa.listen(A, () => r()));
			await new Promise<void>((r) => sb.listen(B, () => r()));
			const reqs: string[] = [];
			page.on("request", (r: any) => {
				const u = decodeURIComponent(r.url());
				if (u.includes("chunk") || u.includes("bundle"))
					reqs.push(u.slice(u.indexOf("http", 10), u.indexOf("http", 10) + 90));
			});
			try {
				await navigate(`http://localhost:${A}/`);
				await new Promise((r) => setTimeout(r, 4000));
				const fr = page
					.frames()
					.find((f: any) => f.url().includes(`localhost%3A${A}`));
				const res = fr ? await fr.evaluate("window.results") : "no frame";
				console.log(
					"TOUCHED2 " +
						JSON.stringify(res, null, 1) +
						"\nREQS " +
						JSON.stringify(reqs, null, 1)
				);
			} finally {
				sa.closeAllConnections();
				sb.closeAllConnections();
				sa.close();
				sb.close();
			}
		},
	}),
];
