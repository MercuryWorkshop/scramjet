import http from "http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../../testcommon.ts";

// Does Chrome deliver Reporting API reports straight to the site's endpoint (bypassing the proxy)?
function repTest(name: string): Test {
	let server: http.Server;
	const reports: any[] = [];
	const test: Test = {
		name,
		port: 0,
		timeoutMs: 150000,
		async start() {
			server = http.createServer((req, res) => {
				const p = new URL(req.url!, "http://x").pathname;
				if (p === "/reports") {
					let b = "";
					req.on("data", (c) => (b += c));
					req.on("end", () => {
						reports.push({
							via: req.headers["user-agent"]?.slice(0, 20),
							body: b.slice(0, 400),
						});
						res.writeHead(200, {
							"access-control-allow-origin": "*",
						});
						res.end();
					});
					return;
				}
				if (p === "/__reports") {
					res.writeHead(200, {
						"content-type": "application/json",
						"access-control-allow-origin": "*",
					});
					res.end(JSON.stringify(reports));
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
					"reporting-endpoints": `default="http://127.0.0.1:${test.port}/reports"`,
					"report-to": JSON.stringify({
						group: "default",
						max_age: 1000,
						endpoints: [
							{
								url: `http://127.0.0.1:${test.port}/reports`,
							},
						],
					}),
				});
				res.end(`<!DOCTYPE html><script>
runTest(async () => {
	const seen = []; new ReportingObserver((rs) => rs.forEach(r => seen.push(r.type + ":" + (r.body && r.body.id))), { buffered: true }).observe();
	try { document.domain = document.domain; } catch (e) {}
	try { new WebSocket("ws://127.0.0.1:1/").close(); } catch (e) {}
	for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 1000)); const got = await (await fetch("http://127.0.0.1:${test.port}/__reports")).json(); if (got.length) { fail("R " + JSON.stringify({ delivered: got, observed: seen })); return; } }
	fail("R " + JSON.stringify({ delivered: [], observed: seen }));
}, false);
</script>`);
			});
			await new Promise<void>((r) =>
				server.listen(0, () => {
					test.port = (server.address() as AddressInfo).port;
					r();
				})
			);
		},
		async stop() {
			server.closeAllConnections?.();
			await new Promise<void>((r) => server.close(() => r()));
		},
	};
	return test;
}
export default [repTest("rv25-reporting-endpoints")];
