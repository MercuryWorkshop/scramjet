import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv5-misc-cache-in-about-blank-frame",
		scramjetOnly: true,
		js: `
			const f = document.createElement("iframe"); document.body.appendChild(f);
			const w = f.contentWindow;
			const c = await w.caches.open("rv5blank");
			await c.put("/blank-entry", new w.Response("x"));
			const m = await c.match("/blank-entry");
			assert(m, "match in about:blank frame");
			await w.caches.delete("rv5blank");
		`,
	}),
	basicTest({
		name: "rv5-misc-worker-subclass",
		scramjetOnly: true,
		js: `
			class MyWorker extends Worker { hello() { return "hi"; } }
			const u = URL.createObjectURL(new Blob(["onmessage = () => postMessage(1)"], { type: "text/javascript" }));
			const w = new MyWorker(u);
			assert(w instanceof MyWorker, "instanceof subclass");
			assertEqual(w.hello(), "hi", "subclass method");
			w.terminate();
		`,
	}),
	basicTest({
		name: "rv5-misc-broadcastchannel-subclass",
		scramjetOnly: true,
		js: `
			class MyBC extends BroadcastChannel { tag() { return "t"; } }
			const b = new MyBC("x");
			assert(b instanceof MyBC, "instanceof subclass");
			assertEqual(b.tag(), "t"); assertEqual(b.name, "x"); b.close();
		`,
	}),
	basicTest({
		name: "rv5-misc-worker-options-variants",
		scramjetOnly: true,
		js: `
			const u = URL.createObjectURL(new Blob(["onmessage = () => postMessage(self.name)"], { type: "text/javascript" }));
			for (const opt of [undefined, null, {}, { type: "classic" }, { credentials: "omit" }]) {
				const w = new Worker(u, opt);
				const got = await new Promise((res, rej) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("err " + e.message)); w.postMessage(1); setTimeout(() => rej(new Error("timeout for " + JSON.stringify(opt))), 4000); });
				assertEqual(got, "", "name for " + JSON.stringify(opt));
				w.terminate();
			}
		`,
	}),
	basicTest({
		name: "rv5-misc-storage-perf",
		scramjetOnly: true,
		js: `
			localStorage.clear();
			for (let i = 0; i < 1500; i++) localStorage.setItem("perf" + i, "v" + i);
			const t0 = performance.now();
			let n = 0;
			for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (localStorage.getItem(k) !== null) n++; }
			const t1 = performance.now();
			const t2 = performance.now();
			for (let i = 0; i < 20000; i++) localStorage.getItem("perf5");
			const t3 = performance.now();
			localStorage.clear();
			fail("PERF keyloop=" + Math.round(t1 - t0) + "ms n=" + n + " getItem20k=" + Math.round(t3 - t2) + "ms");
		`,
	}),
	basicTest({
		name: "rv5-misc-storage-in-srcdoc-and-blank-events",
		scramjetOnly: true,
		js: `
			localStorage.setItem("sd", "1");
			const f = document.createElement("iframe"); f.srcdoc = "<p>x</p>";
			await new Promise((r) => { f.onload = r; document.body.appendChild(f); });
			assertEqual(f.contentWindow.localStorage.getItem("sd"), "1", "srcdoc sees parent storage");
			assertEqual(f.contentWindow.sessionStorage.length, sessionStorage.length, "srcdoc session length");
			localStorage.removeItem("sd");
		`,
	}),
	basicTest({
		name: "rv5-misc-idb-open-variants",
		js: `
			const open = (...a) => new Promise((res, rej) => { const r = indexedDB.open(...a); r.onsuccess = () => { r.result.close(); res(r.result); }; r.onerror = () => rej(r.error); });
			const db = await open("rv5v");
			assertEqual(db.version, 1);
			const db2 = await open("rv5v", undefined);
			assertEqual(db2.version, 1, "undefined version");
			let threw = null; try { indexedDB.open("rv5v", 0); } catch (e) { threw = e.name; }
			assertEqual(threw, "TypeError", "version 0 throws TypeError");
			assertEqual(IDBFactory.prototype.open.call(indexedDB, "rv5v") instanceof IDBOpenDBRequest, true);
			assertEqual(typeof indexedDB.cmp(1, 2), "number");
			await new Promise((res) => { const r = indexedDB.deleteDatabase("rv5v"); r.onsuccess = res; r.onerror = res; });
		`,
	}),
	basicTest({
		name: "rv5-misc-synthetic-storage-event",
		scramjetOnly: true,
		js: `
			let got = null;
			addEventListener("storage", (e) => { got = e; });
			const ev = new StorageEvent("storage", { key: "k", newValue: "v", storageArea: localStorage });
			dispatchEvent(ev);
			assert(got, "listener ran");
			assertEqual(got.key, "k"); assertEqual(got.storageArea === localStorage, true, "storageArea identity");
		`,
	}),
];
