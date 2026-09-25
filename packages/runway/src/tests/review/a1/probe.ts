import { playwrightTest } from "../../../testcommon.ts";
import http from "http";
import fs from "fs";

// Generic probe: PROBE_JS=<file> evaluated inside the proxied frame after load.
// PROBE_HTML=<file> (optional) served as the page body.
let probePort = Number(process.env.RUNWAY_PORT_BASE ?? 4500) + 150;

export default [
	playwrightTest({
		name: "rv1-probe",
		fn: async ({ page, navigate }) => {
			const js = process.env.PROBE_JS
				? fs.readFileSync(process.env.PROBE_JS, "utf8")
				: "1";
			const html = process.env.PROBE_HTML
				? fs.readFileSync(process.env.PROBE_HTML, "utf8")
				: "<!DOCTYPE html><html><head></head><body><h1>probe</h1></body></html>";
			const extra: Record<
				string,
				{
					type: string;
					body: string;
					cookie?: string;
				}
			> = {};
			if (process.env.PROBE_FILES) {
				for (const f of process.env.PROBE_FILES.split(",")) {
					const [route, file, type, cookie] = f.split("=");
					extra[route] = {
						type: type || "application/javascript",
						body: fs.readFileSync(file, "utf8"),
						cookie: cookie ? cookie.replace(":", "=") : undefined,
					};
				}
			}
			const port = probePort;
			const server = http.createServer((req, res) => {
				const u = req.url!.split("?")[0];
				if (u === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(html);
				} else if (extra[u]) {
					res.writeHead(
						200,
						extra[u].cookie
							? {
									"Content-Type": extra[u].type,
									"Set-Cookie": extra[u].cookie + "; Path=/",
								}
							: {
									"Content-Type": extra[u].type,
								}
					);
					res.end(extra[u].body);
				} else {
					res.writeHead(404);
					res.end("nf");
				}
			});
			await new Promise<void>((r) => server.listen(port, () => r()));
			const logs: string[] = [];
			page.on("console", (m) =>
				logs.push(`[${m.type()}] ${m.text()}`.slice(0, 400))
			);
			page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
			page.on("worker", (w: any) => {
				logs.push(`[worker-created] ${w.url()}`);
				try {
					w.on("console", (m: any) =>
						logs.push(`[worker ${m.type()}] ${m.text()}`.slice(0, 400))
					);
				} catch {}
			});
			try {
				await navigate(`http://localhost:${port}/`);
				await new Promise((r) =>
					setTimeout(r, Number(process.env.PROBE_WAIT ?? 1500))
				);
				const frames = page.frames();
				const f =
					frames.find(
						(fr) =>
							fr.url().includes("/~/sj/") ||
							fr.url().includes("localhost%3A" + port)
					) ?? frames[frames.length - 1];
				let result: any;
				let cdp: any = null;
				if (process.env.PROBE_PROFILE) {
					cdp = await page.context().newCDPSession(page);
					await cdp.send("Profiler.enable");
					await cdp.send("Profiler.setSamplingInterval", {
						interval: 100,
					});
					await cdp.send("Profiler.start");
				}
				try {
					result = await f.evaluate(`(async () => { ${js} })()`);
					if (cdp) {
						const { profile } = await cdp.send("Profiler.stop");
						fs.writeFileSync(
							process.env.PROBE_PROFILE,
							JSON.stringify(profile)
						);
					}
				} catch (e: any) {
					result = "EVAL-ERROR: " + e.message;
				}
				if (process.env.PROBE_OUT) {
					fs.writeFileSync(
						process.env.PROBE_OUT,
						JSON.stringify(result, null, 1)
					);
					if (process.env.PROBE_BARE_OUT) {
						const bare = await page.evaluate(`(async () => { ${js} })()`);
						fs.writeFileSync(
							process.env.PROBE_BARE_OUT,
							JSON.stringify(bare, null, 1)
						);
					}
				} else console.log("PROBE-RESULT " + JSON.stringify(result, null, 1));
				if (!process.env.PROBE_QUIET)
					console.log("PROBE-LOGS\n" + logs.join("\n"));
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
