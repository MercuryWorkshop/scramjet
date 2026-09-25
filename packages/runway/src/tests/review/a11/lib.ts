import { serverTest } from "../../../testcommon.ts";

export function probeTest(props: {
	name: string;
	probes: Record<string, string>;
	head?: string;
	body?: string;
	path?: string;
	extra?: (req: any, res: any) => boolean;
	timeout?: number;
}) {
	const path = props.path ?? "/deep/dir/page.html";
	const body = `
		const probes = {${Object.entries(props.probes)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {};
		for (const [k, v] of Object.entries(probes)) {
			try {
				const res = await Promise.race([v(), new Promise(r=>setTimeout(()=>r('TIMEOUT'), ${props.timeout ?? 3000}))]);
				out[k] = JSON.stringify(res);
			} catch (e) {
				out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message);
			}
		}
		console.log('RV11PROBE ' + JSON.stringify({${JSON.stringify(props.name)}: out}));
		fail('RV11PROBE ' + JSON.stringify({${JSON.stringify(props.name)}: out}));
	`;
	return serverTest({
		name: props.name,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (props.extra && props.extra(req, res)) return;
				if (req.url === "/") {
					res.writeHead(302, {
						Location: path,
					});
					res.end();
				} else if (req.url && req.url.split("?")[0] === path) {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<!doctype html><html><head>${props.head ?? ""}</head><body><p id=p>hi</p>${props.body ?? ""}<script src="/__probe.js"></script></body></html>`
					);
				} else if (req.url === "/__probe.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`runTest(async () => {${body}}, false);`);
				} else if (req.url.startsWith("/echo")) {
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Access-Control-Allow-Origin": "*",
					});
					res.end(req.url);
				} else if (req.url.endsWith(".js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`window.__loaded = (window.__loaded||[]); window.__loaded.push(${JSON.stringify(req.url)});`
					);
				} else {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("path:" + req.url);
				}
			});
		},
	});
}
