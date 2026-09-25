import { serverTest } from "../../../testcommon.ts";

// rv20: worker scripts behind redirects (versioned-asset / CDN redirects)

export default [
	serverTest({
		name: "rv20-worker-redirect",
		autoPass: true,
		js: String.raw`
		const ask = (w) => new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error:" + (e.message || e.type)); setTimeout(() => res("timeout"), 4000); });
		const out = {};
		out.sameOrigin = await ask(new Worker("/old/w.js"));
		out.shared = await new Promise((res) => { const s = new SharedWorker("/old/s.js"); s.port.onmessage = (e) => res(e.data); s.onerror = () => res("error"); setTimeout(() => res("timeout"), 4000); });
		out.importRedirect = await ask(new Worker("/v2/imp.js"));
		for (const k of Object.keys(out)) assertConsistent("r." + k, out[k]);
		console.log("RV20DUMP redirect " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				const js = (s: string) => {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(s);
				};
				if (p === "/old/w.js") {
					res.writeHead(302, {
						Location: "/v2/w.js",
					});
					res.end();
					return;
				}
				if (p === "/old/s.js") {
					res.writeHead(302, {
						Location: "/v2/s.js",
					});
					res.end();
					return;
				}
				if (p === "/v2/w.js")
					return js(
						`fetch("rel.txt").then((r) => r.text()).then((t) => { importScripts("lib.js"); postMessage([location.href, t, self.libwhere]); }, (e) => postMessage("fetch failed " + e));`
					);
				if (p === "/v2/s.js")
					return js(
						`onconnect = (e) => fetch("rel.txt").then((r) => r.text()).then((t) => e.ports[0].postMessage([location.href, t]));`
					);
				if (p === "/v2/rel.txt") {
					res.writeHead(200);
					res.end("v2-rel");
					return;
				}
				if (p === "/old/rel.txt") {
					res.writeHead(200);
					res.end("old-rel");
					return;
				}
				if (p === "/v2/lib.js") return js(`self.libwhere = "v2";`);
				if (p === "/old/lib.js") return js(`self.libwhere = "old";`);
				if (p === "/v2/imp.js")
					return js(
						`importScripts("/moved.js"); postMessage([self.moved, self.movedHref]);`
					);
				if (p === "/moved.js") {
					res.writeHead(301, {
						Location: "/v3/moved.js",
					});
					res.end();
					return;
				}
				if (p === "/v3/moved.js")
					return js(
						`self.moved = "v3"; try { null.x } catch (e) { self.movedHref = /v3\/moved\.js/.test(e.stack); }`
					);
				res.writeHead(404);
				res.end();
			});
		},
	}),
];
