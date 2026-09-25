import { serverTest } from "../../../testcommon.ts";
import http from "node:http";

// Does a proxied site's Reporting-Endpoints header make the browser POST
// reports directly to the site's endpoint (bypassing the proxy)? And does the
// client's own init generate a report?
const reports: any[] = [];
let repPort = 0;
const repServer = http.createServer((req, res) => {
	let b = "";
	req.on("data", (d) => (b += d));
	req.on("end", () => {
		if (req.method === "OPTIONS") {
			res.writeHead(204, {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST",
				"Access-Control-Allow-Headers": "content-type",
			});
			res.end();
			return;
		}
		if (req.url!.startsWith("/rep"))
			reports.push({
				url: req.url,
				body: b.slice(0, 600),
			});
		if (req.url === "/__reports") {
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			});
			res.end(JSON.stringify(reports));
			return;
		}
		res.writeHead(200, {
			"Access-Control-Allow-Origin": "*",
		});
		res.end("ok");
	});
});
repServer.listen(0, () => {
	repPort = (repServer.address() as any).port;
});

const test = serverTest({
	name: "rv11-reporting-endpoints-direct",
	start: async (server) => {
		reports.length = 0;
		server.on("request", (req: any, res: any) => {
			if (req.url.split("?")[0] === "/") {
				res.writeHead(200, {
					"Content-Type": "text/html",
					"Reporting-Endpoints": `default="http://localhost:${repPort}/rep"`,
				});
				res.end(`<!doctype html><body><script>
					runTest(async () => {
						const t0 = Date.now();
						let got = [];
						while (Date.now() - t0 < 75000) {
							await new Promise(r => setTimeout(r, 3000));
							try { got = await (await fetch('/__proxyreports')).json(); } catch (e) { got = ['fetchfail ' + e]; }
							if (got.length) break;
						}
						const out = { waited: Date.now() - t0, reports: got };
						console.log('RV11PROBE ' + JSON.stringify({"rv11-reporting-endpoints-direct": out}));
						fail('RV11PROBE ' + JSON.stringify({"rv11-reporting-endpoints-direct": out}));
					}, false);
				</script></body>`);
			} else if (req.url.startsWith("/__proxyreports")) {
				res.writeHead(200, {
					"Content-Type": "application/json",
				});
				res.end(JSON.stringify(reports));
			} else {
				res.writeHead(404);
				res.end();
			}
		});
	},
});
(test as any).timeoutMs = 100000;
export default [test];
