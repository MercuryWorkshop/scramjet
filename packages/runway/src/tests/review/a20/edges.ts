import { serverTest, basicTest } from "../../../testcommon.ts";

// rv20: argument-shape edges and blob: plumbing between page and worker.

const WORKER = String.raw`
const guard = async (f, ms = 4000) => { try { return await Promise.race([Promise.resolve().then(f), new Promise((r) => setTimeout(() => r("timeout"), ms))]); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 160); } };
onmessage = async (e) => {
	const { pageBlob, pageScriptBlob } = e.data;
	const out = {};
	out.fetchPageBlob = await guard(async () => (await fetch(pageBlob)).text());
	out.importPageBlob = await guard(() => { importScripts(pageScriptBlob); return self.fromPageBlob; });
	out.ownBlobImport = await guard(() => { const u = URL.createObjectURL(new Blob(["self.ownBlob = 'own'"], { type: "text/javascript" })); importScripts(u); return self.ownBlob; });
	out.ownBlobFetchToBlobImport = await guard(async () => { const b = await (await fetch("lib.js")).blob(); const u = URL.createObjectURL(b); importScripts(u); return self.libv; });
	out.nestedFromPageBlob = await guard(() => new Promise((res) => { const w = new Worker(pageScriptBlob); w.onmessage = (m) => res(m.data); w.onerror = (m) => res("error " + m.message); }));
	out.isLen = [importScripts.length, importScripts.name, Function.prototype.toString.call(importScripts).includes("[native code]")];
	out.originAssign = await guard(() => { "use strict"; self.origin = "x"; return self.origin; });
	out.originAssignSloppy = await guard(() => (0, eval)("self.origin = 'y'; self.origin"));
	out.stThis = await guard(() => new Promise((r) => setTimeout(function () { r(this === self); }, 1)));
	out.trusted = await guard(() => { if (!self.trustedTypes) return "no tt"; const p = trustedTypes.createPolicy("rv20w", { createScriptURL: (s) => s }); importScripts(p.createScriptURL("lib2.js")); return self.lib2v; });
	out.latin1 = await guard(() => { importScripts("latin1.js"); return self.latin1v; });
	out.revoke = await guard(() => { URL.revokeObjectURL("not a blob"); return "ok"; });
	postMessage(out);
};`;

const edgesList = [
	serverTest({
		name: "rv20-edges",
		autoPass: true,
		js: String.raw`
		const guard = async (f) => { try { return await f(); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 160); } };
		const out = {};
		const conn = (sw) => new Promise((res) => { sw.port.onmessage = (e) => res(e.data); sw.onerror = () => res("sw error"); setTimeout(() => res("timeout"), 3000); });
		out.swNumberName = await guard(async () => conn(new SharedWorker("/name.js", 5)));
		out.swNullOpts = await guard(async () => conn(new SharedWorker("/name.js", null)));
		out.swObjName = await guard(async () => conn(new SharedWorker("/name.js", { name: 7 })));
		out.swToStringName = await guard(async () => conn(new SharedWorker("/name.js", { toString() { return "ts"; } })));
		out.wNullOpts = await guard(async () => { const w = new Worker("/lib.js", null); w.terminate(); return "ok"; });
		out.wNameNum = await guard(async () => { const w = new Worker("/wname.js", { name: 9 }); return await new Promise((r) => { w.onmessage = (e) => r(e.data); }); });
		out.wUrlObj = await guard(async () => { const w = new Worker(new URL("/wname.js", location.href)); return await new Promise((r) => { w.onmessage = (e) => r(e.data); }); });
		out.wTrusted = await guard(async () => { if (!window.trustedTypes) return "no tt"; const p = trustedTypes.createPolicy("rv20", { createScriptURL: (s) => s }); const w = new Worker(p.createScriptURL("/wname.js")); return await new Promise((r) => { w.onmessage = (e) => r(e.data); }); });
		out.originAssignWin = await guard(() => { "use strict"; window.origin = "x"; return window.origin; });
		const pageBlob = URL.createObjectURL(new Blob(["page-blob-text"], { type: "text/plain" }));
		const pageScriptBlob = URL.createObjectURL(new Blob(["self.fromPageBlob = 'pb'; if (typeof importScripts === 'function' && self.name === '') postMessage && self.postMessage && (self.onmessage === null) && postMessage('nested-ok');"], { type: "text/javascript" }));
		const w = new Worker("/w/edge.js");
		const r = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error " + e.message); w.postMessage({ pageBlob, pageScriptBlob }); setTimeout(() => res("timeout"), 20000); });
		Object.assign(out, typeof r === "object" ? r : { worker: r });
		for (const k of Object.keys(out)) assertConsistent("e." + k, out[k]);
		console.log("RV20DUMP edges " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				const js = (s: string, ct = "text/javascript") => {
					res.writeHead(200, {
						"Content-Type": ct,
					});
					res.end(s);
				};
				if (p === "/w/edge.js") return js(WORKER);
				if (p === "/name.js")
					return js("onconnect = (e) => e.ports[0].postMessage(self.name);");
				if (p === "/wname.js")
					return js("postMessage([self.name, location.pathname]);");
				if (p === "/lib.js" || p === "/w/lib.js")
					return js("self.libv = 'lib';");
				if (p === "/w/lib2.js") return js("self.lib2v = 'lib2';");
				if (p === "/w/latin1.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript; charset=iso-8859-1",
					});
					res.end(
						Buffer.from([
							...Buffer.from("self.latin1v = '"),
							0xe9,
							...Buffer.from("';"),
						])
					);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];

const unions = basicTest({
	name: "rv20-unions",
	js: String.raw`
	const guard = async (f) => { try { return await f(); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 120); } };
	const out = {};
	out.append = await guard(() => { const d = document.createElement("div"); d.append(5, true, null); d.prepend(1n); return d.textContent; });
	out.ael = await guard(() => { let n = 0; const f = () => n++; const t = new EventTarget(); t.addEventListener("x", f, 1); t.addEventListener("x", f, 0); t.dispatchEvent(new Event("x")); t.removeEventListener("x", f, 1); t.dispatchEvent(new Event("x")); return n; });
	out.cacheNum = await guard(async () => { const c = await caches.open("rv20u"); await c.put(String(5), new Response("n")); const r = await c.match(5); return r ? await r.text() : "miss"; });
	out.cookieNum = await guard(async () => { if (!window.cookieStore) return "none"; await cookieStore.set(55, "v"); const c = await cookieStore.get(55); return c && c.value; });
	out.bcNum = await guard(() => { const b = new BroadcastChannel(5); const n = b.name; b.close(); return n; });
	out.wsProto = await guard(() => { const s = new WebSocket("ws://" + location.host + "/", 5); s.close(); return s.url.replace(/:\d+/, ":P"); });
	out.animate = await guard(() => { const d = document.createElement("div"); document.body.append(d); const a = d.animate([{ opacity: 0 }, { opacity: 1 }], 300); return a.effect.getTiming().duration; });
	for (const k of Object.keys(out)) assertConsistent("u." + k, out[k]);
	console.log("RV20DUMP unions " + JSON.stringify(out));
	`,
});

export default [...edgesList, unions];
