import { serverTest } from "../../../testcommon.ts";

// rv20: what code inside each kind of worker sees, compared across main, dev
// and bare Chrome. One probe script, run in many worker kinds.

const WASM = Buffer.from([
	0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00,
	0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x05, 0x01, 0x01, 0x66, 0x00, 0x00,
	0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x2a, 0x0b,
]);

// The probe body. `ORIGIN_BASE` is replaced by the absolute origin of the
// test server for workers whose own base can't resolve relative URLs.
export const PROBE = String.raw`
const R = {};
const T = (ms) => new Promise((r) => setTimeout(() => r("timeout"), ms));
const run = async (k, f, ms = 3000) => {
	try { R[k] = await Promise.race([Promise.resolve().then(f), T(ms)]); }
	catch (e) { R[k] = "ERR " + (e && e.name) + ": " + String(e && e.message).slice(0, 160); }
};
const isModule = typeof importScripts !== "function" || (() => { try { importScripts(); return false; } catch { return true; } })();
async function probe(extra) {
	await run("href", () => location.href);
	await run("origin", () => self.origin);
	await run("locOrigin", () => location.origin);
	await run("name", () => self.name);
	await run("search", () => location.search + "|" + location.hash);
	await run("ownFetch", () => Object.prototype.hasOwnProperty.call(self, "fetch"));
	await run("ownSetTimeout", () => Object.prototype.hasOwnProperty.call(self, "setTimeout"));
	await run("ownImportScripts", () => Object.prototype.hasOwnProperty.call(self, "importScripts"));
	await run("ownOrigin", () => Object.prototype.hasOwnProperty.call(self, "origin"));
	await run("fetchLen", () => fetch.length + ":" + fetch.name);
	await run("stLen", () => setTimeout.length + ":" + setTimeout.name);
	if (!isModule) {
		await run("importRel", () => { importScripts("lib1.js", "./lib2.js"); return [self.lib1, self.lib2]; });
		await run("importAbs", () => { importScripts(ORIGIN_BASE + "/lib-root.js"); return self.libroot; });
		await run("importRootRel", () => { importScripts("/lib-root.js"); return self.libroot; });
		await run("import404", () => { importScripts("nope.js"); return "no throw"; });
		await run("importBad", () => { importScripts("http://[bad"); return "no throw"; });
		await run("importNone", () => { importScripts(); return "ok"; });
		await run("importUrlObj", () => { importScripts(new URL(ORIGIN_BASE + "/w/lib3.js")); return self.lib3; });
		await run("importThrows", () => { try { importScripts("thrower.js"); } catch (e) { return e.name + ":" + e.message; } return "no throw"; });
		await run("importData", () => { importScripts("data:text/javascript,self.libdata=5"); return self.libdata; });
	}
	await run("fetchRel", async () => (await fetch("rel.txt")).text());
	await run("fetchRelUrl", async () => { const r = await fetch("rel.txt"); return r.url; });
	await run("fetchRoot", async () => (await fetch("/rel.txt")).text());
	await run("reqUrl", () => new Request("rel.txt").url);
	await run("xhrRel", () => new Promise((res) => { const x = new XMLHttpRequest(); x.open("GET", "rel.txt"); x.onload = () => res(x.responseText + "|" + x.responseURL); x.onerror = () => res("xhr error"); x.send(); }));
	await run("urlBase", () => new URL("x", location.href).href);
	await run("perfOrigin", () => typeof performance.timeOrigin + ":" + (performance.timeOrigin > 1e12) + ":" + (performance.now() >= 0));
	await run("perfEntries", () => performance.getEntriesByType("resource").map((e) => e.name.replace(/\?.*/, "")).filter((n) => /rel\.txt|lib/.test(n)).sort());
	await run("perfByName", () => performance.getEntriesByName(new URL("rel.txt", location.href).href).length);
	await run("stArgs", () => new Promise((r) => setTimeout((a, b) => r(a + b), 1, 2, 3)));
	await run("stString", () => new Promise((r) => { self.__str = r; setTimeout("self.__str(typeof location + ':' + location.pathname)", 1); }));
	await run("siArgs", () => new Promise((r) => { let n = 0; const id = setInterval((x) => { if (++n === 2) { clearInterval(id); r(x + n); } }, 1, 10); }));
	await run("stCall", () => new Promise((r) => self.setTimeout.call(self, () => r("ok"), 1)));
	await run("stCallUndef", () => new Promise((r) => setTimeout.call(undefined, () => r("ok"), 1)));
	await run("stCallObj", () => { try { setTimeout.call({}, () => 0, 1); return "no throw"; } catch (e) { return e.name; } });
	await run("fetchDetached", async () => { const f = self.fetch; return (await f("rel.txt")).status; });
	await run("fetchCallUndef", async () => (await fetch.call(undefined, "rel.txt")).status);
	await run("ua", () => navigator.userAgent === extra.ua);
	await run("hwc", () => navigator.hardwareConcurrency === extra.hwc);
	await run("online", () => navigator.onLine);
	await run("lang", () => navigator.language + "|" + navigator.languages.join(","));
	await run("storageFns", () => typeof navigator.storage + ":" + typeof navigator.storage?.getDirectory + ":" + typeof navigator.storage?.estimate);
	await run("navKeys", () => { const o = []; for (const k in navigator) o.push(k); return o.sort().join(","); });
	await run("crypto", async () => typeof crypto.randomUUID() + ":" + new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([1]))).length);
	await run("wasmStream", async () => (await WebAssembly.instantiateStreaming(fetch(ORIGIN_BASE + "/x.wasm"))).instance.exports.f());
	await run("wasmStreamRel", async () => (await WebAssembly.instantiateStreaming(fetch("/x.wasm"))).instance.exports.f());
	await run("wasmCompileStreaming", async () => WebAssembly.Module.exports(await WebAssembly.compileStreaming(fetch(ORIGIN_BASE + "/x.wasm"))).map((e) => e.name));
	await run("wasmBuf", async () => (await WebAssembly.instantiate(await (await fetch(ORIGIN_BASE + "/x.wasm")).arrayBuffer())).instance.exports.f());
	await run("clone", () => { const d = structuredClone({ m: new Map([[1, 2]]), s: new Set([3]), d: new Date(5), r: /x/g, b: new Blob(["ab"]), e: new RangeError("q"), u: new Uint16Array([7]) }); return [d.m.get(1), d.s.has(3), +d.d, d.r.flags, d.b.size, d.e.name, d.u[0]]; });
	await run("idb", () => new Promise((res) => { const q = indexedDB.open("rv20db"); q.onsuccess = () => { const db = q.result; if (!db.objectStoreNames.contains("s")) { res("no store"); return; } const g = db.transaction("s").objectStore("s").get("k"); g.onsuccess = () => { res(g.result); db.close(); }; g.onerror = () => res("get error"); }; q.onerror = () => res("open error " + q.error); q.onupgradeneeded = () => {}; }));
	await run("idbDbs", async () => (await indexedDB.databases()).map((d) => d.name).filter((n) => /rv20/.test(n)).sort());
	await run("cacheKeys", async () => (await caches.keys()).filter((k) => /rv20/.test(k)));
	await run("cacheMatch", async () => { const r = await caches.match(ORIGIN_BASE + "/cached.txt"); return r ? await r.text() : "miss"; });
	await run("cacheMatchRel", async () => { const r = await caches.match("/cached.txt"); return r ? await r.text() : "miss"; });
	await run("cachePutGet", async () => { const c = await caches.open("rv20w"); await c.put("wput.txt", new Response("wp")); const k = (await c.keys()).map((r) => r.url); return k; });
	await run("opfs", async () => { const d = await navigator.storage.getDirectory(); const out = [d.name]; for await (const [n] of d.entries()) out.push(n); return out.sort(); });
	await run("opfsSync", async () => { const d = await navigator.storage.getDirectory(); const fh = await d.getFileHandle("w-sync.bin", { create: true }); if (!fh.createSyncAccessHandle) return "no sync"; const h = await fh.createSyncAccessHandle(); h.write(new Uint8Array([1, 2, 3]), { at: 0 }); const n = h.getSize(); h.close(); return n; });
	await run("bc", () => new Promise((res) => { const c = new BroadcastChannel("rv20bc"); c.onmessage = (e) => { res(e.data); c.close(); }; c.postMessage("ping-" + extra.kind); }), 1500);
	await run("bcName", () => { const c = new BroadcastChannel("rv20bc"); const n = c.name; c.close(); return n; });
	await run("nested", () => new Promise((res) => { try { const w = new Worker("nested.js?n=1"); w.onmessage = (e) => { res(e.data); w.terminate(); }; w.onerror = (e) => res("nested error " + e.message); } catch (e) { res("ERR " + e.name + ": " + e.message); } }));
	await run("nestedBlob", () => new Promise((res) => { try { const u = URL.createObjectURL(new Blob(["postMessage([location.protocol, self.origin, typeof fetch])"], { type: "text/javascript" })); const w = new Worker(u); w.onmessage = (e) => { res(e.data); w.terminate(); }; w.onerror = (e) => res("nestedBlob error " + e.message); } catch (e) { res("ERR " + e.name + ": " + e.message); } }));
	await run("errEvent", () => new Promise((res) => { self.onerror = (msg, file, line, col, err) => { self.onerror = null; res([String(msg).replace(/^Uncaught /, ""), file, line > 0, typeof col, err && err.message]); return true; }; setTimeout(() => { throw new Error("boom-" + extra.kind); }, 1); }));
	await run("errStack", () => { try { null.x; } catch (e) { return /probe|blob:|data:|nested/.test(e.stack) + ":" + /\/~\/sj\/|scramjet/.test(e.stack); } });
	await run("globalThis", () => [self === globalThis, typeof window, typeof document, self.constructor.name, Object.getPrototypeOf(self) === self.constructor.prototype]);
	await run("location", () => [typeof location, location.constructor.name, String(location) === location.href, location.pathname]);
	await run("isSecure", () => self.isSecureContext + ":" + self.crossOriginIsolated);
	await run("eval", () => eval("location.pathname"));
	await run("fnCtor", () => new Function("return location.pathname")());
	await run("dynImport", async () => (await import(ORIGIN_BASE + "/mod.mjs")).default, 3000);
	await run("dynImportRel", async () => (await import("./m2.mjs")).default, 3000);
	await run("eventSource", () => typeof EventSource);
	await run("keysDiff", () => Object.getOwnPropertyNames(self).filter((k) => /scramjet|^\$|^__/i.test(k)).sort());
	return R;
}
`;

const PROBE_TAIL = String.raw`
self.onmessage = async (e) => {
	if (e.data && e.data.port) {
		// MessagePort transferred in: answer over it, transferring a buffer back
		const buf = new ArrayBuffer(8);
		e.data.port.postMessage({ via: "port", len: e.data.buf.byteLength }, [buf]);
		return;
	}
	if (e.data && e.data.canvas) {
		const c = e.data.canvas; const g = c.getContext("2d"); g.fillStyle = "#f00"; g.fillRect(0, 0, 4, 4);
		const bm = c.transferToImageBitmap ? "bitmap" : "none";
		postMessage({ canvas: [c.width, c.height, bm, typeof g.getImageData(0,0,1,1).data[0]] });
		return;
	}
	if (e.data && e.data.close) { close(); postMessage("after close"); return; }
	const r = await probe(e.data);
	postMessage(r);
};
`;

const SHARED_TAIL = String.raw`
onconnect = (ev) => {
	const p = ev.ports[0];
	p.onmessage = async (e) => { p.postMessage(await probe(e.data)); };
};
`;

const routes: Record<string, [string, string | Buffer]> = {
	"/w/lib1.js": ["application/javascript", "self.lib1 = 1;"],
	"/w/lib2.js": ["application/javascript", "self.lib2 = 2;"],
	"/w/lib3.js": ["application/javascript", "self.lib3 = 3;"],
	"/lib-root.js": ["application/javascript", "self.libroot = 'root';"],
	"/w/thrower.js": [
		"application/javascript",
		"\n\nthrow new TypeError('thrown-in-import');",
	],
	"/w/rel.txt": ["text/plain", "w-rel"],
	"/rel.txt": ["text/plain", "root-rel"],
	"/cached.txt": ["text/plain", "from-net"],
	"/w/nested.js": [
		"application/javascript",
		"postMessage([location.href, self.origin, self.name])",
	],
	"/nested.js": [
		"application/javascript",
		"postMessage(['WRONG-root-nested', location.href])",
	],
	"/x.wasm": ["application/wasm", WASM],
	"/mod.mjs": [
		"text/javascript",
		"export default 'mod-' + typeof self.importScripts;",
	],
	"/w/m2.mjs": ["text/javascript", "export default 'm2';"],
	"/m2.mjs": ["text/javascript", "export default 'WRONG-root-m2';"],
};

export const serveProbe = (
	server: any,
	extraRoutes: Record<string, [string, string]> = {}
) =>
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		const origin = `http://${req.headers.host}`;
		const probeSrc = (tail: string) =>
			PROBE.replace(/ORIGIN_BASE/g, JSON.stringify(origin)) + tail;
		const all: Record<string, [string, string | Buffer]> = {
			...routes,
			"/w/probe.js": ["application/javascript", probeSrc(PROBE_TAIL)],
			"/w/probe.mjs": ["text/javascript", probeSrc(PROBE_TAIL)],
			"/w/shared.js": ["application/javascript", probeSrc(SHARED_TAIL)],
			"/probe-src.txt": ["text/plain", probeSrc(PROBE_TAIL)],
			...extraRoutes,
		};
		const hit = all[path];
		if (!hit) {
			res.writeHead(404);
			res.end("nf");
			return;
		}
		res.writeHead(200, {
			"Content-Type": hit[0],
		});
		res.end(hit[1]);
	});

// page side: seed storage, answer the BroadcastChannel, and a runner that
// starts a worker of each kind and collects its probe results.
export const PAGE_SETUP = String.raw`
const seed = async () => {
	await new Promise((res) => { const q = indexedDB.open("rv20db", 1); q.onupgradeneeded = () => q.result.createObjectStore("s"); q.onsuccess = () => { const t = q.result.transaction("s", "readwrite"); t.objectStore("s").put("page-value", "k"); t.oncomplete = () => { q.result.close(); res(); }; }; q.onerror = () => res(); });
	const c = await caches.open("rv20c"); await c.put("/cached.txt", new Response("from-cache"));
	const d = await navigator.storage.getDirectory(); await d.getFileHandle("page-file.txt", { create: true });
};
const bc = new BroadcastChannel("rv20bc");
bc.onmessage = (e) => bc.postMessage("pong:" + e.data);
const extra = (kind) => ({ kind, ua: navigator.userAgent, hwc: navigator.hardwareConcurrency });
const fromWorker = (w, kind, ms = 25000) => new Promise((res) => {
	const t = setTimeout(() => res("TIMEOUT"), ms);
	w.onmessage = (e) => { clearTimeout(t); res(e.data); };
	w.onerror = (e) => { clearTimeout(t); res("WORKER ERROR " + (e.message || e.type) + " @" + e.filename + ":" + e.lineno); };
	w.postMessage(extra(kind));
});
const fromShared = (sw, kind, ms = 25000) => new Promise((res) => {
	const t = setTimeout(() => res("TIMEOUT"), ms);
	sw.port.onmessage = (e) => { clearTimeout(t); res(e.data); };
	sw.onerror = (e) => { clearTimeout(t); res("SW ERROR " + e.type); };
	sw.port.start();
	sw.port.postMessage(extra(kind));
});
const report = (kind, r) => {
	if (typeof r !== "object") { assertConsistent(kind, r); return; }
	for (const k of Object.keys(r)) assertConsistent(kind + "." + k, r[k]);
	console.log("RV20DUMP " + kind + " " + JSON.stringify(r));
};
`;

const one = (name: string, body: string) =>
	serverTest({
		name,
		autoPass: true,
		js: PAGE_SETUP + `await seed();\n` + body,
		start: async (server) => serveProbe(server),
	});

export default [
	one(
		"rv20-mx-file",
		`report("file", await fromWorker(new Worker("/w/probe.js?q=1#h", { name: "nm" }), "file"));`
	),
	one(
		"rv20-mx-blob",
		`const src = await (await fetch("/probe-src.txt")).text();
		const u = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
		report("blob", await fromWorker(new Worker(u), "blob"));`
	),
	one(
		"rv20-mx-data",
		`const src = await (await fetch("/probe-src.txt")).text();
		report("data", await fromWorker(new Worker("data:text/javascript," + encodeURIComponent(src)), "data"));`
	),
	one(
		"rv20-mx-module",
		`report("module", await fromWorker(new Worker("/w/probe.mjs", { type: "module" }), "module"));`
	),
	one(
		"rv20-mx-shared",
		`report("shared", await fromShared(new SharedWorker("/w/shared.js", "shn"), "shared"));`
	),
	one(
		"rv20-mx-iframe",
		`const f = document.createElement("iframe"); f.src = "/rel.txt"; document.body.append(f);
		await new Promise((r) => f.onload = r);
		const fr = document.createElement("iframe"); document.body.append(fr);
		// worker created by a same-origin about:blank child, via the child's constructor
		report("blankframe", await fromWorker(new fr.contentWindow.Worker("/w/probe.js"), "blankframe"));`
	),
	one(
		"rv20-mx-srcdoc",
		`const fr = document.createElement("iframe");
		fr.srcdoc = "<script>window.mk = () => new Worker('/w/probe.js')<\/script>";
		document.body.append(fr); await new Promise((r) => fr.onload = r);
		report("srcdoc", await fromWorker(fr.contentWindow.mk(), "srcdoc"));`
	),
	one(
		"rv20-mx-transfer",
		`const w = new Worker("/w/probe.js");
		const mc = new MessageChannel();
		const buf = new ArrayBuffer(16);
		const got = await new Promise((res) => { mc.port1.onmessage = (e) => res({ d: e.data, bufLen: e.data && buf.byteLength, got: e.ports.length }); w.postMessage({ port: mc.port2, buf }, [mc.port2, buf]); setTimeout(() => res("timeout"), 5000); });
		assertConsistent("transfer", got);
		const cv = document.createElement("canvas"); cv.width = 7; cv.height = 9;
		const off = cv.transferControlToOffscreen();
		const cg = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.postMessage({ canvas: off }, [off]); setTimeout(() => res("timeout"), 5000); });
		assertConsistent("canvas", cg);
		const cl = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.postMessage({ close: 1 }); setTimeout(() => res("no message after close"), 1500); });
		assertConsistent("close", cl);
		console.log("RV20DUMP transfer " + JSON.stringify({ got, cg, cl }));`
	),
];
