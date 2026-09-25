import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// A window.open(url) popup is hooked by the opener while it is still the
// initial about:blank, and Chrome keeps that Window (and the client on it)
// when the popup commits its real URL. develop's client caches topUrl on first
// read; for a popup parentFrame() is "top", so topUrl = client.url = about:blank.
export default [
	playwrightTest({
		name: "rv14-popup-top",
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				const p = req.url!.split("?")[0];
				if (p === "/m.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(
						"window.__count = (window.__count || 0) + 1; export const v = 1;"
					);
					return;
				}
				if (p === "/x.txt") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("x");
					return;
				}
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				if (p === "/pop.html")
					res.end(`<!DOCTYPE html><body>pop<script type="module">import "/m.js";</script><script type="module">
					await new Promise((r) => setTimeout(r, 300));
					await import("/m.js");
					fetch("/x.txt?from=fetch");
					const i = new Image(); i.src = "/x.txt?from=img"; const fr = document.createElement("iframe"); fr.src = "/x.txt?from=iframe"; document.body.append(fr); const w = new Worker("/m.js?from=worker");
					window.__result = { count: window.__count, href: location.href };
				</script></body>`);
				else
					res.end(
						`<body><button id=b>open</button><script>document.getElementById("b").onclick = () => { window.__w = ${process.env.RV14_POPNAV ? '(() => { const w = window.open("", "_blank"); w.location.href = "/pop.html"; return w; })()' : 'window.open("/pop.html", "_blank")'}; };</script></body>`
					);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const reqs: string[] = [];
			const errs: string[] = [];
			try {
				await navigate(`http://localhost:${port}/`);
				await new Promise((r) => setTimeout(r, 800));
				const popupP = page.context().waitForEvent("page");
				await frame.locator("#b").click();
				const popup = await popupP;
				popup.on("request", (r: any) =>
					reqs.push(decodeURIComponent(r.url()).replace(/localhost:\d+/g, "H"))
				);
				popup.on("pageerror", (e: Error) => errs.push(e.message));
				await popup.waitForLoadState("load");
				await new Promise((r) => setTimeout(r, 2000));
				const result = await popup.evaluate("JSON.stringify(window.__result)");
				console.log(
					"RV14POPTOP " +
						result +
						"\nREQS\n" +
						reqs.filter((u) => /m\.js|x\.txt/.test(u)).join("\n") +
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
