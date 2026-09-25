import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";
import { CHILD } from "./xsitepm.ts";

// Same as rv14-xsite-pm, but as a playwright test so that the controller
// crash inside a touched child (bucket 1 #3) doesn't abort the run.
export default [
	playwrightTest({
		name: "rv14-xsite-pm-pw",
		fn: async ({ page, navigate }) => {
			const other = http.createServer((req, res) => {
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(CHILD);
			});
			await new Promise<void>((r) => other.listen(0, r));
			const op = (other.address() as any).port;
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(`<!DOCTYPE html><html><body><script>
(async () => {
  window.__xs = {};
  localStorage.setItem("xs", "parent");
  const got = [];
  let probeRes;
  addEventListener("message", (e) => { if (e.data && e.data.probe) { probeRes(e.data.probe); return; } got.push(e.origin.replace(/localhost:\\d+/, "H" + (e.origin.endsWith(location.port) ? "self" : "other")) + " " + e.data); });
  for (const kind of ["untouched", "touched"]) {
    got.length = 0;
    const f = document.createElement("iframe");
    f.src = "http://localhost:${op}/c?" + kind;
    const l = new Promise((r) => f.onload = r);
    document.body.appendChild(f);
    if (kind === "touched") void f.contentWindow;
    await l;
    const w = f.contentWindow;
    w.postMessage("ping", "http://localhost:${op}");
    w.postMessage("wrong-origin", location.origin);
    await new Promise((r) => setTimeout(r, 400));
    const p = await new Promise((r) => { probeRes = r; w.postMessage("probe", "*"); setTimeout(() => r({ timeout: true }), 3000); });
    p.parentGot = got.join("|");
    p.parentLs = localStorage.getItem("xs");
    __xs[kind] = p;
    f.remove();
  }
  window.__xsdone = true;
})();
</script></body></html>`);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			try {
				await navigate(`http://localhost:${port}/`);
				const fr = () =>
					page
						.frames()
						.find((f: any) => f.url().includes("localhost%3A" + port));
				for (let i = 0; i < 30; i++) {
					if (
						await fr()
							?.evaluate("!!window.__xsdone")
							.catch(() => false)
					)
						break;
					await new Promise((r) => setTimeout(r, 500));
				}
				console.log(
					"RV14XS " +
						(await fr()!.evaluate("JSON.stringify(window.__xs, null, 1)"))
				);
			} finally {
				server.closeAllConnections();
				server.close();
				other.close();
			}
		},
	}),
];
