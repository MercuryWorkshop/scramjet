import { playwrightTest } from "../../../testcommon.ts";
import http from "http";
import fs from "fs";

// Generic probe (a1/probe.ts + shared-worker console capture).
// PROBE_JS=<file> evaluated in the proxied frame after load; PROBE_HTML=<file>
// served at /; PROBE_FILES=/route=file[=type],...; PROBE_OUT=<file>.
const probePort = Number(process.env.RUNWAY_PORT_BASE ?? 4500) + 150;

export default [
	playwrightTest({
		name: "rv12-probe",
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
				}
			> = {};
			if (process.env.PROBE_FILES) {
				for (const f of process.env.PROBE_FILES.split(",")) {
					const [route, file, type] = f.split("=");
					extra[route] = {
						type: type || "application/javascript",
						body: fs.readFileSync(file, "utf8"),
					};
				}
			}
			const reports: Record<string, any> = {};
			const server = http.createServer((req, res) => {
				const u = req.url!.split("?")[0];
				if (u.startsWith("/report/")) {
					let b = "";
					req.on("data", (c) => (b += c));
					req.on("end", () => {
						reports[u.slice(8)] = JSON.parse(b || "null");
						res.writeHead(200, {
							"Access-Control-Allow-Origin": "*",
						});
						res.end("ok");
					});
					return;
				}
				if (u === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(html);
				} else if (extra[u]) {
					res.writeHead(200, {
						"Content-Type": extra[u].type,
					});
					res.end(extra[u].body);
				} else {
					res.writeHead(404);
					res.end("nf");
				}
			});
			await new Promise<void>((r) => server.listen(probePort, () => r()));
			const logs: string[] = [];
			page.on("console", (m) =>
				logs.push(`[${m.type()}] ${m.text()}`.slice(0, 500))
			);
			page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
			page.on("worker", (w: any) => {
				logs.push(`[worker-created] ${w.url()}`);
				try {
					w.on("console", (m: any) =>
						logs.push(`[worker ${m.type()}] ${m.text()}`.slice(0, 500))
					);
				} catch {}
			});
			try {
				await navigate(
					`http://localhost:${probePort}/${process.env.PROBE_PATH ?? ""}`
				);
				await new Promise((r) =>
					setTimeout(r, Number(process.env.PROBE_WAIT ?? 1500))
				);
				const frames = page.frames();
				const f =
					frames.find(
						(fr) =>
							fr.url().includes("/~/sj/") ||
							fr.url().includes("localhost%3A" + probePort)
					) ?? frames[frames.length - 1];
				let result: any;
				try {
					result = await f.evaluate(`(async () => { ${js} })()`);
				} catch (e: any) {
					result = "EVAL-ERROR: " + e.message;
				}
				// shared workers: replay their console through a browser CDP session
				try {
					const browser = page.context().browser();
					if (browser) {
						const bs = await browser.newBrowserCDPSession();
						const { targetInfos } = await bs.send("Target.getTargets");
						for (const t of targetInfos) {
							if (t.type !== "shared_worker") continue;
							const { sessionId } = await bs.send("Target.attachToTarget", {
								targetId: t.targetId,
								flatten: true,
							});
							const msgs: string[] = [];
							(bs as any).on("Runtime.consoleAPICalled", (ev: any) => {
								msgs.push(
									`[shared ${ev.type}] ` +
										ev.args
											.map((a: any) => a.value ?? a.description ?? "")
											.join(" ")
								);
							});
							await (bs as any)
								.send("Runtime.enable", undefined, sessionId)
								.catch(() => {});
							try {
								// flattened session: send via raw connection
								const raw: any = bs as any;
								await raw._connection?.send?.("Runtime.enable", {}, sessionId);
							} catch {}
							await new Promise((r) => setTimeout(r, 300));
							logs.push(`[shared-worker ${t.url}]`, ...msgs);
						}
					}
				} catch (e: any) {
					logs.push("[shared-capture-failed] " + e.message);
				}
				const out = {
					result,
					reports,
					logs,
				};
				if (process.env.PROBE_OUT)
					fs.writeFileSync(process.env.PROBE_OUT, JSON.stringify(out, null, 1));
				else console.log("PROBE-RESULT " + JSON.stringify(out, null, 1));
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
