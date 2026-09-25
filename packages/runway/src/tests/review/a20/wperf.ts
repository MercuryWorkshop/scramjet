import { serverTest } from "../../../testcommon.ts";

// rv20: hot paths inside a worker and across the worker boundary. Prints RV20TIME.

const W = String.raw`
const t = (f) => { const s = performance.now(); f(); return Math.round((performance.now() - s) * 10) / 10; };
onmessage = async (e) => {
	if (e.data === "bench") {
		const out = {};
		out.bind100k = t(() => { const f = function () {}; for (let i = 0; i < 100000; i++) f.bind(null); });
		out.stack2k = t(() => { for (let i = 0; i < 2000; i++) new Error("x").stack; });
		out.setTimeout20k = t(() => { for (let i = 0; i < 20000; i++) clearTimeout(setTimeout(() => {}, 1000)); });
		out.request10k = t(() => { for (let i = 0; i < 10000; i++) new Request("a/b?c=" + i); });
		out.response10k = t(() => { for (let i = 0; i < 10000; i++) new Response("x"); });
		out.headers10k = t(() => { for (let i = 0; i < 10000; i++) { const h = new Headers({ a: "1" }); h.get("a"); } });
		out.url100k = t(() => { for (let i = 0; i < 100000; i++) new URL("x" + i, location.href).href; });
		out.locHref100k = t(() => { for (let i = 0; i < 100000; i++) location.href; });
		out.addRemove20k = t(() => { const f = () => {}; for (let i = 0; i < 20000; i++) { self.addEventListener("x", f); self.removeEventListener("x", f); } });
		out.dispatch20k = t(() => { const et = new EventTarget(); et.addEventListener("x", () => {}); for (let i = 0; i < 20000; i++) et.dispatchEvent(new Event("x")); });
		out.fnToString20k = t(() => { for (let i = 0; i < 20000; i++) Function.prototype.toString.call(onmessage); });
		out.newFunction2k = t(() => { for (let i = 0; i < 2000; i++) new Function("a", "return a + " + i); });
		out.eval2k = t(() => { for (let i = 0; i < 2000; i++) eval("1 + " + i); });
		const mc = new MessageChannel();
		out.portRoundtrip5k = await new Promise((res) => { let n = 0; const s = performance.now(); mc.port2.onmessage = (m) => mc.port2.postMessage(m.data); mc.port1.onmessage = (m) => { if (++n === 5000) res(Math.round(performance.now() - s)); else mc.port1.postMessage(n); }; mc.port1.postMessage(0); });
		postMessage(out);
		return;
	}
	if (e.data && e.data.burst) { for (let i = 0; i < e.data.burst; i++) postMessage({ i, payload: e.data.payload }); return; }
	postMessage(e.data);
};`;

export default [
	Object.assign(
		serverTest({
			name: "rv20-wperf",
			autoPass: true,
			js: String.raw`
			const w = new Worker("/wp.js");
			const inner = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.postMessage("bench"); });
			const rt = await new Promise((res) => { let n = 0; const s = performance.now(); w.onmessage = (e) => { if (++n === 5000) res(Math.round(performance.now() - s)); else w.postMessage(n); }; w.postMessage(0); });
			const payload = { a: [1, 2, 3], s: "x".repeat(200), nested: { b: { c: [{ d: 1 }] } } };
			const burst = await new Promise((res) => { let n = 0, reads = 0; const s = performance.now(); w.onmessage = (e) => { reads += e.data.payload.a.length + e.data.i * 0; if (++n === 20000) res(Math.round(performance.now() - s)); }; w.postMessage({ burst: 20000, payload }); });
			const dataReads = await new Promise((res) => { w.onmessage = (e) => { const s = performance.now(); let x = 0; for (let i = 0; i < 100000; i++) x += e.data.a.length; res(Math.round(performance.now() - s)); }; w.postMessage({ a: [1] }); });
			console.log("RV20TIME " + JSON.stringify({ ...inner, pageRoundtrip5k: rt, burst20k: burst, eData100k: dataReads }));
			`,
			start: async (server) => {
				server.on("request", (req: any, res: any) => {
					if (res.headersSent) return;
					const p = (req.url || "/").split("?")[0];
					if (p === "/" || p === "/script.js") return;
					if (p === "/wp.js") {
						res.writeHead(200, {
							"Content-Type": "text/javascript",
						});
						res.end(W);
						return;
					}
					res.writeHead(404);
					res.end();
				});
			},
		}),
		{
			timeoutMs: 120000,
		}
	),
];
