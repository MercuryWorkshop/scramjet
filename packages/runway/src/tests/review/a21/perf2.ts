import { basicTest, type Test } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv21-perf2-send",
		js: `
		const out = {};
		const N = 50000;
		const t = (label, fn) => { fn(); const t0 = performance.now(); fn(); out[label] = +((performance.now() - t0) / N * 1000).toFixed(2); };
		const wk = new Worker(URL.createObjectURL(new Blob(["onmessage = () => {}"], { type: "text/javascript" })));
		t("worker_send_us", () => { for (let i = 0; i < N; i++) wk.postMessage(i); });
		t("worker_send_transferArr_us", () => { for (let i = 0; i < N; i++) wk.postMessage(i, []); });
		t("worker_send_opts_us", () => { for (let i = 0; i < N; i++) wk.postMessage(i, { transfer: [] }); });
		const mc = new MessageChannel(); mc.port2.onmessage = () => {};
		t("port_send_us", () => { for (let i = 0; i < N; i++) mc.port1.postMessage(i); });
		const bc = new BroadcastChannel("rv21"); 
		t("bc_send_us", () => { for (let i = 0; i < N; i++) bc.postMessage(i); });
		{ const M = 1000; const t0 = performance.now(); for (let i = 0; i < M; i++) postMessage(i, "*"); out.win_send_us = +((performance.now() - t0) / M * 1000).toFixed(2); }
		// dispatch cost of synthetic events through wrapped listeners
		const d = document.createElement("div"); let c = 0; d.addEventListener("x", () => c++);
		const ev = new Event("x");
		t("dispatch_synthetic_us", () => { for (let i = 0; i < N; i++) d.dispatchEvent(ev); });
		await new Promise((r) => setTimeout(r, 1500));
		fail("PERF2 " + JSON.stringify(out));
	`,
	}),
] as Test[];
