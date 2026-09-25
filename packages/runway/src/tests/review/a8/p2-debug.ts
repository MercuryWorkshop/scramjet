import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// iframe touched (contentWindow read) before its same-origin document loads:
// what state does the child end up in?
export default [
	playwrightTest({
		name: "rv8p2-debug-touch-before-load",
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				if (req.url!.startsWith("/child"))
					res.end(
						`<!DOCTYPE html><body>child<script>window.__child = location.href; window.__sjc = typeof $scramjet$wrap; window.__cookie = (document.cookie = "a=1", document.cookie);</script><a id=l href="/x">x</a></body>`
					);
				else if (req.url === "/data.txt") res.end("data");
				else
					res.end(
						`<!DOCTYPE html><body><script>
const f = document.createElement("iframe"); f.src = "/child.html"; document.body.appendChild(f);
${"TOUCH"}
f.onload = async () => {
  const w = f.contentWindow; const r = {};
  try { r.child = w.__child; r.sjc = w.__sjc; r.loc = w.location.href; r.link = w.document.getElementById("l").href; r.fetch = await w.fetch("/data.txt").then(x => x.text()).catch(e => "ERR " + e.message); r.cookie = w.__cookie; } catch (e) { r.err = String(e); }
  document.body.setAttribute("data-result", JSON.stringify(r));
};
</script></body>`.replace(
							"TOUCH",
							req.url === "/touch" ? "void f.contentWindow.document;" : ""
						)
					);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			page.on("pageerror", (e: Error) =>
				errs.push(
					"pageerror: " +
						e.message +
						" " +
						(e.stack || "").split("\n").slice(0, 4).join(" / ")
				)
			);
			const out: string[] = [];
			for (const path of ["/notouch", "/touch"]) {
				await navigate(`http://localhost:${port}${path}`);
				await new Promise((r) => setTimeout(r, 2500));
				out.push(
					path + " " + (await frame.locator("body").getAttribute("data-result"))
				);
			}
			const fs = await import("node:fs");
			fs.writeFileSync(
				"/home/velzie/.cache/sjreview/scratch-a8/p2/debug-" +
					(process.cwd().includes("/dev/") ? "dev" : "main") +
					".txt",
				out.join("\n") + "\n" + errs.join("\n")
			);
			server.close();
		},
	}),
];
