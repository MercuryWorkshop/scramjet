import { serverTest } from "../../../testcommon.ts";

// rv20: MessageEvent getters for messages that did not come through a
// scramjet envelope: synthetic events, BroadcastChannel, SharedWorker connect.

const FILES: Record<string, string> = {
	"/ev.js": `
self.onmessage = async (e) => {
	const out = {};
	const syn = new MessageEvent("message", { data: 5, origin: "https://other.example", lastEventId: "7" });
	out.synthetic = [syn.origin, syn.data, syn.lastEventId, syn.source];
	const syn2 = new MessageEvent("message", { data: 6 });
	out.syntheticNoOrigin = [syn2.origin, syn2.data];
	out.bcOrigin = await new Promise((res) => { const a = new BroadcastChannel("rv20ev"), b = new BroadcastChannel("rv20ev"); b.onmessage = (m) => { res([m.origin, m.data, m.constructor.name]); a.close(); b.close(); }; a.postMessage("x"); setTimeout(() => res("timeout"), 1500); });
	out.dispatched = await new Promise((res) => { const et = new EventTarget(); et.addEventListener("message", (m) => res([m.origin, m.data])); et.dispatchEvent(new MessageEvent("message", { data: "d", origin: "https://third.example" })); });
	postMessage(out);
};`,
	"/sh.js": `onconnect = (e) => { const p = e.ports[0]; p.postMessage([e.origin, e.data, e.source === p, e.ports.length, e.constructor.name, e.lastEventId]); };`,
};

export default [
	serverTest({
		name: "rv20-events",
		autoPass: true,
		js: String.raw`
		const out = {};
		const syn = new MessageEvent("message", { data: 5, origin: "https://other.example", lastEventId: "7", source: window });
		out.synthetic = [syn.origin, syn.data, syn.lastEventId, syn.source === window];
		out.syntheticNoOrigin = [new MessageEvent("message", { data: 6 }).origin];
		out.syntheticEnvelope = [new MessageEvent("message", { data: { $scramjet$messagetype: "worker", $scramjet$data: 1 } }).data];
		out.dispatchedWin = await new Promise((res) => { const f = (m) => { window.removeEventListener("message", f); res([m.origin, m.data, m.isTrusted]); }; window.addEventListener("message", f); window.dispatchEvent(new MessageEvent("message", { data: "d", origin: "https://third.example" })); });
		out.bcOrigin = await new Promise((res) => { const a = new BroadcastChannel("rv20ev2"), b = new BroadcastChannel("rv20ev2"); b.onmessage = (m) => { res([m.origin, m.data]); a.close(); b.close(); }; a.postMessage("x"); setTimeout(() => res("timeout"), 1500); });
		out.worker = await new Promise((res) => { const w = new Worker("/ev.js"); w.onmessage = (e) => res(e.data); w.postMessage(1); setTimeout(() => res("timeout"), 4000); });
		out.connect = await new Promise((res) => { const s = new SharedWorker("/sh.js", "rv20ev"); s.port.onmessage = (e) => res(e.data); setTimeout(() => res("timeout"), 4000); });
		for (const k of Object.keys(out)) assertConsistent("ev." + k, out[k]);
		console.log("RV20DUMP events " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (FILES[p]) {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(FILES[p]);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];
