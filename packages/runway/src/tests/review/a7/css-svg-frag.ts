import http from "http";
import type { AddressInfo } from "node:net";
import { playwrightTest } from "../../../testcommon.ts";

// Renders SVG rects whose fill is a same-document paint server reference set
// through different CSSOM paths, screenshots each, and checks the pixel is red.
const html = `<!doctype html><html><body style="margin:0;background:#fff">
<svg width="400" height="60" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#f00"/></linearGradient></defs>
<rect id="prop" x="0" y="0" width="50" height="50"/>
<rect id="setprop" x="60" y="0" width="50" height="50"/>
<rect id="attr" x="120" y="0" width="50" height="50"/>
<rect id="csstext" x="180" y="0" width="50" height="50"/>
<rect id="rule" class="ruled" x="240" y="0" width="50" height="50"/>
<rect id="markup" style="fill:url(#g)" x="300" y="0" width="40" height="50"/>
<rect id="sheet" class="st" x="350" y="0" width="40" height="50"/>
</svg>
<style id="s"></style><style>.st{fill:url(#g)}</style>
<script>
document.getElementById('prop').style.fill = 'url(#g)';
document.getElementById('setprop').style.setProperty('fill', 'url(#g)');
document.getElementById('attr').setAttribute('style', 'fill: url(#g)');
document.getElementById('csstext').style.cssText = 'fill: url(#g)';
const sh = document.getElementById('s').sheet; sh.insertRule('.ruled{}'); sh.cssRules[0].style.fill = 'url(#g)';
document.title = 'ready';
</script></body></html>`;

export default [
	playwrightTest({
		name: "rv7-svg-fragment-fill",
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(html);
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as AddressInfo).port;
			try {
				await navigate(`http://localhost:${port}/`);
				const results: Record<string, string> = {};
				for (const id of [
					"prop",
					"setprop",
					"attr",
					"csstext",
					"rule",
					"markup",
					"sheet",
				]) {
					const loc = frame.locator(`#${id}`);
					await loc.waitFor({
						state: "attached",
						timeout: 15000,
					});
					const buf = await loc.screenshot();
					const b64 = buf.toString("base64");
					results[id] = await page.evaluate(async (b64) => {
						const img = new Image();
						img.src = "data:image/png;base64," + b64;
						await img.decode();
						const c = document.createElement("canvas");
						c.width = img.width;
						c.height = img.height;
						const ctx = c.getContext("2d")!;
						ctx.drawImage(img, 0, 0);
						const d = ctx.getImageData(
							img.width >> 1,
							img.height >> 1,
							1,
							1
						).data;
						return `${d[0]},${d[1]},${d[2]}`;
					}, b64);
				}
				console.log("RV7SVG " + JSON.stringify(results));
				const bad = Object.entries(results).filter(([, v]) => v !== "255,0,0");
				if (bad.length) throw new Error("not red: " + JSON.stringify(results));
			} finally {
				server.close();
			}
		},
	}),
];
