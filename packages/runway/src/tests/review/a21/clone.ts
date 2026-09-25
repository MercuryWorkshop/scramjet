import { basicTest, type Test } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv21-clone-types",
		js: `
		const R = {};
		const norm = (s) => String(s).replace(new RegExp(location.origin.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"), "g"), "SELF").replace(/:\\d+:\\d+/g, ":L:C");
		class K { constructor() { this.a = 1; } m() {} }
		const err = new TypeError("boom", { cause: 5 });
		const payload = { map: new Map([[1, { x: 2 }]]), set: new Set([1, 2]), date: new Date(5), re: /a/gi, err, big: 10n, u8: new Uint8Array([1, 2]), k: new K(), neg0: -0, nan: NaN, undef: undefined, sparse: [1, , 3], $scramjet$data: "inner", $scramjet$messagetype: "window" };
		const via = async (label, send, listenOn) => {
			const e = await new Promise((res) => { listenOn.addEventListener("message", res, { once: true }); send(payload); });
			const d = e.data;
			R[label + "_types"] = JSON.stringify([d.map instanceof Map, d.map.get(1).x, d.set.size, d.date.getTime(), String(d.re), d.err instanceof TypeError, d.err.message, d.err.cause, typeof d.big, d.u8 instanceof Uint8Array, Object.getPrototypeOf(d.k) === Object.prototype, Object.is(d.neg0, -0), Number.isNaN(d.nan), "undef" in d, 1 in d.sparse, d.$scramjet$data, d.$scramjet$messagetype]);
			R[label + "_stack"] = norm(d.err.stack).split("\\n").slice(0, 2).join(" | ");
		};
		await via("window", (p) => postMessage(p, "*"), window);
		const mc = new MessageChannel(); mc.port2.start();
		await via("port", (p) => mc.port1.postMessage(p), mc.port2);
		const w = new Worker(URL.createObjectURL(new Blob(["onmessage = (e) => postMessage(e.data)"], { type: "text/javascript" })));
		await via("worker", (p) => w.postMessage(p), w);
		console.log("RV21", JSON.stringify(R));
		for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);
	`,
	}),
] as Test[];
