import http from "http";
import type { AddressInfo } from "node:net";
import { serverTest } from "../../../testcommon.ts";

let xport = 0;
let log: string[] = [];
const policies = [
	"",
	"no-referrer",
	"origin",
	"unsafe-url",
	"strict-origin-when-cross-origin",
	"same-origin",
	"origin-when-cross-origin",
	"no-referrer-when-downgrade",
	"strict-origin",
];

export default [
	Object.assign(
		serverTest({
			name: "rv7-referrerpolicy-load",
			start: async (server) => {
				const xs = http.createServer((req, res) => {
					log.push(req.url + " ref=" + (req.headers.referer || "-"));
					if (req.url!.startsWith("/s")) {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							`window.__loaded = (window.__loaded||[]).concat(${JSON.stringify(req.url)});`
						);
					} else if (req.url!.startsWith("/i")) {
						res.writeHead(200, {
							"Content-Type": "image/gif",
						});
						res.end(
							Buffer.from(
								"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
								"base64"
							)
						);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
				await new Promise<void>((r) => xs.listen(0, () => r()));
				xport = (xs.address() as AddressInfo).port;
				server.on("close", () => xs.close());
				server.on("request", (req, res) => {
					if (req.url === "/") {
						log = [];
						const X = `http://localhost:${xport}`;
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<!doctype html><html><head>
${policies.map((p, i) => `<script src="${X}/s-markup-${i}.js" ${p ? `referrerpolicy="${p}"` : ""} onerror="window.__err=(window.__err||[]).concat('markup-${i}')"></script>`).join("\n")}
</head><body>
${policies.map((p, i) => `<img id="im${i}" src="${X}/i-${i}.gif" ${p ? `referrerpolicy="${p}"` : ""}>`).join("\n")}
<script>
runTest(async () => {
	const pol = ${JSON.stringify(policies)};
	for (let i = 0; i < pol.length; i++) {
		await new Promise(r => { const s = document.createElement('script'); s.src = '${X}/s-js-' + i + '.js'; if (pol[i]) s.referrerPolicy = pol[i]; s.onload = r; s.onerror = () => { window.__err = (window.__err||[]).concat('js-' + i); r(); }; document.head.appendChild(s); });
	}
	await new Promise(r => setTimeout(r, 300));
	const imgs = pol.map((p, i) => document.getElementById('im' + i).naturalWidth);
	const R = { __marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare', loaded: JSON.stringify((window.__loaded||[]).sort()), err: JSON.stringify(window.__err||[]), imgs: JSON.stringify(imgs), log: JSON.stringify((await (await fetch('/__log')).json()).map(x => x.replace(/localhost:\\d+/g, 'L').replace(/~\\/sj\\/[a-z0-9]+\\/[a-z0-9]+\\/[^ ]*/, '~/sj/PROXY')).sort()) };
	console.log('RV7PROBE ' + JSON.stringify(R));
	fail('done');
}, false);
</script></body></html>`);
						return;
					}
					if (req.url === "/__log") {
						res.writeHead(200, {
							"Content-Type": "application/json",
						});
						res.end(JSON.stringify(log));
						return;
					}
				});
			},
		}),
		{
			timeoutMs: 60000,
		}
	),
];
