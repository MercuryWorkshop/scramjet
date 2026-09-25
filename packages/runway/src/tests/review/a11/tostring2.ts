import { serverTest } from "../../../testcommon.ts";

const SRC = {
	a1: "(x) => location.pathname + x",
	a2: "(x) => x + location.pathname",
	a3: "(x) => location",
	a4: "(x) => { return location.pathname }",
	a5: "x => x + 1",
	a6: "(x) => top",
	a7: "(x) => eval(x)",
	a8: "(x) => import(x)",
	a9: "async (x) => (await fetch(location.href)).status",
	a10: "(x) => ({ l: location })",
	a11: "(x) => window.location.href",
	a12: "(x) => parent.postMessage(x, '*')",
	f1: "function (x) { return location }",
	f2: "function (x) { return top.location.href }",
	m1: "({ m() { return location.href } }).m",
	c1: "class { static s = location.href; m() { return location } }",
	g1: "function* () { yield location }",
	o1: "(x) => { const {location: l} = window; return l }",
	n1: "function (e) { const f = x => x + 1; const g = (a, b) => a * b; return f(e) + g(e, 2) }",
	n2: "function (e) { return [1,2].map(x => x + e) }",
	n3: "(e) => { return [1,2].map(x => x + e) }",
	n4: "async function (e) { return await Promise.all([e].map(async x => x)) }",
};

export default [
	serverTest({
		name: "rv11-fn-tostring-variants",
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><head><script src="/ext.js"></script></head><body><script>
					runTest(async () => {
						const SRC = ${JSON.stringify(SRC)};
						const out = {};
						for (const k in SRC) {
							const s = String(window.F[k]);
							out[k] = s === SRC[k] ? 'same' : s;
						}
						// inline worker via arrow toString
						out.worker = await new Promise(r => {
							const w = new Worker(URL.createObjectURL(new Blob(['(' + window.F.w + ')()'], {type: 'text/javascript'})));
							w.onmessage = e => r(e.data); w.onerror = e => r('ERROR ' + e.message); setTimeout(() => r('TIMEOUT'), 5000);
						});
						out.newFn = (() => { try { return typeof new Function('return ' + String(window.F.a1))(); } catch (e) { return 'THROW ' + e; } })();
						console.log('RV11PROBE ' + JSON.stringify({"rv11-fn-tostring-variants": out}));
						fail('RV11PROBE ' + JSON.stringify({"rv11-fn-tostring-variants": out}));
					}, false);
					</script></body>`);
				} else if (path === "/ext.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`window.F = {\n${Object.entries(SRC)
							.map(([k, v]) => `${k}: ${v}`)
							.join(",\n")},\nw: () => postMessage(location.protocol)\n};`
					);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
