import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const PR =
	"https://cdn.jsdelivr.net/npm/post-robot@10.0.46/dist/post-robot.min.js";
const CL = "https://cdn.jsdelivr.net/npm/comlink@4.4.1/dist/umd/comlink.min.js";
const PP = "https://cdn.jsdelivr.net/npm/penpal@6.2.2/dist/penpal.min.js";
const IR =
	"https://cdn.jsdelivr.net/npm/iframe-resizer@4.3.9/js/iframeResizer.min.js";
const IRC =
	"https://cdn.jsdelivr.net/npm/iframe-resizer@4.3.9/js/iframeResizer.contentWindow.min.js";
const load = `const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src)); document.head.appendChild(s); });`;
const report = `console.log("RV21", JSON.stringify(R)); for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);`;
const T = (p, ms, label) =>
	Promise.race([
		p,
		new Promise((_, r) =>
			setTimeout(() => r(new Error("timeout " + label)), ms)
		),
	]);

export default [
	withOrigins(
		"rv21-lib-postrobot",
		`
		${PRE}
		${load}
		const T = ${T.toString()};
		const R = {};
		await load("${PR}");
		const f = document.createElement("iframe"); f.src = P[0] + "/child";
		const childReady = new Promise((res) => postRobot.on("ready", { domain: P[0] }, ({ origin, source }) => { res({ origin, sourceOk: source === f.contentWindow }); return "ok"; }));
		document.body.appendChild(f);
		try { R.ready = JSON.stringify(await T(childReady, 10000, "ready")); } catch (e) { R.ready = String(e.message); }
		try {
			const r = await T(postRobot.send(f.contentWindow, "ping", { x: 7 }, { domain: P[0], timeout: 5000 }), 8000, "send");
			R.sendExact = JSON.stringify([r.data, r.origin === P[0], r.source === f.contentWindow]);
		} catch (e) { R.sendExact = "err:" + String(e.message).slice(0, 80); }
		try {
			const r = await T(postRobot.send(f.contentWindow, "ping", { x: 8 }, { timeout: 5000 }), 8000, "send*");
			R.sendStar = JSON.stringify([r.data, r.origin === P[0]]);
		} catch (e) { R.sendStar = "err:" + String(e.message).slice(0, 80); }
		try {
			const r = await T(postRobot.send(f.contentWindow, "ping", { x: 9 }, { domain: "http://wrong.example", timeout: 1500 }), 4000, "sendWrong");
			R.sendWrong = "delivered";
		} catch (e) { R.sendWrong = "rejected"; }
		// child calls back with a function (post-robot serializes functions as cross-window calls)
		try {
			const r = await T(postRobot.send(f.contentWindow, "withfn", { fn: (a) => a * 2 }, { domain: P[0], timeout: 5000 }), 8000, "fn");
			R.fnCall = JSON.stringify(r.data);
		} catch (e) { R.fnCall = "err:" + String(e.message).slice(0, 80); }
		${report}
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><script src="${PR}"></script><script src="/child.js"></script></body>`,
			],
			"/child.js": [
				J,
				`
			postRobot.on("ping", ({ data, origin, source }) => ({ got: data.x, originIsParent: origin.replace(/\d+$/, "N"), sourceIsParent: source === parent }));
			postRobot.on("withfn", async ({ data }) => ({ doubled: await data.fn(21) }));
			postRobot.send(parent, "ready", {}).catch(() => {});
		`,
			],
		}),
		{
			timeoutMs: 60000,
		}
	),
	withOrigins(
		"rv21-lib-comlink",
		`
		${PRE}
		${load}
		const T = ${T.toString()};
		const R = {};
		await load("${CL}");
		const w = new Worker(URL.createObjectURL(new Blob(['importScripts("${CL}"); Comlink.expose({ add: (a, b) => a + b, async cb(f) { return (await f(3)) + 1; }, buf(b) { return Comlink.transfer(b, [b]); }, len(b) { return b.byteLength; } });'], { type: "text/javascript" })));
		const api = Comlink.wrap(w);
		try { R.add = String(await T(api.add(2, 3), 5000, "add")); } catch (e) { R.add = e.message; }
		try { R.cb = String(await T(api.cb(Comlink.proxy((x) => x * 10)), 5000, "cb")); } catch (e) { R.cb = e.message; }
		try { const b = new ArrayBuffer(16); const p = api.len(Comlink.transfer(b, [b])); R.transferNeutered = String(b.byteLength); R.len = String(await T(p, 5000, "len")); } catch (e) { R.len = e.message; }
		// iframe endpoint
		const f = document.createElement("iframe"); f.src = P[0] + "/child";
		const rdy = waitMsg((e) => e.data === "ready", 8000);
		document.body.appendChild(f); await rdy;
		const ifapi = Comlink.wrap(Comlink.windowEndpoint(f.contentWindow, self, P[0]));
		try { R.iframeAdd = String(await T(ifapi.add(4, 5), 5000, "iframeAdd")); } catch (e) { R.iframeAdd = e.message; }
		try { R.iframeCb = String(await T(ifapi.cb(Comlink.proxy((x) => x + 100)), 5000, "iframeCb")); } catch (e) { R.iframeCb = e.message; }
		${report}
	`,
		(mp) => ({
			"/child": [
				H,
				`<!doctype html><body><script src="${CL}"></script><script src="/child.js"></script></body>`,
			],
			"/child.js": [
				J,
				`Comlink.expose({ add: (a, b) => a + b, async cb(f) { return (await f(1)) * 2; } }, Comlink.windowEndpoint(parent, self, "*"));
			parent.postMessage("ready", "*");`,
			],
		}),
		{
			timeoutMs: 60000,
		}
	),
	withOrigins(
		"rv21-lib-penpal",
		`
		${PRE}
		${load}
		const T = ${T.toString()};
		const R = {};
		await load("${PP}");
		const f = document.createElement("iframe"); f.src = P[0] + "/child";
		document.body.appendChild(f);
		const conn = Penpal.connectToChild({ iframe: f, childOrigin: P[0], methods: { hi: (x) => "parent:" + x } });
		try { const child = await T(conn.promise, 10000, "connect"); R.mul = String(await T(child.mul(6, 7), 5000, "mul")); R.back = String(await T(child.callParent(), 5000, "back")); } catch (e) { R.err = String(e.message).slice(0, 100); }
		${report}
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><script src="${PP}"></script><script src="/child.js"></script></body>`,
			],
			"/child.js": [
				J,
				`const c = Penpal.connectToParent({ methods: { mul: (a, b) => a * b, async callParent() { const p = await c.promise; return await p.hi("child"); } } });`,
			],
		}),
		{
			timeoutMs: 60000,
		}
	),
	withOrigins(
		"rv21-lib-iframeresizer",
		`
		${PRE}
		${load}
		const T = ${T.toString()};
		const R = {};
		await load("${IR}");
		const f = document.createElement("iframe"); f.id = "irf"; f.src = P[0] + "/child"; f.style.width = "300px"; f.style.height = "50px";
		document.body.appendChild(f);
		const resized = new Promise((res) => iFrameResize({ log: false, checkOrigin: [P[0]], onResized: (m) => res(m.height) }, f));
		try { R.height = String(Math.round(await T(resized, 10000, "resize")) > 500); } catch (e) { R.height = e.message; }
		${report}
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body style="margin:0"><div style="height:900px">tall</div><script src="${IRC}"></script></body>`,
			],
		}),
		{
			timeoutMs: 60000,
		}
	),
] as Test[];
