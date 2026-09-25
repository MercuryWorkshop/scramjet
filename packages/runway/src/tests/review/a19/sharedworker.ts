import { serverTest } from "../../../testcommon.ts";

// rv19: SharedWorker instances must be shared by every same-origin document
// that constructs the same (URL, name) - across tabs, frames and SPA routes.

const route = (server: any) =>
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		if (path === "/sw.js") {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
			});
			res.end(`const inst = Math.random().toString(36).slice(2); let n = 0;
				onconnect = (e) => { n++; e.ports[0].postMessage({ inst, n }); };`);
			return;
		}
		if (path === "/other/page.html") {
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(`<!doctype html><script>
				const w = new SharedWorker("/sw.js", "rv19");
				w.port.onmessage = (e) => opener.__rv19sw(e.data);
			</script>`);
			return;
		}
		res.writeHead(404);
		res.end();
	});

export default [
	serverTest({
		name: "rv19-sharedworker-shared-across-pages",
		autoPass: true,
		js: `
			const connect = () => new Promise((res) => { const w = new SharedWorker("/sw.js", "rv19"); w.port.onmessage = (e) => res(e.data); setTimeout(() => res("timeout"), 4000); });
			const a = await connect();
			const b = await connect();
			assertEqual(b.inst, a.inst, "same page, second connect shares the instance");
			// SPA route change
			history.pushState(null, "", "/app/route?x=1");
			const c = await connect();
			// another top-level page of the same origin (a second tab)
			const d = await new Promise((res) => { window.__rv19sw = res; window.open("/other/page.html", "_blank"); setTimeout(() => res("timeout"), 5000); });
			const out = { afterPushState: c.inst === a.inst, otherTab: d.inst === a.inst, n: d.n };
			assertConsistent("shared", out);
			assertEqual(out.afterPushState, true, "SharedWorker after pushState is a new instance");
			assertEqual(out.otherTab, true, "SharedWorker from another tab of the same origin is a new instance");
		`,
		start: async (server) => route(server),
	}),
];
