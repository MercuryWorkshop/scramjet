import http from "http";
import { playwrightTest } from "../../../testcommon.ts";

// Same as rv5-frames-touched-frame-cookies but ignores pageerrors, to see the
// functional effect of the controller inject crash in a touched frame.
export default [
	playwrightTest({
		name: "rv5-touched-functional",
		fn: async ({ page, navigate }) => {
			const base = Number(process.env.RUNWAY_PORT_BASE) + 60;
			const A = base,
				B = base + 1;
			const mk = (port: number) =>
				http.createServer((req, res) => {
					const path = (req.url || "/").split("?")[0];
					if (path === "/") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<body><script>
						window.results = {};
						addEventListener("message", (e) => { window.results[e.data.which] = e.data; });
						const f1 = document.createElement("iframe"); f1.src = "http://localhost:${B}/cookie-child.html?which=touched"; document.body.appendChild(f1); void f1.contentWindow.document;
						const f2 = document.createElement("iframe"); f2.src = "http://localhost:${B}/cookie-child.html?which=untouched"; document.body.appendChild(f2);
					</script></body>`);
					} else {
						res.writeHead(200, {
							"Content-Type": "text/html",
							"Set-Cookie": "rv5srv=1; Path=/",
						});
						res.end(`<script>document.cookie = "rv5js=1; path=/"; const w = new URLSearchParams(location.search).get("which");
						setTimeout(async () => { let fetchOk; try { fetchOk = (await fetch("/x")).status; } catch (e) { fetchOk = String(e); }
						parent.postMessage({ which: w, cookie: document.cookie, fetchOk, href: location.href, origin: origin, swType: typeof navigator.serviceWorker }, "*"); }, 500);</script>`);
					}
				});
			const sa = mk(A),
				sb = mk(B);
			await new Promise<void>((r) => sa.listen(A, () => r()));
			await new Promise<void>((r) => sb.listen(B, () => r()));
			const errs: string[] = [];
			page.on("pageerror", (e: any) => errs.push(e.message));
			try {
				await navigate(`http://localhost:${A}/`);
				await new Promise((r) => setTimeout(r, 4000));
				const fr = page
					.frames()
					.find((f: any) => f.url().includes(`localhost%3A${A}`));
				const res = fr ? await fr.evaluate("window.results") : "no frame";
				console.log(
					"TOUCHED " +
						JSON.stringify(res, null, 1) +
						"\nERRS " +
						JSON.stringify(errs)
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
