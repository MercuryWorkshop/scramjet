import http from "http";
import { playwrightTest } from "../../../testcommon.ts";

// "export to CSV": a Blob, an object URL, <a download>, click
const flows: Record<string, string> = {
	"blob-anchor": `const u = URL.createObjectURL(new Blob(["a,b\\n1,2\\n"], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "export.csv"; document.body.append(a); a.click();`,
	"blob-anchor-revoke": `const u = URL.createObjectURL(new Blob(["a,b\\n1,2\\n"], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "export.csv"; a.click(); URL.revokeObjectURL(u);`,
	"data-anchor": `const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent("a,b\\n1,2\\n"); a.download = "export.csv"; a.click();`,
	"server-attachment": `location.href = "/file";`,
	"server-anchor-download": `const a = document.createElement("a"); a.href = "/plain"; a.download = "export.csv"; a.click();`,
};

export default Object.entries(flows).map(([name, js]) =>
	playwrightTest({
		name: `v3-download-${name}`,
		fn: async ({ page, frame, navigate }) => {
			let hits = 0;
			const server = http.createServer((req, res) => {
				if (req.url === "/plain") hits++;
				if (req.url === "/file") {
					res.writeHead(200, {
						"Content-Type": "text/csv",
						"Content-Disposition": 'attachment; filename="export.csv"',
					});
					res.end("a,b\n1,2\n");
					return;
				}
				if (req.url === "/plain") {
					res.writeHead(200, { "Content-Type": "text/csv" });
					res.end("a,b\n1,2\n");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(
					`<!doctype html><button id=b onclick='${js.replace(/'/g, "&#39;")}'>go</button>`
				);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const logs: string[] = [];
			page.on("console", (m) => {
				if (m.type() === "error" || m.type() === "warning")
					logs.push(m.text().slice(0, 300));
			});
			page
				.context()
				.on("serviceworker", (w) =>
					w.on("console", (m) => logs.push("SW " + m.text().slice(0, 300)))
				);
			for (const w of page.context().serviceWorkers())
				w.on("console", (m) => logs.push("SW " + m.text().slice(0, 300)));
			try {
				await navigate(`http://localhost:${port}/`);
				await frame.locator("#b").waitFor({ timeout: 10000 });
				const sws = page.context().serviceWorkers();
				for (const w of sws)
					await w.evaluate(() => {
						const g = self as any;
						g.__dl = [];
						self.addEventListener("fetch", (e: any) =>
							g.__dl.push({
								seen: e.request.url.slice(-40),
								mode: e.request.mode,
								dest: e.request.destination,
							})
						);
						const orig = FetchEvent.prototype.respondWith;
						FetchEvent.prototype.respondWith = function (
							this: FetchEvent,
							p: any
						) {
							const r = this.request;
							const rec: any = {
								url: r.url.slice(-40),
								mode: r.mode,
								dest: r.destination,
								client: this.clientId,
								rc: this.resultingClientId,
							};
							g.__dl.push(rec);
							Promise.resolve(p).then(
								(res: Response) => {
									rec.status = res.status;
									rec.type = res.type;
									rec.headers = [...res.headers].map((h) => h[0]).join(",");
								},
								(e: any) => {
									rec.err = String(e);
								}
							);
							return orig.call(this, p);
						};
					});
				const dl = page.waitForEvent("download", { timeout: 8000 });
				await frame.locator("#b").click();
				const d = await dl;
				const failure = await d.failure();
				if (failure) {
					const probe = await page
						.evaluate(async (u) => {
							const r = await fetch(u);
							return (
								r.status +
								" " +
								JSON.stringify([...r.headers]) +
								" " +
								(await r.text()).slice(0, 80)
							);
						}, d.url())
						.catch((e) => "probe err " + e.message);
					logs.push("HITS-before-probe " + hits);
					logs.push("PROBE " + probe);
					for (const w of page.context().serviceWorkers())
						logs.push(
							"SWDL " +
								JSON.stringify(await w.evaluate(() => (self as any).__dl))
						);
					throw new Error(
						`download ${d.url()} failed: ${failure} name=${d.suggestedFilename()} LOGS ${logs.join(" | ")}`
					);
				}
				const path = await d.path();
				const body = path
					? (await import("fs")).readFileSync(path, "utf8")
					: null;
				if (d.suggestedFilename() !== "export.csv" || body !== "a,b\n1,2\n") {
					throw new Error(
						`got ${d.suggestedFilename()} ${JSON.stringify(body)} from ${d.url()}`
					);
				}
			} finally {
				server.close();
			}
		},
	})
);
