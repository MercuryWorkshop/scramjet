import { serverTest } from "../../../testcommon.ts";

// rv20: OPFS handles crossing into and out of workers

const W = String.raw`
onmessage = async (e) => {
	const out = {};
	const g = async (f) => { try { return await f(); } catch (err) { return "ERR " + err.name + ": " + err.message; } };
	out.postedRootName = await g(() => e.data.root.name);
	out.postedRootSame = await g(async () => (await navigator.storage.getDirectory()).isSameEntry(e.data.root));
	out.postedRootList = await g(async () => { const o = []; for await (const k of e.data.root.keys()) o.push(k); return o.sort(); });
	out.resolve = await g(async () => { const r = await navigator.storage.getDirectory(); const f = await r.getFileHandle("page.txt"); return await r.resolve(f); });
	out.postedResolve = await g(async () => { const f = await e.data.root.getFileHandle("page.txt"); return await e.data.root.resolve(f); });
	out.idbStoredName = await g(() => new Promise((res) => { const q = indexedDB.open("rv20opfs"); q.onsuccess = () => { const gg = q.result.transaction("s").objectStore("s").get("root"); gg.onsuccess = () => res(gg.result ? gg.result.name : "none"); }; }));
	const mine = await navigator.storage.getDirectory();
	postMessage({ out, mine });
};`;

export default [
	serverTest({
		name: "rv20-opfs-handles",
		autoPass: true,
		js: String.raw`
		const root = await navigator.storage.getDirectory();
		await root.getFileHandle("page.txt", { create: true });
		await new Promise((res) => { const q = indexedDB.open("rv20opfs", 1); q.onupgradeneeded = () => q.result.createObjectStore("s"); q.onsuccess = () => { const t = q.result.transaction("s", "readwrite"); t.objectStore("s").put(root, "root"); t.oncomplete = () => { q.result.close(); res(); }; }; });
		const w = new Worker("/w.js");
		const r = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error " + e.message); w.postMessage({ root }); setTimeout(() => res("timeout"), 8000); });
		const out = r.out || { worker: r };
		out.workerRootNameOnPage = r.mine ? r.mine.name : "none";
		out.workerRootSameOnPage = r.mine ? await root.isSameEntry(r.mine) : "none";
		out.idbReadBackName = await new Promise((res) => { const q = indexedDB.open("rv20opfs"); q.onsuccess = () => { const gg = q.result.transaction("s").objectStore("s").get("root"); gg.onsuccess = () => res(gg.result.name); }; });
		for (const k of Object.keys(out)) assertConsistent("o." + k, out[k]);
		console.log("RV20DUMP opfs " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (p === "/w.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(W);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];
