import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

// Prints timings (ms) in the failure message; always "fails" so the numbers show.
export default [
	withOrigins(
		"rv21-perf-messages",
		`
		${PRE}
		const out = {};
		const N = 20000;
		const time = async (label, fn) => { const t0 = performance.now(); await fn(); out[label] = Math.round(performance.now() - t0); };
		// 1. self window.postMessage, one listener reading data/origin/source
		await time("self_pm_" + N, () => new Promise((res) => {
			let n = 0; let sum = 0;
			const h = (e) => { sum += e.data.i; if (e.origin && e.source) n++; if (n === N) { removeEventListener("message", h); res(); } };
			addEventListener("message", h);
			for (let i = 0; i < N; i++) postMessage({ i }, "*");
		}));
		// send-only cost
		{ const t0 = performance.now(); for (let i = 0; i < N; i++) postMessage("x", "*"); out["send_only_" + N] = Math.round(performance.now() - t0);
		  await new Promise((r) => setTimeout(r, 500)); }
		// 2. to cross-origin iframe and echoed back
		const f = document.createElement("iframe"); f.src = P[0] + "/echo";
		const rdy = waitMsg((e) => e.data === "ready", 6000);
		document.body.appendChild(f);
		await rdy;
		const w = f.contentWindow;
		const M = 5000;
		await time("iframe_roundtrip_" + M, () => new Promise((res) => {
			let n = 0;
			const h = (e) => { if (e.data && e.data.echo !== undefined) { n++; if (n === M) { removeEventListener("message", h); res(); } } };
			addEventListener("message", h);
			for (let i = 0; i < M; i++) w.postMessage({ ping: i }, P[0]);
		}));
		// 3. MessageChannel ping-pong (comlink-style), sequential
		const mc = new MessageChannel();
		mc.port2.onmessage = (e) => mc.port2.postMessage(e.data);
		const K = 5000;
		await time("mc_pingpong_seq_" + K, () => new Promise((res) => {
			let n = 0;
			mc.port1.onmessage = (e) => { n++; if (n === K) res(); else mc.port1.postMessage({ n }); };
			mc.port1.postMessage({ n: 0 });
		}));
		// 4. MessageChannel burst
		await time("mc_burst_" + N, () => new Promise((res) => {
			let n = 0;
			const c = new MessageChannel();
			c.port2.onmessage = () => { if (++n === N) res(); };
			for (let i = 0; i < N; i++) c.port1.postMessage(i);
		}));
		// 5. worker echo burst
		const wk = new Worker(URL.createObjectURL(new Blob(["onmessage = (e) => postMessage(e.data)"], { type: "text/javascript" })));
		await time("worker_echo_" + N, () => new Promise((res) => {
			let n = 0;
			wk.onmessage = () => { if (++n === N) res(); };
			for (let i = 0; i < N; i++) wk.postMessage({ i });
		}));
		// 6. large payload (8MB typed array, cloned) 20 times to self
		const big = new Float64Array(1 << 20);
		await time("big_8MB_x20", () => new Promise((res) => {
			let n = 0;
			const h = (e) => { if (e.data && e.data.big) { if (++n === 20) { removeEventListener("message", h); res(); } } };
			addEventListener("message", h);
			for (let i = 0; i < 20; i++) postMessage({ big }, "*");
		}));
		// 7. many listeners (10) on self, 5000 messages
		await time("self_10listeners_5000", () => new Promise((res) => {
			let n = 0; const hs = [];
			for (let k = 0; k < 10; k++) { const h = (e) => { if (e.data && e.data.q !== undefined) { if (++n === 50000) { hs.forEach((h) => removeEventListener("message", h)); res(); } } }; hs.push(h); addEventListener("message", h); }
			for (let i = 0; i < 5000; i++) postMessage({ q: i }, "*");
		}));
		fail("PERF " + JSON.stringify(out));
	`,
		() => ({
			"/echo": [
				H,
				`<!doctype html><body><script src="/echo.js"></script></body>`,
			],
			"/echo.js": [
				J,
				`addEventListener("message", (e) => { if (e.data && e.data.ping !== undefined) parent.postMessage({ echo: e.data.ping }, "*"); }); parent.postMessage("ready", "*");`,
			],
		}),
		{
			timeoutMs: 120000,
		}
	),
] as Test[];
