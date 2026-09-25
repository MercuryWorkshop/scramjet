import http from "http";
import { playwrightTest, type Test } from "../../../testcommon.ts";

export default [
	playwrightTest({
		name: "rv6-vimeopw",
		fn: async ({ page, frame, navigate }) => {
			const html = `<!doctype html><body><iframe id="v" src="https://player.vimeo.com/video/76979871?h=8272103f6e" width="320" height="180" allow="autoplay"></iframe>
			<script src="https://player.vimeo.com/api/player.js"></script>
			<script>
			  window.__r = "pending";
			  const player = new Vimeo.Player(document.getElementById("v"));
			  player.getDuration().then((d) => window.__r = "dur " + d, (e) => window.__r = "err " + e);
			</script></body>`;
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(html);
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			page.on("pageerror", (e) =>
				errs.push("PE " + (e.stack || String(e)).slice(0, 1500))
			);
			page.on("console", (m) => {
				if (m.type() === "error") errs.push("CE " + m.text().slice(0, 300));
			});
			await navigate(`http://localhost:${port}/`);
			await page.waitForTimeout(12000);
			const r = await frame.locator("body").evaluate(() => (window as any).__r);
			server.close();
			throw new Error("RESULT " + r + "\n" + errs.join("\n---\n"));
		},
	}),
] as Test[];
