import { basicTest, playwrightTest, serverTest } from "../../../testcommon.ts";

// rv5: storage / cache / idb probes, run against main and develop.

const findFrame = (page: any, needle: string) => {
	const f = page.frames().find((fr: any) => fr.url().includes(needle));
	if (!f) throw new Error("no proxied frame matching " + needle);
	return f;
};

export default [
	// What the backing store actually holds after a proxied site writes. A
	// change here means data main wrote cannot be read by develop.
	playwrightTest({
		name: "rv5-persist-localstorage-rawkey-format",
		fn: async ({ page, navigate }) => {
			await navigate("https://example.com/");
			await new Promise((r) => setTimeout(r, 1500));
			const fr = findFrame(page, "example.com");
			await fr.evaluate(() => {
				localStorage.setItem("rv5k", "v");
				sessionStorage.setItem("rv5s", "v");
			});
			const raw = await page.evaluate(() => [
				Object.keys(localStorage).filter((k) => k.includes("rv5k")),
				Object.keys(sessionStorage).filter((k) => k.includes("rv5s")),
			]);
			console.log("RAWKEYS " + JSON.stringify(raw));
			if (!raw[0].includes("example.com@rv5k"))
				throw new Error(
					"localStorage raw key is not main's format: " + JSON.stringify(raw)
				);
		},
	}),
	playwrightTest({
		name: "rv5-persist-opfs-dirname-format",
		fn: async ({ page, navigate }) => {
			await navigate("https://example.com/");
			await new Promise((r) => setTimeout(r, 1500));
			const fr = findFrame(page, "example.com");
			await fr.evaluate(async () => {
				const root = await navigator.storage.getDirectory();
				await root.getFileHandle("rv5file", {
					create: true,
				});
			});
			const names = await page.evaluate(async () => {
				const root: any = await navigator.storage.getDirectory();
				const out: string[] = [];
				for await (const [n] of root.entries()) out.push(n);
				return out;
			});
			console.log("OPFSDIRS " + JSON.stringify(names));
			if (!names.includes("https:--example-com"))
				throw new Error(
					"OPFS dir is not main's format: " + JSON.stringify(names)
				);
		},
	}),
	playwrightTest({
		name: "rv5-persist-cache-entry-key-format",
		fn: async ({ page, navigate }) => {
			await navigate("https://example.com/");
			await new Promise((r) => setTimeout(r, 1500));
			const fr = findFrame(page, "example.com");
			await fr.evaluate(async () => {
				const c = await caches.open("rv5cache");
				await c.put("/rv5entry", new Response("body"));
			});
			const info = await page.evaluate(async () => {
				const names = await caches.keys();
				const out: any = {
					names,
					keys: [],
				};
				for (const n of names) {
					if (!n.includes("rv5cache")) continue;
					const c = await caches.open(n);
					out.keys.push(...(await c.keys()).map((r) => r.url));
				}
				return out;
			});
			console.log("CACHEINFO " + JSON.stringify(info));
			if (
				!info.keys.some(
					(u: string) => u.includes("/~/") || u.includes("localhost")
				)
			)
				throw new Error(
					"cache entry keyed by the site URL, not the proxied URL main used: " +
						JSON.stringify(info)
				);
		},
	}),
	playwrightTest({
		name: "rv5-persist-idb-name-format",
		fn: async ({ page, navigate }) => {
			await navigate("https://example.com/");
			await new Promise((r) => setTimeout(r, 1500));
			const fr = findFrame(page, "example.com");
			await fr.evaluate(
				() =>
					new Promise<void>((res) => {
						const r = indexedDB.open("rv5db");
						r.onsuccess = () => {
							r.result.close();
							res();
						};
					})
			);
			const dbs = await page.evaluate(async () =>
				(await indexedDB.databases()).map((d) => d.name)
			);
			console.log("IDBNAMES " + JSON.stringify(dbs));
			if (!dbs.includes("https://example.com@rv5db"))
				throw new Error("idb name not main's format " + JSON.stringify(dbs));
		},
	}),

	basicTest({
		name: "rv5-storage-enumeration-shapes",
		js: `
			localStorage.clear();
			localStorage.setItem("a", "1");
			localStorage.b = 2;
			localStorage.setItem("getItem", "shadow");
			assertEqual(typeof localStorage.getItem, "function", "method not shadowed");
			assertEqual(localStorage.getItem("getItem"), "shadow");
			assertEqual(JSON.stringify(Object.keys(localStorage).sort()), JSON.stringify(["a","b"]), "keys (member-named item hidden per WebIDL visibility)");
			assertEqual(localStorage.length, 3, "length");
			assertEqual(JSON.stringify({ ...localStorage }, Object.keys({ ...localStorage }).sort()), '{"a":"1","b":"2"}', "spread");
			assertEqual(Object.entries(localStorage).length, 2, "entries");
			assertEqual(localStorage.hasOwnProperty("a"), true, "hasOwnProperty");
			assertEqual(Object.prototype.hasOwnProperty.call(localStorage, "nope"), false);
			assertEqual("a" in localStorage, true); assertEqual("nope" in localStorage, false);
			assertEqual(localStorage.getItem("nope"), null);
			assertEqual(localStorage.nope, undefined);
			localStorage.setItem(1, { toString() { return "obj"; } });
			assertEqual(localStorage.getItem("1"), "obj");
			localStorage.setItem("n", null); assertEqual(localStorage.n, "null");
			const seen = []; for (const k in localStorage) seen.push(k);
			assert(seen.includes("a") && seen.includes("b"), "for-in has items: " + seen.join());
			assertEqual(Storage.prototype.getItem.call(localStorage, "a"), "1", "proto getItem.call");
			assertEqual(localStorage.key(0) !== null, true);
			assertEqual(Object.prototype.toString.call(localStorage), "[object Storage]");
			assert(localStorage instanceof Storage, "instanceof");
			let threw = false; try { localStorage.getItem(); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "getItem() with no args throws TypeError");
			delete localStorage.a; assertEqual(localStorage.getItem("a"), null, "delete");
			localStorage.clear(); assertEqual(localStorage.length, 0, "clear");
		`,
	}),
	basicTest({
		name: "rv5-storage-defineproperty",
		js: `
			localStorage.clear();
			Object.defineProperty(localStorage, "dp", { value: "x", configurable: true, enumerable: true, writable: true });
			assertEqual(localStorage.getItem("dp"), "x");
			localStorage.clear();
		`,
	}),
	basicTest({
		name: "rv5-storage-window-descriptor",
		js: `
			const d = Object.getOwnPropertyDescriptor(window, "localStorage");
			assert(d, "own descriptor exists");
			const ls = window.localStorage;
			assert(ls === localStorage, "identity");
			assert(ls === window.localStorage, "stable identity");
		`,
	}),
	serverTest({
		name: "rv5-storage-iframe-variants",
		autoPass: true,
		scramjetOnly: true,
		js: `
			localStorage.setItem("parentkey", "pv");
			const mk = (attrs) => new Promise((res) => { const f = document.createElement("iframe"); Object.assign(f, attrs); f.onload = () => res(f); document.body.appendChild(f); });
			const blank = await mk({});
			assertEqual(blank.contentWindow.localStorage.getItem("parentkey"), "pv", "about:blank frame sees parent storage");
			const same = await mk({ src: "/child.html" });
			assertEqual(same.contentWindow.localStorage.getItem("parentkey"), "pv", "same-origin child sees parent storage");
			const blobu = URL.createObjectURL(new Blob(["<p>x</p>"], { type: "text/html" }));
			const bl = await mk({ src: blobu });
			assertEqual(bl.contentWindow.localStorage.getItem("parentkey"), "pv", "blob: frame sees parent storage");
			localStorage.removeItem("parentkey");
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				if (req.url === "/child.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end("<p>child</p>");
				}
			});
		},
	}),
	serverTest({
		name: "rv5-storage-event-from-child",
		autoPass: true,
		scramjetOnly: true,
		js: `
			localStorage.removeItem("evk");
			const got = new Promise((res, rej) => { addEventListener("storage", (e) => res(e)); setTimeout(() => rej(new Error("no storage event")), 4000); });
			const f = document.createElement("iframe"); f.src = "/writer.html"; document.body.appendChild(f);
			const e = await got;
			assertEqual(e.key, "evk", "key"); assertEqual(e.newValue, "1"); assertEqual(e.oldValue, null);
			assertEqual(e.url, location.origin + "/writer.html", "url");
			assertEqual(e.storageArea === localStorage, true, "storageArea identity");
			localStorage.removeItem("evk");
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				if (req.url === "/writer.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end("<script>localStorage.setItem('evk','1')</script>");
				}
			});
		},
	}),
	basicTest({
		name: "rv5-idb-basic-flow",
		js: `
			const open = (n, v) => new Promise((res, rej) => { const r = v ? indexedDB.open(n, v) : indexedDB.open(n); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("s")) r.result.createObjectStore("s"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
			const db = await open("rv5idb", 2);
			assertEqual(db.name, "rv5idb"); assertEqual(db.version, 2);
			await new Promise((res, rej) => { const tx = db.transaction("s", "readwrite"); tx.objectStore("s").put({ a: 1 }, "k"); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
			const v = await new Promise((res) => { const rq = db.transaction("s").objectStore("s").get("k"); rq.onsuccess = () => res(rq.result); });
			assertEqual(v.a, 1);
			const dbs = await indexedDB.databases();
			assert(dbs.some((d) => d.name === "rv5idb" && d.version === 2), "databases() lists it: " + JSON.stringify(dbs));
			db.close();
			await new Promise((res, rej) => { const r = indexedDB.deleteDatabase("rv5idb"); r.onsuccess = res; r.onerror = () => rej(r.error); });
			const dbs2 = await indexedDB.databases();
			assert(!dbs2.some((d) => d.name === "rv5idb"), "deleted");
		`,
	}),
	basicTest({
		name: "rv5-cache-basic-flow",
		js: `
			const c = await caches.open("rv5-flow");
			await c.put("/a?x=1", new Response("A", { headers: { "content-type": "text/plain" } }));
			const req = new Request("/b");
			await c.put(req, new Response("B"));
			assertEqual(await (await c.match("/a?x=1")).text(), "A");
			assertEqual(await (await c.match("/a", { ignoreSearch: true })).text(), "A", "ignoreSearch");
			assertEqual(await (await c.match(new Request("/b"))).text(), "B", "match by Request");
			assertEqual(await (await caches.match("/b")).text(), "B", "caches.match");
			const keys = (await c.keys()).map((r) => r.url).sort();
			assertEqual(JSON.stringify(keys), JSON.stringify([location.origin + "/a?x=1", location.origin + "/b"]), "keys");
			const r = await fetch("/script.js");
			await c.put("/script.js", r);
			const m = await c.match("/script.js");
			assertEqual(m.url, location.origin + "/script.js", "response.url of cached fetch response");
			assertEqual((await caches.keys()).includes("rv5-flow"), true);
			await c.add("/script.js");
			await c.addAll(["/"]);
			assertEqual((await c.keys()).length, 4, "after add/addAll");
			assertEqual(await caches.delete("rv5-flow"), true);
		`,
	}),
];
