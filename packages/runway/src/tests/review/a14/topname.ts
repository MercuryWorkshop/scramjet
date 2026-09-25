import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// controller inject's injectScramjet() does `window.name = frame.name = createFrameId()`
// where `window` is the *hooking* realm's global. When the page hooks an unnamed
// about:blank iframe, does the page's own window.name change, and do `_top` /
// `_parent` targets still find the top frame afterwards?
export default [
	playwrightTest({
		name: "rv14-topname",
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				const p = req.url!.split("?")[0];
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				if (p === "/landed.html") res.end("<body>landed</body>");
				else if (p === "/child.html")
					res.end(
						`<body><a id=l target=_top href="/landed.html?via=child">go</a></body>`
					);
				else
					res.end(`<body><div id=out></div><script>const NOTOUCH = ${process.env.RV14_NOTOUCH ? "true" : "false"};
					const before = window.name;
					const f = document.createElement("iframe"); document.body.appendChild(f);
					if (!NOTOUCH) { void f.contentWindow; }
					const after = window.name;
					if (!NOTOUCH) { const d = f.contentDocument; d.open(); d.write('<a id=l target=_top href="/landed.html?via=blank">go</a>'); d.close(); }
					const g = document.createElement("iframe"); g.id = "g"; g.src = "/child.html"; document.body.appendChild(g);
					document.getElementById("out").textContent = JSON.stringify({ before, after, changed: before !== after, fname: f.name });
					f.id = "f";
				</script></body>`);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const pages: string[] = [];
			page.context().on("page", (p: any) => pages.push("NEWPAGE"));
			try {
				await navigate(`http://localhost:${port}/`);
				await new Promise((r) => setTimeout(r, 1500));
				const out = await frame.locator("#out").textContent();
				const via = process.env.RV14_VIA || "blank";
				await frame
					.frameLocator("#" + (via === "blank" ? "f" : "g"))
					.locator("#l")
					.click();
				await new Promise((r) => setTimeout(r, 2000));
				const urls = page
					.frames()
					.map((f: any) =>
						decodeURIComponent(f.url()).replace(/localhost:\d+/g, "H")
					)
					.filter((u: string) => u.includes("landed"));
				console.log(
					"RV14TOPNAME " +
						out +
						" via=" +
						via +
						" landedFrames=" +
						JSON.stringify(urls) +
						" newPages=" +
						pages.length +
						" allPages=" +
						page.context().pages().length
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
