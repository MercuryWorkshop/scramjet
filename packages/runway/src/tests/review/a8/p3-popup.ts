import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// window.open popup and a worker: which realm's natives, and does the popup's
// own inject survive the opener having hooked its initial about:blank?
export default [
	playwrightTest({
		name: "rv8p3-popup-realm",
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				if (req.url!.startsWith("/child"))
					res.end(
						`<!DOCTYPE html><body>child<script>window.__child = location.href; window.__sw = typeof navigator.serviceWorker;</script></body>`
					);
				else if (req.url === "/data.txt") res.end("data");
				else
					res.end(`<!DOCTYPE html><body><button id=b>open</button><script>
document.getElementById("b").onclick = () => {
  const w = window.open("/child.html", "_blank");
  const r = { opened: !!w };
  try { r.blankHref = w.location.href; } catch (e) { r.blankErr = String(e); }
  setTimeout(async () => {
    try { r.child = w.__child; r.loc = w.location.href; r.fetch = await w.fetch("/data.txt").then(x => x.text()).catch(e => "ERR " + e.message); r.opener = w.opener === window; r.fnRealm = new w.Function("return location.href")(); } catch (e) { r.err = String(e); }
    document.body.setAttribute("data-result", JSON.stringify(r));
  }, 2500);
};
</script></body>`);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			const watch = (p: any) =>
				p.on("pageerror", (e: Error) =>
					errs.push("pageerror[" + p.url().slice(0, 40) + "]: " + e.message)
				);
			watch(page);
			page.context().on("page", watch);
			await navigate(`http://localhost:${port}/`);
			await new Promise((r) => setTimeout(r, 1000));
			await frame.locator("#b").click();
			await new Promise((r) => setTimeout(r, 4000));
			const out = await frame.locator("body").getAttribute("data-result");
			const fs = await import("node:fs");
			fs.writeFileSync(
				"/home/velzie/.cache/sjreview/scratch-a8/p2/popup-" +
					(process.cwd().includes("/dev/") ? "dev" : "main") +
					".txt",
				out + "\n" + errs.join("\n")
			);
			server.close();
		},
	}),
];
