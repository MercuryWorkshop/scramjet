import http from "http";
import { playwrightTest } from "../../../testcommon.ts";

// v3 review prior #11: what the browser is actually given for a root scope
export default [
	playwrightTest({
		name: "v3-probe-importmap-root-scope",
		fn: async ({ page, frame, navigate }) => {
			const seen: string[] = [];
			const server = http.createServer((req, res) => {
				seen.push(req.url ?? "");
				const u = (req.url || "/").split("?")[0];
				const js = (b: string) => {
					res.writeHead(200, {
						"content-type": "text/javascript",
						"access-control-allow-origin": "*",
					});
					res.end(b);
				};
				if (u === "/src/app.js")
					return js("import s from 'sver'; export const v = 'app+' + s;");
				if (u === "/vendor/sver.js") return js("export default 'sver';");
				res.writeHead(200, { "content-type": "text/html" });
				res.end(
					`<!doctype html><script type="importmap">${JSON.stringify({ imports: { app: "./src/app.js" }, scopes: { "./": { sver: `http://127.0.0.1:${port}/vendor/sver.js` } } })}</script><script type="module">import { v } from "app"; document.title = v;</script>`
				);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errors: string[] = [];
			page.on("console", (m) => errors.push(m.text()));
			try {
				await navigate(`http://localhost:${port}/`);
				await page.waitForTimeout(1500);
				const cdp = await page.context().newCDPSession(page);
				const { root } = await cdp.send("DOM.getDocument", {
					depth: -1,
					pierce: true,
				});
				const find = (n: any): any =>
					n.nodeName === "SCRIPT" && n.attributes?.includes("importmap")
						? n
						: (n.children ?? [])
								.concat(n.contentDocument ? [n.contentDocument] : [])
								.map(find)
								.find(Boolean);
				const s = find(root);
				const html = s
					? (await cdp.send("DOM.getOuterHTML", { nodeId: s.nodeId })).outerHTML
					: "no importmap";
				throw new Error(
					"PROBE\n" +
						html +
						"\nREQUESTS " +
						JSON.stringify(seen) +
						"\nCONSOLE " +
						JSON.stringify(errors.filter((e) => /sver|resolve|import/i.test(e)))
				);
			} finally {
				server.close();
			}
		},
	}),
];
