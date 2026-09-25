import http from "http";
import { playwrightTest } from "../../../testcommon.ts";

export default [
	playwrightTest({
		name: "rv5-friendly-debug",
		fn: async ({ page, navigate }) => {
			const base = Number(process.env.RUNWAY_PORT_BASE) + 62;
			const A = base;
			const s = http.createServer((req, res) => {
				const path = (req.url || "/").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<body><script>
						const f = document.createElement("iframe"); document.body.appendChild(f);
						const sc = f.contentDocument.createElement("script"); sc.src = "http://localhost:${A}/adlib.js";
						window.__res = new Promise((r) => { sc.onload = () => r("load:" + window.__adlib); sc.onerror = (e) => r("error"); });
						window.__srcprop = sc.src; window.__srcattr = sc.getAttribute("src");
						f.contentDocument.head.appendChild(sc);
					</script></body>`);
				} else {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`parent.__adlib = location.href;`);
				}
			});
			await new Promise<void>((r) => s.listen(A, () => r()));
			const log: string[] = [];
			page.on("request", (r: any) => {
				if (r.url().includes("adlib")) log.push("REQ " + r.url());
			});
			page.on("requestfailed", (r: any) => {
				if (r.url().includes("adlib"))
					log.push("FAIL " + r.url() + " " + r.failure()?.errorText);
			});
			page.on("console", (m: any) =>
				log.push("console." + m.type() + ": " + m.text().slice(0, 300))
			);
			try {
				await navigate(`http://localhost:${A}/`);
				await new Promise((r) => setTimeout(r, 3000));
				const fr = page
					.frames()
					.find((f: any) => f.url().includes(`localhost%3A${A}`));
				const res = fr
					? await fr.evaluate(
							"Promise.all([window.__res, window.__srcprop, window.__srcattr])"
						)
					: "no frame";
				console.log("FRIENDLY " + JSON.stringify(res) + "\n" + log.join("\n"));
			} finally {
				s.closeAllConnections();
				s.close();
			}
		},
	}),
];
