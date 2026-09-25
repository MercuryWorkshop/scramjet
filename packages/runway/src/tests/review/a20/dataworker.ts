import { basicTest } from "../../../testcommon.ts";

// rv20: data: URL dedicated workers. In Chrome (149 here) a data: dedicated
// worker gets its creator's origin: self.origin, BroadcastChannel, IndexedDB,
// Cache API and OPFS are all the page's.

const W = (body: string) =>
	`new Worker("data:text/javascript," + encodeURIComponent(${JSON.stringify(body)}))`;
const ask = `const ask = (w) => new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error " + e.message); setTimeout(() => res("timeout"), 4000); });`;

export default [
	basicTest({
		name: "rv20-dataworker-origin",
		js: `${ask}
		const r = await ask(${W("postMessage([self.origin, location.origin])")});
		assertConsistent("origin", r);
		assertEqual(r[0], location.origin, "self.origin in a data: worker");
		`,
	}),
	basicTest({
		name: "rv20-dataworker-broadcastchannel",
		js: `${ask}
		const bc = new BroadcastChannel("rv20dw");
		const got = new Promise((res) => { bc.onmessage = (e) => res(e.data); setTimeout(() => res("page never heard the worker"), 4000); });
		${W("const c = new BroadcastChannel('rv20dw'); c.postMessage('hello from data worker');")};
		const r = await got;
		assertConsistent("bc", r);
		assertEqual(r, "hello from data worker", "BroadcastChannel page <-> data: worker");
		`,
	}),
	basicTest({
		name: "rv20-dataworker-idb-persist",
		js: `${ask}
		// worker 1 writes, worker 2 (a separate data: worker, as after a reload) reads
		const put = ${W("const q = indexedDB.open('rv20dwdb', 1); q.onupgradeneeded = () => q.result.createObjectStore('s'); q.onsuccess = () => { const t = q.result.transaction('s', 'readwrite'); t.objectStore('s').put('v1', 'k'); t.oncomplete = () => postMessage('put'); };")};
		assertEqual(await ask(put), "put", "put");
		const get = ${W("const q = indexedDB.open('rv20dwdb'); q.onsuccess = () => { const db = q.result; if (!db.objectStoreNames.contains('s')) { postMessage('no store'); return; } const g = db.transaction('s').objectStore('s').get('k'); g.onsuccess = () => postMessage(g.result ?? 'missing'); };")};
		const r = await ask(get);
		const fromPage = await new Promise((res) => { const q = indexedDB.open('rv20dwdb'); q.onsuccess = () => { const db = q.result; res(db.objectStoreNames.contains('s') ? 'page sees store' : 'page sees nothing'); db.close(); }; q.onerror = () => res('err'); });
		assertConsistent("idb", [r, fromPage]);
		assertEqual(r, "v1", "second data: worker reads what the first wrote");
		`,
	}),
];
