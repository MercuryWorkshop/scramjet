import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

export default [
	withOrigins(
		"rv21-order-and-slash",
		`
		${PRE}
		const R = {};
		const N = 5000;
		// ordering across window + port, interleaved, with transfers every 100th
		const mc = new MessageChannel();
		const seq = [];
		const done = new Promise((res) => {
			const h = (e) => { if (e.data && e.data.q !== undefined) { seq.push(e.data.q); if (seq.length === N) res(); } };
			addEventListener("message", h);
			mc.port2.onmessage = h;
		});
		for (let i = 0; i < N; i++) {
			const ab = new ArrayBuffer(8);
			if (i % 2) mc.port1.postMessage({ q: i, ab }, i % 100 === 1 ? [ab] : []);
			else postMessage({ q: i, ab }, "*", i % 100 === 0 ? [ab] : []);
		}
		await Promise.race([done, new Promise((r) => setTimeout(r, 8000))]);
		const w = seq.filter((x) => x % 2 === 0), p = seq.filter((x) => x % 2 === 1);
		R.count = String(seq.length);
		R.windowOrdered = String(w.every((x, i) => i === 0 || x > w[i - 1]));
		R.portOrdered = String(p.every((x, i) => i === 0 || x > p[i - 1]));
		// "/" from a cross-origin child must be dropped, from a same-origin child delivered
		const got = [];
		addEventListener("message", (e) => { if (e.data && e.data.slash) got.push(e.data.slash); });
		const a = document.createElement("iframe"); a.src = P[0] + "/slash?k=cross";
		const b = document.createElement("iframe"); b.src = "/slash?k=same";
		document.body.append(a, b);
		await new Promise((r) => setTimeout(r, 2000));
		R.slash = got.sort().join(",");
		console.log("RV21", JSON.stringify(R));
		for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);
	`,
		() => ({
			"/slash": [
				H,
				`<!doctype html><script>parent.postMessage({ slash: new URLSearchParams(location.search).get("k") }, "/"); parent.postMessage({ slash: new URLSearchParams(location.search).get("k") + "-star" }, "*");</script>`,
			],
		}),
		{
			mainFiles: () => ({
				"/slash": [
					H,
					`<!doctype html><script>parent.postMessage({ slash: new URLSearchParams(location.search).get("k") }, "/"); parent.postMessage({ slash: new URLSearchParams(location.search).get("k") + "-star" }, "*");</script>`,
				],
			}),
		}
	),
] as Test[];
