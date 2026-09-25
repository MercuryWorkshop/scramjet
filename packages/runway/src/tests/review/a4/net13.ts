import { t } from "./net.ts";
/* eslint-disable quotes */
const body = `
	let out;
	try {
		const u = URL.createObjectURL(new Blob(["wk"], { type: "text/plain" }));
		const txt = await (await fetch(u)).text();
		URL.revokeObjectURL(u);
		const ws = typeof WebSocket;
		out = { u, txt, hasMS: typeof MediaSource };
	} catch (e) { out = { err: String(e) }; }
`;
export default [
	t(
		"rv4-m-worker-blob",
		`
		const src = "(async () => { ${body.replace(/\n/g, " ").replace(/"/g, '\\"')} postMessage(out); })();";
		const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
		const d = await new Promise((res, rej) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("worker error " + e.message)); setTimeout(() => rej(new Error("timeout")), 5000); });
		assert(!d.err, "err: " + d.err);
		assertEqual(d.txt, "wk", "blob roundtrip in worker");
		assert(d.u.startsWith("blob:" + location.origin), "origin " + d.u);
	`
	),
	t(
		"rv4-m-sharedworker-blob",
		`
		const src = "onconnect = async (ev) => { const port = ev.ports[0]; ${body.replace(/\n/g, " ").replace(/"/g, '\\"')} port.postMessage(out); };";
		const w = new SharedWorker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
		const d = await new Promise((res, rej) => { w.port.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("worker error")); setTimeout(() => rej(new Error("timeout")), 5000); });
		assert(!d.err, "err: " + d.err);
		assertEqual(d.txt, "wk", "blob roundtrip in sharedworker");
	`
	),
];
