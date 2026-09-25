import { serverTest } from "../../../testcommon.ts";

// rv20: constructor surface, subclassing, message plumbing and events for
// workers, compared against bare Chrome.

const FILES: Record<string, string> = {
	"/echo.js": `
self.onmessage = (e) => {
	const d = e.data;
	if (d && d.cmd === "meta") { postMessage({ origin: e.origin, lastEventId: e.lastEventId, source: e.source === null ? "null" : typeof e.source, ports: e.ports.length, isTrusted: e.isTrusted, type: e.type, ctor: e.constructor.name, target: e.target === self, dataType: typeof d }); return; }
	if (d && d.cmd === "transferOpt") { const b = new ArrayBuffer(4); postMessage({ back: b }, { transfer: [b] }); postMessage({ detached: b.byteLength }); return; }
	if (d && d.cmd === "transferArr") { const b = new ArrayBuffer(4); postMessage({ back: b }, [b]); postMessage({ detached: b.byteLength }); return; }
	if (d && d.cmd === "badclone") { try { postMessage(() => 1); postMessage("no throw"); } catch (e) { postMessage(e.name + ":" + e.constructor.name); } return; }
	if (d && d.cmd === "noargs") { try { postMessage(); postMessage("no throw"); } catch (e) { postMessage(e.name); } return; }
	if (d && d.cmd === "blobUrl") { const u = URL.createObjectURL(new Blob(["<svg xmlns='http://www.w3.org/2000/svg' width='3' height='5'></svg>"], { type: "image/svg+xml" })); postMessage(u); return; }
	if (d && d.cmd === "blobText") { const u = URL.createObjectURL(new Blob(["hello-from-worker-blob"], { type: "text/plain" })); postMessage(u); return; }
	if (d && d.cmd === "reject") { self.addEventListener("unhandledrejection", (ev) => { ev.preventDefault(); postMessage({ reason: String(ev.reason), promise: ev.promise instanceof Promise, ctor: ev.constructor.name }); }, { once: true }); Promise.reject(new Error("rj")); return; }
	if (d && d.cmd === "listener") { let n = 0; const f = () => n++; self.addEventListener("message", f); self.addEventListener("message", f); self.removeEventListener("message", f); setTimeout(() => postMessage(n), 50); return; }
	if (d && d.cmd === "throwTop") { setTimeout(() => { throw new RangeError("uncaught-in-worker"); }, 0); return; }
	if (d && d.cmd === "portOpt") { const mc = new MessageChannel(); mc.port1.onmessage = (ev) => postMessage({ via: ev.data }); const b = new ArrayBuffer(2); mc.port2.postMessage({ b }, { transfer: [b] }); return; }
	postMessage(d);
};`,
	"/throws.js": `\n\n\nnull.boom;`,
	"/syntax.js": `let a = ;`,
};

export default [
	serverTest({
		name: "rv20-surface",
		autoPass: true,
		js: String.raw`
		const guard = async (f) => { try { return await f(); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 160); } };
		const msg = (w, ms = 3000) => new Promise((res) => { const t = setTimeout(() => res("timeout"), ms); w.onmessage = (e) => { clearTimeout(t); res(e.data); }; });
		const ask = (w, d, ms) => { const p = msg(w, ms); w.postMessage(d); return p; };
		const out = {};
		for (const C of [Worker, SharedWorker, BroadcastChannel, MessageChannel]) {
			out["shape_" + C.name] = [C.name, C.length, typeof C, C.prototype.constructor === C, Object.getPrototypeOf(C).name, Function.prototype.toString.call(C).includes("[native code]"), Object.getOwnPropertyNames(C.prototype).sort().join(",")];
			out["call_" + C.name] = await guard(() => { C("/echo.js"); return "no throw"; });
		}
		out.subWorker = await guard(async () => { class MyWorker extends Worker { hi() { return "hi"; } } const w = new MyWorker("/echo.js"); const r = [w instanceof MyWorker, w.constructor.name, typeof w.hi, Object.getPrototypeOf(w) === MyWorker.prototype]; const e = await ask(w, "sub"); w.terminate(); return [...r, e]; });
		out.subShared = await guard(async () => { class MyShared extends SharedWorker {} const w = new MyShared("/echo.js", "sub"); return [w instanceof MyShared, Object.getPrototypeOf(w) === MyShared.prototype]; });
		out.subBC = await guard(async () => { class MyBC extends BroadcastChannel { get tag() { return "t"; } } const c = new MyBC("x"); const r = [c instanceof MyBC, c.tag, c.name]; c.close(); return r; });
		out.reflectConstruct = await guard(async () => { function F() {} F.prototype = Object.create(Worker.prototype); const w = Reflect.construct(Worker, ["/echo.js"], F); const r = Object.getPrototypeOf(w) === F.prototype; w.terminate(); return r; });
		const w = new Worker("/echo.js", { name: "e" });
		out.meta = await ask(w, { cmd: "meta" });
		out.transferOpt = await new Promise((res) => { const got = []; w.onmessage = (e) => { got.push(e.data.back ? e.data.back.byteLength : e.data.detached); if (got.length === 2) res(got); }; w.postMessage({ cmd: "transferOpt" }); setTimeout(() => res(got), 3000); });
		out.transferArr = await new Promise((res) => { const got = []; w.onmessage = (e) => { got.push(e.data.back ? e.data.back.byteLength : e.data.detached); if (got.length === 2) res(got); }; w.postMessage({ cmd: "transferArr" }); setTimeout(() => res(got), 3000); });
		out.pageTransferOpt = await guard(async () => { const b = new ArrayBuffer(8); const p = msg(w); w.postMessage({ b }, { transfer: [b] }); const r = await p; return [b.byteLength, r.b.byteLength]; });
		out.pageTransferBad = await guard(async () => { w.postMessage(1, { transfer: [1] }); return "no throw"; });
		out.pageBadClone = await guard(async () => { w.postMessage(Symbol("x")); return "no throw"; });
		out.pageNoArgs = await guard(async () => { w.postMessage(); return "no throw"; });
		out.badclone = await ask(w, { cmd: "badclone" });
		out.noargs = await ask(w, { cmd: "noargs" });
		out.reject = await ask(w, { cmd: "reject" });
		out.listener = await ask(w, { cmd: "listener" });
		out.portOpt = await ask(w, { cmd: "portOpt" });
		out.envelopeLike = await ask(w, { $scramjet$messagetype: "worker", $scramjet$data: 7 });
		out.blobUrlImg = await guard(async () => { const u = await ask(w, { cmd: "blobUrl" }); const img = new Image(); img.src = u; await img.decode(); return [u.slice(0, 5), img.naturalWidth, img.naturalHeight]; });
		out.blobUrlFetch = await guard(async () => { const u = await ask(w, { cmd: "blobText" }); return [new URL(u).origin === location.origin, await (await fetch(u)).text()]; });
		out.blobUrlXhr = await guard(async () => { const u = await ask(w, { cmd: "blobText" }); return await new Promise((res) => { const x = new XMLHttpRequest(); x.open("GET", u); x.onload = () => res(x.responseText); x.onerror = () => res("xhr error"); x.send(); }); });
		out.uncaught = await new Promise((res) => { w.onerror = (e) => { e.preventDefault(); res([e.constructor.name, e.message, e.filename, e.lineno > 0, e.colno > 0, e.error === null ? "null" : typeof e.error]); }; w.postMessage({ cmd: "throwTop" }); setTimeout(() => res("timeout"), 3000); });
		out.topThrow = await new Promise((res) => { const t = new Worker("/throws.js"); t.onerror = (e) => { e.preventDefault(); res([e.constructor.name, e.message, e.filename, e.lineno, e.colno]); }; setTimeout(() => res("timeout"), 3000); });
		out.syntax = await new Promise((res) => { const t = new Worker("/syntax.js"); t.onerror = (e) => { e.preventDefault(); res([e.constructor.name, e.message, e.filename, e.lineno]); }; setTimeout(() => res("timeout"), 3000); });
		out.notFound = await new Promise((res) => { const t = new Worker("/missing.js"); t.onerror = (e) => res([e.constructor.name, e.type, e.message ?? "none"]); setTimeout(() => res("timeout"), 3000); });
		out.badUrl = await guard(async () => { new Worker("http://[x"); return "no throw"; });
		out.crossOrigin = await guard(async () => { new Worker("https://example.com/w.js"); return "no throw"; });
		out.badType = await guard(async () => { new Worker("/echo.js", { type: "wasm" }); return "no throw"; });
		out.windowOnerror = await new Promise((res) => { const prev = window.onerror; window.onerror = (m, f, l) => { window.onerror = prev; res(["window", String(m), f]); return true; }; const t = new Worker("/throws.js"); setTimeout(() => { window.onerror = prev; res("no window.onerror"); }, 2000); });
		out.terminated = await guard(async () => { const t = new Worker("/echo.js"); t.terminate(); t.postMessage(1); const p = msg(t, 500); return await p; });
		for (const k of Object.keys(out)) assertConsistent("s." + k, out[k]);
		console.log("RV20DUMP surface " + JSON.stringify(out));
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
