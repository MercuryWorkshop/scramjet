import http from "http";
import { playwrightTest } from "../../../testcommon.ts";

export default [
	playwrightTest({
		name: "rv5-imdbg-nested",
		fn: async ({ page, navigate }) => {
			const A = Number(process.env.RUNWAY_PORT_BASE) + 66;
			const O = `http://localhost:${A}`;
			const s = http.createServer((req, res) => {
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
					res.end(`<iframe src="/inner.html"></iframe>`);
				} else if (path === "/inner.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<script>
					const im = document.createElement("script"); im.type = "importmap";
					im.textContent = JSON.stringify({ imports: { "${O}/v2/static/": "${O}/static/", "${O}/lib.js": "${O}/v2/lib.js" } });
					document.head.appendChild(im);
					window.__r = import("/v2/static/c.js").then(m => m.got, e => "err " + e);
				</script>`);
				} else if (path === "/static/c.js" || path === "/v2/static/c.js")
					js(`import { v } from "../lib.js"; export const got = v;`);
				else if (path === "/v2/lib.js") js(`export const v = "lib";`);
				else {
					res.writeHead(404);
					res.end();
				}
			});
			await new Promise<void>((r) => s.listen(A, () => r()));
			const log: string[] = [];
			page.on("response", (r: any) => {
				const u = decodeURIComponent(r.url());
				if (u.includes(`localhost:${A}`) && /\.js/.test(u))
					log.push(r.status() + " " + u.slice(u.indexOf("/sj/") + 22));
			});
			try {
				await navigate(`${O}/`);
				await new Promise((r) => setTimeout(r, 3000));
				const fr = page
					.frames()
					.find((f: any) => decodeURIComponent(f.url()).includes("inner.html"));
				const res = fr
					? await fr.evaluate(
							`Promise.all([window.__r, [...document.querySelectorAll("script")].filter(s => s.type === "importmap").map(s => s.textContent)])`
						)
					: "no frame";
				console.log("IMDBG " + JSON.stringify(res) + "\n" + log.join("\n"));
			} finally {
				s.closeAllConnections();
				s.close();
			}
		},
	}),
];
