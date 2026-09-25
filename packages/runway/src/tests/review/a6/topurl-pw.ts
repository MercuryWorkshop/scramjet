import http from "http";
import { playwrightTest, type Test } from "../../../testcommon.ts";

export default [
	playwrightTest({
		name: "rv6-toppw-urls",
		fn: async ({ page, navigate }) => {
			const files: Record<string, [string, string]> = {
				"/": [
					"text/html",
					`<!doctype html><body><iframe src="/frame"></iframe></body>`,
				],
				"/a.js": [
					"application/javascript",
					`window.__acount = (window.__acount || 0) + 1; export const n = 1;`,
				],
				"/b.js": [
					"application/javascript",
					`import { n } from "./a.js"; export const m = n;`,
				],
				"/frame": [
					"text/html",
					`<!doctype html><body><script type="module" src="/a.js"></script><script type="module">import "/b.js"; setTimeout(() => document.title = "count" + window.__acount, 300);</script></body>`,
				],
			};
			const server = http.createServer((req, res) => {
				const f = files[(req.url || "/").split("?")[0]];
				if (!f) {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, {
					"Content-Type": f[0],
				});
				res.end(f[1]);
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as any).port;
			const urls: string[] = [];
			page.on("request", (r) => {
				if (r.url().includes("a.js") || r.url().includes("b.js"))
					urls.push(r.url());
			});
			await navigate(`http://localhost:${port}/`);
			await new Promise((r) => setTimeout(r, 2500));
			server.close();
			throw new Error("URLS:\n" + urls.map(decodeURIComponent).join("\n"));
		},
	}),
] as Test[];
