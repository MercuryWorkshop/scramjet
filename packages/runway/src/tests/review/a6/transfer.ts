import { basicTest, type Test } from "../../../testcommon.ts";
const t = (name: string, js: string) =>
	basicTest({
		name: "rv6-tr-" + name,
		js,
	});
export default [
	t(
		"window-set-transfer",
		`
		const ab = new ArrayBuffer(4);
		const p = new Promise((res) => addEventListener("message", (e) => res(e.data), { once: true }));
		postMessage(ab, "*", new Set([ab]));
		assertEqual(ab.byteLength, 0);
		assertEqual((await p).byteLength, 4);
	`
	),
	t(
		"window-options-set-transfer",
		`
		const ab = new ArrayBuffer(4);
		const p = new Promise((res) => addEventListener("message", (e) => res(e.data), { once: true }));
		postMessage(ab, { targetOrigin: "*", transfer: new Set([ab]) });
		assertEqual(ab.byteLength, 0);
		await p;
	`
	),
	t(
		"port-transfer-forms",
		`
		const mc = new MessageChannel();
		const got = [];
		mc.port2.onmessage = (e) => got.push(e.data.byteLength);
		const a = new ArrayBuffer(1), b = new ArrayBuffer(2), c = new ArrayBuffer(3), d = new ArrayBuffer(4);
		mc.port1.postMessage(a, [a]);
		mc.port1.postMessage(b, { transfer: [b] });
		mc.port1.postMessage(c, new Set([c]));
		mc.port1.postMessage(d, null);
		mc.port1.postMessage("x", undefined);
		await new Promise(r => setTimeout(r, 100));
		assertEqual(a.byteLength + b.byteLength + c.byteLength, 0, "detached");
		assertEqual(got.slice(0, 4).join(","), "1,2,3,4");
	`
	),
	t(
		"worker-transfer-forms",
		`
		const w = new Worker(URL.createObjectURL(new Blob(["onmessage = (e) => postMessage(e.data && e.data.byteLength)"], { type: "text/javascript" })));
		const got = [];
		const done = new Promise((res) => { w.onmessage = (e) => { got.push(e.data); if (got.length === 3) res(); }; });
		const a = new ArrayBuffer(1), b = new ArrayBuffer(2), c = new ArrayBuffer(3);
		w.postMessage(a, [a]); w.postMessage(b, { transfer: [b] }); w.postMessage(c, new Set([c]));
		await done;
		assertEqual(got.join(","), "1,2,3");
		w.terminate();
	`
	),
	t(
		"offscreen-canvas-transfer",
		`
		const w = new Worker(URL.createObjectURL(new Blob(["onmessage = (e) => { const c = e.data.canvas; c.getContext('2d'); postMessage(c.width); }"], { type: "text/javascript" })));
		const oc = document.createElement("canvas").transferControlToOffscreen();
		const p = new Promise((res) => w.onmessage = (e) => res(e.data));
		w.postMessage({ canvas: oc }, [oc]);
		assertEqual(await p, 300);
		w.terminate();
	`
	),
	t(
		"stream-transfer",
		`
		const rs = new ReadableStream({ start(c) { c.enqueue("hi"); c.close(); } });
		const mc = new MessageChannel();
		const p = new Promise((res) => mc.port2.onmessage = async (e) => { const r = e.data.getReader(); res((await r.read()).value); });
		mc.port1.postMessage(rs, [rs]);
		assertEqual(await p, "hi");
	`
	),
] as Test[];
