import { basicTest, multiFrameTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Every proxied site shares one real storage key, so each storage API has to
// carry the site's origin in whatever namespace the browser lets it name:
// `caches.ts` prefixes the cache name, `indexeddb.ts` the database name,
// `opfs.ts` the root directory. `origin-scoping.ts` covers the case where that
// namespace is computed wrongly. This file covers the other half - the members
// that enumerate or search *across* the namespace, where getting the prefix
// right buys nothing because the member never consults it.
//
// Every one of these is a cross-site read: the bare harness is the oracle, and
// there the two origins are genuinely separate so nothing can be seen at all.

const LOAD = `const load = (f) => new Promise((r) => { f.onload = r; setTimeout(r, 1000); });`;

export default [
	// https://w3c.github.io/ServiceWorker/#cache-storage-match
	//
	// `caches.match(request)` with no `cacheName` runs the match over *every*
	// cache in the storage, in creation order. Scoping the name at `open()`
	// keeps two sites out of each other's caches by name, and does nothing
	// here: the search never looks at a name. The key is the site's real URL,
	// so a site that can guess a URL another site cached reads that response
	// back - body, status and headers.
	multiFrameTest({
		name: "storagescope-caches-match-crosses-origins",
		root: {
			js: () => `
				(async () => {
					// after the cross-origin frame has had time to write
					await new Promise((r) => setTimeout(r, 700));

					const hit = await caches.match(
						"https://storagescope.example/secret-cache-entry"
					);
					if (!hit) {
						pass();

						return;
					}

					fail(
						"caches.match() read another origin's cache entry: " +
							(await hit.text())
					);
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "cachewriter",
					js: () => `
						(async () => {
							const cache = await caches.open("storagescope-secret");
							await cache.put(
								"https://storagescope.example/secret-cache-entry",
								new Response("CROSS-ORIGIN-SECRET")
							);
						})().catch((error) => fail(error && error.message));
					`,
				},
			],
		},
	}),

	// The same hole reached through `Cache.matchAll` is closed, because a Cache
	// is already scoped by the name it was opened with - so this is the control
	// that says the leak above really is `CacheStorage.match`'s own.
	basicTest({
		name: "storagescope-caches-keys-are-own-only",
		js: `
			const name = "storagescope-mine-" + Math.random();
			await caches.open(name);
			const keys = await caches.keys();
			assert(keys.includes(name), "a site sees the cache it just opened");
			for (const key of keys) {
				assert(
					!key.includes("@"),
					"a cache name must not carry the scoping prefix: " + key
				);
			}
		`,
	}),

	// https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface
	//
	// Every proxied site shares one real storage area, so `localStorage` is
	// scoped by a key prefix. Nothing else in this file covers Web Storage,
	// which is the one surface where losing the scoping means a site reads and
	// writes another's data directly rather than only enumerating it.
	multiFrameTest({
		name: "storagescope-localstorage-crosses-origins",
		root: {
			js: () => `
				(async () => {
					await new Promise((r) => setTimeout(r, 700));

					// an own property written over a member name in the other
					// frame must not reach this one either
					if (typeof localStorage.getItem !== "function") {
						fail(
							"another origin's shadow of a Storage member is visible here: " +
								String(localStorage.getItem)
						);

						return;
					}

					const leaked = localStorage.getItem("storagescope-secret-item");
					if (leaked !== null) {
						fail("localStorage read another origin's item: " + leaked);

						return;
					}

					// the enumerating half: the raw keys carry the other
					// origin's name, so a bare key list is a site list
					const keys = Object.keys(localStorage);
					const foreign = keys.filter(
						(key) => key !== "storagescope-own-item"
					);
					if (foreign.length > 0) {
						fail(
							"localStorage enumerated keys this origin never wrote: " +
								JSON.stringify(foreign)
						);

						return;
					}

					pass();
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "storagewriter",
					js: () =>
						`localStorage.setItem("storagescope-secret-item", "CROSS-ORIGIN-SECRET");
						 localStorage.getItem = "CROSS-ORIGIN-SHADOW";`,
				},
			],
		},
	}),

	// The named-property half of `Storage`, which the wrapper has to emulate
	// rather than intercept. Differential against bare throughout - the
	// interesting answers here are the ones a `getItem` shim gets wrong.
	basicTest({
		name: "storagescope-localstorage-named-properties",
		js: `
			localStorage.clear();

			// absent is undefined, not getItem's null
			assertConsistent("missing", localStorage.nosuchkey);
			assertConsistent("missing typeof", typeof localStorage.nosuchkey);

			localStorage.setItem("present", "");
			assertConsistent("empty string item", localStorage.present);
			assertConsistent("in operator", "present" in localStorage);
			assertConsistent("absent in operator", "nosuchkey" in localStorage);

			// a named property takes a data descriptor and refuses an accessor
			let accessor = "no-throw";
			try {
				Object.defineProperty(localStorage, "acc", { get: () => "1" });
			} catch (error) {
				accessor = error.name;
			}
			assertConsistent("accessor define", accessor);

			let data = "no-throw";
			try {
				Object.defineProperty(localStorage, "dat", {
					value: "5",
					writable: true,
					enumerable: true,
					configurable: true,
				});
			} catch (error) {
				data = error.name;
			}
			assertConsistent("data define", data);
			assertConsistent("data define stored", localStorage.getItem("dat"));

			// a member name is shadowed as an own property, and does not become
			// a stored item
			localStorage.setItem("before", "1");
			localStorage.getItem = "shadowed";
			assertConsistent("shadowed typeof", typeof localStorage.getItem);
			assertConsistent("shadow is not an item", localStorage.length);

			localStorage.clear();
			assertConsistent("cleared", localStorage.length);
		`,
	}),

	// https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
	//
	// `databases()` answers with every database in the storage key. The names
	// are the scoped ones, so without an interceptor it hands the page both the
	// list of every other proxied site that has ever opened a database and the
	// names of those databases - the origin is right there in the string.
	multiFrameTest({
		name: "storagescope-indexeddb-databases-crosses-origins",
		root: {
			js: () => `
				(async () => {
					await new Promise((r) => setTimeout(r, 700));

					if (typeof indexedDB.databases !== "function") {
						pass();

						return;
					}

					const listed = await indexedDB.databases();
					const names = listed.map((entry) => entry.name);

					const foreign = names.filter(
						(name) => name !== "storagescope-own-db"
					);
					if (foreign.length === 0) {
						pass();

						return;
					}

					fail(
						"indexedDB.databases() listed databases this origin never created: " +
							JSON.stringify(foreign)
					);
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "dbwriter",
					js: () => `
						const request = indexedDB.open("storagescope-cross-origin-db", 1);
						request.onupgradeneeded = () => {
							request.result.createObjectStore("store");
						};
					`,
				},
			],
		},
	}),

	// A database name must round-trip through the scoping untouched, including
	// one the page put an "@" in.
	basicTest({
		name: "storagescope-indexeddb-name-round-trips",
		js: `
			const open = (name) =>
				new Promise((resolve, reject) => {
					const request = indexedDB.open(name, 1);
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});

			for (const name of ["plain", "with@at", "@leading", "a@b@c"]) {
				const db = await open("storagescope-" + name);
				assertEqual(
					db.name,
					"storagescope-" + name,
					"database name round-trips: " + name
				);
				db.close();
			}
		`,
	}),

	// https://fs.spec.whatwg.org/#dom-storagemanager-getdirectory
	//
	// `getDirectory()` hands back a scoped subdirectory rather than the real
	// root, and it reaches that subdirectory through
	// `FileSystemDirectoryHandle.prototype.getDirectoryHandle` - a member the
	// page can replace. If it is read off the page's prototype rather than out
	// of the native store, a site chooses which directory it is given, and the
	// real root is one of the choices: from there every other proxied site's
	// OPFS tree is a `for await` away.
	// The negative above only says the page's own `getDirectoryHandle` was not
	// used, which is also true when nothing is scoped at all. This is the
	// positive half: two origins write into what each calls the root, and
	// neither may see the other's file.
	multiFrameTest({
		name: "storagescope-opfs-roots-do-not-cross-origins",
		scramjetOnly: true,
		root: {
			js: () => `
				(async () => {
					if (!navigator.storage || !navigator.storage.getDirectory) {
						pass();

						return;
					}

					const root = await navigator.storage.getDirectory();
					await root.getFileHandle("own.txt", { create: true });

					await new Promise((r) => setTimeout(r, 700));

					const names = [];
					for await (const name of root.keys()) names.push(name);

					const foreign = names.filter((name) => name !== "own.txt");
					if (foreign.length > 0) {
						fail(
							"the OPFS root listed entries this origin never wrote: " +
								JSON.stringify(foreign)
						);

						return;
					}

					pass();
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "opfswriter",
					js: () => `
						(async () => {
							if (!navigator.storage || !navigator.storage.getDirectory) return;
							const root = await navigator.storage.getDirectory();
							await root.getFileHandle("cross-origin.txt", { create: true });
						})().catch(() => {});
					`,
				},
			],
		},
	}),

	basicTest({
		name: "storagescope-opfs-root-not-page-reachable",
		scramjetOnly: true,
		js: `
			if (!navigator.storage || !navigator.storage.getDirectory) {
				pass();
			} else {
				const proto = FileSystemDirectoryHandle.prototype;
				const original = proto.getDirectoryHandle;
				let stolen = null;
				proto.getDirectoryHandle = function (...args) {
					// hand back the receiver - the real origin root - instead of
					// the scoped child scramjet asked for
					stolen = this;

					return Promise.resolve(this);
				};

				let root;
				try {
					root = await navigator.storage.getDirectory();
				} finally {
					proto.getDirectoryHandle = original;
				}

				assert(
					stolen === null,
					"getDirectory() called the page's getDirectoryHandle"
				);
				assert(
					root !== stolen,
					"getDirectory() handed back the unscoped OPFS root"
				);
			}
		`,
	}),
];
