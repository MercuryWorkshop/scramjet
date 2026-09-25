import { serverTest } from "../../../testcommon.ts";

// Large HTML documents: does the proxied page render, and how long does it take?
const sizes = [1, 3, 6.5];
export default sizes.map((mb) =>
	serverTest({
		name: `rv0-bigdoc-${mb}mb`,
		scramjetOnly: true,
		async start(server, port, { pass, fail }) {
			const row = `<div class="r"><a href="/p/X">link X</a><img src="/i/X.png" alt=""><span>text text text text text text text text</span></div>\n`;
			const n = Math.ceil((mb * 1024 * 1024) / row.length);
			let body = "";
			for (let i = 0; i < n; i++) body += row.replaceAll("X", String(i));
			const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><script>window.__t0 = performance.now();</script></head><body><h1 id="top">top</h1>${body}<script>
				runTest(async () => {
					const rows = document.querySelectorAll(".r").length;
					fail("BIGDOC ${mb}MB rows=" + rows + "/${n} ms=" + Math.round(performance.now() - window.__t0) + " lastHref=" + document.querySelector(".r:last-child a")?.getAttribute("href"));
				}, false);
			</script></body></html>`;
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"content-type": "text/html; charset=utf-8",
					});
					res.end(html);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	})
);
