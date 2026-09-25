import { serverTest } from "../../../testcommon.ts";

// rv20: event handler attributes on workers and worker globals

const W = String.raw`
const f = (e) => {
	if (e.data === "identity") { postMessage([self.onmessage === f, typeof self.onerror, self.onmessageerror, Object.getOwnPropertyDescriptor(self, "onmessage") ? "own" : "proto"]); return; }
	if (e.data === "suppress") { self.onerror = () => true; setTimeout(() => { throw new Error("suppressed"); }, 0); setTimeout(() => postMessage("after-suppress"), 50); return; }
	if (e.data === "prevent") { self.onerror = null; self.addEventListener("error", (ev) => ev.preventDefault(), { once: true }); setTimeout(() => { throw new Error("prevented"); }, 0); setTimeout(() => postMessage("after-prevent"), 50); return; }
	if (e.data === "unsuppressed") { self.onerror = () => false; setTimeout(() => { throw new Error("loud"); }, 0); setTimeout(() => postMessage("after-loud"), 50); return; }
	if (e.data === "nullify") { self.onmessage = null; setTimeout(() => postMessage("nullified"), 0); return; }
};
self.onmessage = f;`;

export default [
	serverTest({
		name: "rv20-handlers",
		autoPass: true,
		js: String.raw`
		const out = {};
		const w = new Worker("/h.js");
		const errs = [];
		w.onerror = (e) => { errs.push(e.message.replace(/^Uncaught /, "")); e.preventDefault(); };
		const next = () => new Promise((res) => { const g = w.onmessage; w.onmessage = (e) => { w.onmessage = g; res(e.data); }; setTimeout(() => res("timeout"), 3000); });
		let p = next(); w.postMessage("identity"); out.identity = await p;
		p = next(); w.postMessage("suppress"); out.suppress = await p;
		p = next(); w.postMessage("prevent"); out.prevent = await p;
		p = next(); w.postMessage("unsuppressed"); out.loud = await p;
		await new Promise((r) => setTimeout(r, 100));
		out.errsSeenByPage = errs.slice();
		p = next(); w.postMessage("nullify"); out.nullify = await p;
		p = next(); w.postMessage("identity"); out.afterNull = await Promise.race([p, new Promise((r) => setTimeout(() => r("no reply"), 800))]);
		const h = () => {};
		w.onmessage = h;
		out.pageIdentity = [w.onmessage === h, w.onerror !== null, typeof w.onmessageerror];
		const sw = new SharedWorker("data:text/javascript,onconnect=(e)=>e.ports[0].postMessage('hi')");
		out.portImplicitStart = await new Promise((res) => { sw.port.onmessage = (e) => res(e.data); setTimeout(() => res("timeout"), 3000); });
		const sw2 = new SharedWorker("data:text/javascript,onconnect=(e)=>e.ports[0].postMessage('hi2')");
		out.portNeedsStart = await new Promise((res) => { sw2.port.addEventListener("message", (e) => res(e.data)); setTimeout(() => res("not started"), 1500); });
		for (const k of Object.keys(out)) assertConsistent("h." + k, out[k]);
		console.log("RV20DUMP handlers " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (p === "/h.js") {
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
];
