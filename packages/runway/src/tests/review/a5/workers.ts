import { serverTest } from "../../../testcommon.ts";

// rv5: worker / worklet / import() probes, run against main and develop.

const files: Record<string, [string, string]> = {
	"/w-echo.js": [
		"application/javascript",
		`self.onmessage = (e) => postMessage({ name: self.name, href: location.href, got: e.data });`,
	],
	"/w-lib.js": ["application/javascript", `self.libValue = "fromlib";`],
	"/w-lib2.js": ["application/javascript", `self.libValue2 = "fromlib2";`],
	"/m-dep.js": ["application/javascript", `export const v = "dep";`],
	"/m-dyn.js": [
		"application/javascript",
		`export const dyn = "dyn"; export const meta = import.meta.url;`,
	],
	"/w-idb.js": [
		"application/javascript",
		`self.onmessage = () => {
			const r = indexedDB.open("rv5shared");
			r.onsuccess = () => { const db = r.result; postMessage({ stores: [...db.objectStoreNames], name: db.name }); db.close(); };
			r.onerror = () => postMessage({ err: String(r.error) });
		};`,
	],
	"/w-bc.js": [
		"application/javascript",
		`const bc = new BroadcastChannel("rv5bc"); bc.onmessage = (e) => bc.postMessage("pong:" + e.data); postMessage("ready");`,
	],
	"/w-caches.js": [
		"application/javascript",
		`self.onmessage = async () => { try { const c = await caches.open("rv5c"); const r = await c.match("/cached-thing"); postMessage({ found: !!r, body: r && await r.text(), names: await caches.keys() }); } catch (e) { postMessage({ err: String(e) }); } };`,
	],
	"/w-ls.js": [
		"application/javascript",
		`self.onmessage = async () => { const r = await fetch("/echo"); postMessage({ status: r.status, url: r.url }); };`,
	],
	"/w-nested.js": [
		"application/javascript",
		`const w = new Worker("/w-echo.js"); w.onmessage = (e) => postMessage({ nested: e.data }); w.onerror = (e) => postMessage({ err: "nested error " + e.message }); w.postMessage("hi");`,
	],
	"/sw-shared.js": [
		"application/javascript",
		`onconnect = (e) => { const p = e.ports[0]; p.onmessage = () => p.postMessage({ name: self.name }); p.start(); };`,
	],
	"/proc.js": [
		"application/javascript",
		`class P extends AudioWorkletProcessor { process() { return true; } } registerProcessor("rv5-proc", P);`,
	],
	"/paint.js": [
		"application/javascript",
		`registerPaint("rv5paint", class { paint() {} });`,
	],
	"/echo": ["application/json", `{"ok":true}`],
};

const T = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		scramjetOnly: true,
		js: `
			const wmsg = (w, send) => new Promise((res, rej) => {
				const t = setTimeout(() => rej(new Error("timeout")), 6000);
				const tgt = w.port || w;
				tgt.onmessage = (e) => { clearTimeout(t); res(e.data); };
				w.onerror = (e) => { clearTimeout(t); rej(new Error("worker error: " + (e.message || "(no message)"))); };
				if (w.port) w.port.start();
				if (send !== undefined) tgt.postMessage(send);
			});
			${js}
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				const f = files[path];
				if (f) {
					res.writeHead(200, {
						"Content-Type": f[0],
					});
					res.end(f[1]);
					return;
				}
				res.writeHead(404);
				res.end("nf");
			});
		},
	});

const all = [
	T(
		"rv5-worker-blob-classic",
		`const u = URL.createObjectURL(new Blob(["onmessage = (e) => postMessage('blob:' + e.data)"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertEqual(await wmsg(w, "x"), "blob:x", "blob worker reply");`
	),
	T(
		"rv5-worker-blob-module",
		`const u = URL.createObjectURL(new Blob(["import { v } from '" + location.origin + "/m-dep.js'; onmessage = (e) => postMessage(v + e.data)"], { type: "text/javascript" }));
		const w = new Worker(u, { type: "module" });
		assertEqual(await wmsg(w, "!"), "dep!", "blob module worker reply");`
	),
	T(
		"rv5-worker-blob-importscripts",
		`const u = URL.createObjectURL(new Blob(["importScripts('" + location.origin + "/w-lib.js', '" + location.origin + "/w-lib2.js'); onmessage = () => postMessage(self.libValue + self.libValue2)"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertEqual(await wmsg(w, 1), "fromlibfromlib2", "importScripts in blob worker");`
	),
	T(
		"rv5-worker-importscripts-blob-url",
		`const lib = URL.createObjectURL(new Blob(["self.fromBlobLib = 42"], { type: "text/javascript" }));
		const u = URL.createObjectURL(new Blob(["importScripts('" + lib + "'); onmessage = () => postMessage(self.fromBlobLib)"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertEqual(await wmsg(w, 1), 42, "importScripts(blob:) in blob worker");`
	),
	T(
		"rv5-worker-self-importscripts-member",
		`const u = URL.createObjectURL(new Blob(["self.importScripts('" + location.origin + "/w-lib.js'); onmessage = () => postMessage([self.libValue, typeof importScripts, importScripts.name, importScripts.length])"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertDeepEqual(await wmsg(w, 1), ["fromlib", "function", "importScripts", 0], "self.importScripts");`
	),
	T(
		"rv5-worker-data-url",
		`const w = new Worker("data:text/javascript,onmessage=(e)=>postMessage('data:'+e.data)");
		assertEqual(await wmsg(w, "y"), "data:y", "data: worker reply");`
	),
	T(
		"rv5-worker-name-option",
		`const w = new Worker("/w-echo.js", { name: "myname" });
		const d = await wmsg(w, 1);
		assertEqual(d.name, "myname", "self.name");`
	),
	T(
		"rv5-worker-url-object",
		`const w = new Worker(new URL("/w-echo.js", location.href));
		const d = await wmsg(w, 1);
		assertEqual(new URL(d.href).pathname, "/w-echo.js", "location");`
	),
	T(
		"rv5-worker-nested",
		`const w = new Worker("/w-nested.js");
		const d = await wmsg(w);
		assert(d.nested, "nested reply " + JSON.stringify(d));`
	),
	T(
		"rv5-sharedworker-no-name",
		`const w = new SharedWorker("/sw-shared.js");
		const d = await wmsg(w, 1);
		assertEqual(d.name, "", "self.name of unnamed shared worker");`
	),
	T(
		"rv5-sharedworker-string-name",
		`const w = new SharedWorker("/sw-shared.js", "nm");
		const d = await wmsg(w, 1);
		assertEqual(d.name, "nm", "self.name");`
	),
	T(
		"rv5-sharedworker-dict-name",
		`const w = new SharedWorker("/sw-shared.js", { name: "nm2" });
		const d = await wmsg(w, 1);
		assertEqual(d.name, "nm2", "self.name");`
	),
	T(
		"rv5-sharedworker-blob",
		`const u = URL.createObjectURL(new Blob(["onconnect = (e) => { const p = e.ports[0]; p.onmessage = () => p.postMessage('sb:' + self.name); p.start(); }"], { type: "text/javascript" }));
		const w = new SharedWorker(u, "z");
		assertEqual(await wmsg(w, 1), "sb:z", "blob shared worker");`
	),
	T(
		"rv5-worker-idb-shared-with-page",
		`await new Promise((res, rej) => { const r = indexedDB.open("rv5shared", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => { r.result.close(); res(); }; r.onerror = () => rej(r.error); });
		const w = new Worker("/w-idb.js");
		const d = await wmsg(w, 1);
		assertDeepEqual(d, { stores: ["files"], name: "rv5shared" }, "worker sees page database");`
	),
	T(
		"rv5-worker-blob-idb-shared-with-page",
		`await new Promise((res, rej) => { const r = indexedDB.open("rv5sharedb", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => { r.result.close(); res(); }; r.onerror = () => rej(r.error); });
		const u = URL.createObjectURL(new Blob(["onmessage = () => { const r = indexedDB.open('rv5sharedb'); r.onsuccess = () => postMessage([...r.result.objectStoreNames]); r.onerror = () => postMessage('err ' + r.error); }"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertDeepEqual(await wmsg(w, 1), ["files"], "blob worker sees page database");`
	),
	T(
		"rv5-worker-broadcastchannel-with-page",
		`const w = new Worker("/w-bc.js");
		assertEqual(await wmsg(w), "ready");
		const bc = new BroadcastChannel("rv5bc");
		const got = new Promise((res, rej) => { bc.onmessage = (e) => res(e.data); setTimeout(() => rej(new Error("bc timeout")), 4000); });
		bc.postMessage("ping");
		assertEqual(await got, "pong:ping", "bc roundtrip");`
	),
	T(
		"rv5-worker-blob-broadcastchannel-with-page",
		`const u = URL.createObjectURL(new Blob(["const bc = new BroadcastChannel('rv5bcb'); bc.onmessage = (e) => bc.postMessage('pong:' + e.data); postMessage('ready');"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertEqual(await wmsg(w), "ready");
		const bc = new BroadcastChannel("rv5bcb");
		const got = new Promise((res, rej) => { bc.onmessage = (e) => res(e.data); setTimeout(() => rej(new Error("bc timeout")), 4000); });
		bc.postMessage("ping");
		assertEqual(await got, "pong:ping", "bc roundtrip with blob worker");`
	),
	T(
		"rv5-worker-caches-shared-with-page",
		`const c = await caches.open("rv5c"); await c.put("/cached-thing", new Response("hello"));
		const w = new Worker("/w-caches.js");
		const d = await wmsg(w, 1);
		assertEqual(d.err, undefined, "no error"); assertEqual(d.found, true, "worker finds cache entry " + JSON.stringify(d));
		await caches.delete("rv5c");`
	),
	T(
		"rv5-worker-blob-caches-shared-with-page",
		`const c = await caches.open("rv5cb"); await c.put(location.origin + "/cached-thing", new Response("hello"));
		const u = URL.createObjectURL(new Blob(["onmessage = async () => { const c = await caches.open('rv5cb'); const r = await c.match('" + location.origin + "/cached-thing'); postMessage(!!r); }"], { type: "text/javascript" }));
		const w = new Worker(u);
		assertEqual(await wmsg(w, 1), true, "blob worker finds page cache entry");
		await caches.delete("rv5cb");`
	),
	T(
		"rv5-worker-blob-fetch-relative",
		`const u = URL.createObjectURL(new Blob(["onmessage = async () => { try { const r = await fetch('/echo'); postMessage([r.status, r.url]); } catch (e) { postMessage(['err', String(e)]); } }"], { type: "text/javascript" }));
		const w = new Worker(u);
		const d = await wmsg(w, 1);
		assertDeepEqual(d, [200, location.origin + "/echo"], "fetch from blob worker");`
	),
	T(
		"rv5-worker-module-dynamic-import",
		`const u = URL.createObjectURL(new Blob(["onmessage = async () => { try { const m = await import('" + location.origin + "/m-dyn.js'); postMessage([m.dyn, m.meta]); } catch (e) { postMessage(['err', String(e)]); } }"], { type: "text/javascript" }));
		const w = new Worker(u, { type: "module" });
		assertDeepEqual(await wmsg(w, 1), ["dyn", location.origin + "/m-dyn.js"], "dynamic import in module blob worker");`
	),
	T(
		"rv5-audioworklet-addmodule",
		`const ctx = new AudioContext();
		await ctx.audioWorklet.addModule("/proc.js");
		const node = new AudioWorkletNode(ctx, "rv5-proc");
		assert(node, "node constructed");
		await ctx.close();`
	),
	T(
		"rv5-audioworklet-addmodule-blob",
		`const ctx = new AudioContext();
		const u = URL.createObjectURL(new Blob(["class P extends AudioWorkletProcessor { process() { return true; } } registerProcessor('rv5-procb', P);"], { type: "application/javascript" }));
		await ctx.audioWorklet.addModule(u);
		const node = new AudioWorkletNode(ctx, "rv5-procb");
		assert(node, "node constructed");
		await ctx.close();`
	),
	T(
		"rv5-audioworklet-addmodule-data",
		`const ctx = new AudioContext();
		await ctx.audioWorklet.addModule("data:application/javascript," + encodeURIComponent("class P extends AudioWorkletProcessor { process() { return true; } } registerProcessor('rv5-procd', P);"));
		const node = new AudioWorkletNode(ctx, "rv5-procd");
		assert(node, "node constructed");
		await ctx.close();`
	),
	T(
		"rv5-paintworklet-addmodule",
		`await CSS.paintWorklet.addModule("/paint.js");`
	),
	T(
		"rv5-import-url-object",
		`const m = await import(new URL("/m-dyn.js", location.href));
		assertEqual(m.dyn, "dyn");`
	),
	T(
		"rv5-import-relative",
		`const m = await import("./m-dyn.js");
		assertEqual(m.dyn, "dyn"); assertEqual(m.meta, location.origin + "/m-dyn.js", "import.meta.url");`
	),
	T(
		"rv5-import-blob",
		`const u = URL.createObjectURL(new Blob(["export default 7"], { type: "text/javascript" }));
		const m = await import(u);
		assertEqual(m.default, 7);`
	),
	T(
		"rv5-import-data",
		`const m = await import("data:text/javascript,export default 8");
		assertEqual(m.default, 8);`
	),
	T(
		"rv5-import-bare-rejects",
		`let threwSync = false, rejected = false;
		try { await import("nonexistent-bare").catch(() => { rejected = true; }); } catch (e) { threwSync = true; }
		assert(rejected && !threwSync, "bare specifier rejects asynchronously; sync=" + threwSync);`
	),
];
const probe = T(
	"rv5-probe-sharedworker-name-internals",
	`const u = URL.createObjectURL(new Blob(["onconnect = (e) => { const p = e.ports[0]; p.onmessage = () => { const d = Object.getOwnPropertyDescriptor(SharedWorkerGlobalScope.prototype, 'name'); let viaGet; try { viaGet = d && d.get.call(self); } catch (x) { viaGet = 'throw ' + x; } p.postMessage({ own: Object.getOwnPropertyNames(self).includes('name'), hasDesc: !!d, viaGet, direct: self.name, bare: name }); }; p.start(); }"], { type: "text/javascript" }));
	const w = new SharedWorker(u, "z");
	fail(JSON.stringify(await wmsg(w, 1)));`
);

export default [...all, probe];
