import { serverTest } from "../../../testcommon.ts";

// rv19: real storage libraries from the CDN.

const load = (u: string) =>
	`await new Promise((res, rej) => { const s = document.createElement("script"); s.src = ${JSON.stringify(u)}; s.onload = res; s.onerror = () => rej(new Error("load " + ${JSON.stringify(u)})); document.head.appendChild(s); });`;

export default [
	serverTest({
		name: "rv19-libs-storage",
		autoPass: true,
		js: `
			const out = {};
			const t = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = "ERR:" + (e && (e.name + ":" + e.message)).slice(0, 120); } };
			${load("https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js")}
			${load("https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js")}
			${load("https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js")}
			${load("https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js")}
			${load("https://cdn.jsdelivr.net/npm/store2@2.14.3/dist/store2.min.js")}
			await t("lf", async () => { await localforage.setItem("a", { x: 1 }); await localforage.setItem("b", [1, 2]); const k = (await localforage.keys()).sort().join(","); const v = await localforage.getItem("a"); return k + "|" + JSON.stringify(v) + "|" + localforage.driver(); });
			await t("lfInstanceDrop", async () => { const i = localforage.createInstance({ name: "rv19inst", storeName: "s" }); await i.setItem("z", 1); await i.dropInstance(); const dbs = (await indexedDB.databases()).map((d) => d.name).sort().join(","); return dbs; });
			await t("lfLocalStorageDriver", async () => { const i = localforage.createInstance({ name: "rv19ls", driver: localforage.LOCALSTORAGE }); await i.setItem("q", "1"); await i.setItem("r", "2"); const ks = (await i.keys()).sort().join(","); const len = await i.length(); const kk = await i.key(0); await i.clear(); return ks + "|" + len + "|" + typeof kk + "|" + (await i.length()); });
			await t("dexie", async () => { const db = new Dexie("rv19dexie"); db.version(2).stores({ f: "++id,name" }); await db.f.add({ name: "n" }); const c = await db.f.count(); const names = (await Dexie.getDatabaseNames()).sort().join(","); const nm = db.name + "/" + db.backendDB().name; db.close(); await Dexie.delete("rv19dexie"); const after = (await Dexie.getDatabaseNames()).includes("rv19dexie"); const ex = await Dexie.exists("rv19dexie"); return c + "|" + names + "|" + nm + "|" + after + "|" + ex; });
			await t("idbkv", async () => { await idbKeyval.set("k", "v"); await idbKeyval.set("k2", "v2"); return (await idbKeyval.keys()).sort().join(",") + "|" + (await idbKeyval.get("k")); });
			await t("jsCookie", async () => { Cookies.set("jc", "val", { expires: 7 }); Cookies.set("jcp", "p", { path: "/" }); const all = Cookies.get(); Cookies.remove("jc"); return JSON.stringify(Object.keys(all).filter((k) => k.startsWith("jc")).sort()) + "|" + Cookies.get("jc") + "|" + Cookies.get("jcp"); });
			await t("store2", async () => { store.clear(); store.set("s1", { a: 1 }); store.set("s2", 2); const ks = store.keys().sort().join(","); const sz = store.size(); const each = []; store.each((k) => { each.push(k); }); store.session("ss", 1); return ks + "|" + sz + "|" + each.sort().join(",") + "|" + store.session.keys().join(","); });
			for (const k of Object.keys(out)) assertConsistent(k, out[k]);
			fail(JSON.stringify(out));
		`,
		start: async () => {},
	}),
];
