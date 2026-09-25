import { hdrTest } from "./nonce.ts";

const H = {
	"cross-origin-opener-policy": "same-origin",
	"cross-origin-embedder-policy": "require-corp",
	"cross-origin-resource-policy": "cross-origin",
};
const workerSrc = `
onmessage = (e) => {
	const r = { coi: self.crossOriginIsolated, sab: typeof SharedArrayBuffer };
	try { if (e.data && e.data.sab) { const a = new Int32Array(e.data.sab); r.wait = Atomics.wait(a, 0, 0, 50); Atomics.store(a, 1, 7); } } catch (err) { r.waitErr = String(err).slice(0, 80); }
	try { if (e.data && e.data.mem) { r.memShared = e.data.mem.buffer instanceof SharedArrayBuffer; } } catch (err) { r.memErr = String(err).slice(0, 80); }
	postMessage(r);
};`;
const frame = `<!DOCTYPE html><script>parent.postMessage({ k: location.pathname || "x", coi: self.crossOriginIsolated, sab: typeof SharedArrayBuffer }, "*")</script>`;

const js = `
runTest(async () => {
	const out = {};
	out.coi = self.crossOriginIsolated;
	out.sab = typeof SharedArrayBuffer;
	const t = []; for (let i = 0; i < 2000; i++) t.push(performance.now());
	const diffs = t.slice(1).map((v, i) => v - t[i]).filter(d => d > 0);
	out.minTick = diffs.length ? Math.min(...diffs) < 0.05 : null;
	let sab = null, mem = null;
	try { sab = new SharedArrayBuffer(16); } catch (e) { out.sabErr = String(e); }
	try { mem = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }); } catch (e) { out.memErr = String(e).slice(0, 80); }
	const runW = (w, extra) => new Promise(res => { w.onmessage = e => res(e.data); w.onerror = e => res("error " + (e.message || "")); setTimeout(() => res("timeout"), 4000); try { w.postMessage({ sab, mem, ...extra }); } catch (e) { res("postErr " + String(e).slice(0, 90)); } });
	out.worker = await runW(new Worker("/w.js"));
	out.moduleWorker = await runW(new Worker("/w.js", { type: "module" }));
	out.blobWorker = await runW(new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerSrc)}], { type: "text/javascript" }))));
	out.dataWorker = await runW(new Worker("data:text/javascript," + encodeURIComponent(${JSON.stringify(workerSrc)})));
	if (sab) out.sabAfter = new Int32Array(sab)[1];
	const msgs = {};
	addEventListener("message", e => { if (e.data && e.data.k) msgs[e.data.k] = e.data; });
	const mk = (props) => { const f = document.createElement("iframe"); Object.assign(f, props); document.body.append(f); return f; };
	mk({ src: "/f.html" });
	mk({ src: "http://127.0.0.1:" + location.port + "/fx.html" });
	mk({ srcdoc: ${JSON.stringify(frame).replaceAll("</", "<\\/")} });
	const blank = mk({});
	mk({ src: URL.createObjectURL(new Blob([${JSON.stringify(frame.replace("location.pathname", "location.protocol")).replaceAll("</", "<\\/")}], { type: "text/html" })) });
	mk({ src: "data:text/html," + encodeURIComponent(${JSON.stringify(frame).replace("location.pathname", "'data'").replaceAll("</", "<\\/")}) });
	mk({ src: "/nocoep.html" });
	const ob = document.createElement("object"); ob.data = "/obj.html"; document.body.append(ob);
	await new Promise(r => setTimeout(r, 1500));
	try { out.blankCoi = blank.contentWindow.crossOriginIsolated; } catch (e) { out.blankCoi = String(e).slice(0,60); }
	out.frames = msgs;
	out.bc = await new Promise(res => { try { const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data instanceof SharedArrayBuffer); ch.port2.postMessage(sab); setTimeout(() => res("timeout"), 1000); } catch (e) { res("ERR " + e.name); } });
	// window.postMessage of a SAB / shared wasm memory / wasm module to a same-origin frame and back
	const echo = mk({ srcdoc: "<script>onmessage = e => e.source.postMessage({ echo: 1, isSab: e.data.sab instanceof SharedArrayBuffer, memShared: e.data.mem && e.data.mem.buffer instanceof SharedArrayBuffer, mod: e.data.mod instanceof WebAssembly.Module, same: e.data.sab }, '*')<\\/script>" });
	await new Promise(r => setTimeout(r, 600));
	const mod = new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));
	out.winPm = await new Promise(res => { const h = e => { if (e.data && e.data.echo) { removeEventListener("message", h); res({ isSab: e.data.isSab, memShared: e.data.memShared, mod: e.data.mod, backIsSab: e.data.same instanceof SharedArrayBuffer }); } }; addEventListener("message", h); try { echo.contentWindow.postMessage({ sab, mem, mod }, "*"); } catch (e) { res("ERR " + e.name + " " + String(e.message).slice(0, 80)); } setTimeout(() => res("timeout"), 2000); });
	out.selfPm = await new Promise(res => { const h = e => { if (e.data && e.data.self) { removeEventListener("message", h); res(e.data.sab instanceof SharedArrayBuffer); } }; addEventListener("message", h); try { postMessage({ self: 1, sab }, "*"); } catch (e) { res("ERR " + e.name); } setTimeout(() => res("timeout"), 1000); });
	out.bcast = await new Promise(res => { try { const a = new BroadcastChannel("q"), b = new BroadcastChannel("q"); b.onmessage = e => res(e.data instanceof SharedArrayBuffer); b.onmessageerror = () => res("messageerror"); a.postMessage(sab); } catch (e) { res("ERR " + e.name); } setTimeout(() => res("timeout"), 1000); });
	assertConsistent("coi", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-coi",
		routes: {
			"/": {
				headers: H,
				body: `<!DOCTYPE html><body><script>${js}</script></body>`,
			},
			"/w.js": {
				headers: H,
				body: workerSrc,
				type: "text/javascript",
			},
			"/f.html": {
				headers: H,
				body: frame,
			},
			"/fx.html": {
				headers: H,
				body: frame,
			},
			"/nocoep.html": {
				body: frame,
			},
			"/obj.html": {
				headers: H,
				body: frame,
			},
		},
	}),
];
