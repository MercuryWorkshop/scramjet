import http from "http";
import type { AddressInfo } from "node:net";
import { playwrightTest } from "../../../testcommon.ts";

// Serve `pages` on a local server, navigate the proxied frame to "/", and
// report every network response and console message.
function probe(
	name: string,
	pages: Record<string, [string, string]>,
	waitMs = 3000
) {
	return playwrightTest({
		name,
		fn: async ({ page, navigate }) => {
			const server = http.createServer((req, res) => {
				const p = pages[req.url!];
				if (!p) {
					res.writeHead(404);
					res.end("nf");
					return;
				}
				res.writeHead(200, {
					"content-type": p[0],
					"access-control-allow-origin": "*",
				});
				res.end(p[1]);
			});
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as AddressInfo).port;
			const log: string[] = [];
			page.on("response", (r) => {
				if (!/scramjet|wasm|harness|\/sw|controller|favicon/.test(r.url()))
					log.push(
						`RESP ${r.status()} ${decodeURIComponent(r.url()).slice(-90)}`
					);
			});
			page.on("console", (m) =>
				log.push(`CONSOLE ${m.type()} ${m.text().slice(0, 300)}`)
			);
			page.on("pageerror", (e) => log.push(`PAGEERROR ${e.message}`));
			await navigate(`http://localhost:${port}/`);
			await new Promise((r) => setTimeout(r, waitMs));
			server.close();
			throw new Error(
				"PROBE-LOG\n" +
					log.filter((l) => !/\[scramjet\]|DevTools/.test(l)).join("\n")
			);
		},
	});
}

export default [
	probe("rv3-pw-importmap-prefix", {
		"/": [
			"text/html",
			`<!doctype html><script type="importmap">{"imports":{"lib/":"/lib/","a":"/lib/a.js"}}</script><script type="module">import b from "lib/sub/b.js"; console.log("B=" + b); import("a").then(m => console.log("dynA=" + m.default), e => console.log("dynA ERR " + e));</script>`,
		],
		"/lib/a.js": ["text/javascript", "export default 'A';"],
		"/lib/sub/b.js": ["text/javascript", "export default 'B';"],
	}),
	probe("rv3-pw-importmap-js-inserted", {
		"/": [
			"text/html",
			`<!doctype html><script>const m = document.createElement("script"); m.type = "importmap"; m.textContent = JSON.stringify({imports: {a: "/lib/a.js"}}); document.head.append(m);</script><script type="module">import("a").then(m => console.log("dynA=" + m.default), e => console.log("dynA ERR " + e)); console.log("maptext=" + document.querySelector("script[type=importmap]").textContent);</script>`,
		],
		"/lib/a.js": ["text/javascript", "export default 'A';"],
	}),
];
