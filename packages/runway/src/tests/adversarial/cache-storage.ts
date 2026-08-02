import { basicTest } from "../../testcommon.ts";

// The Cache API is namespaced per proxied origin the same way IndexedDB and
// localStorage are, so the same un-namespacing duty applies - and it has an
// extra surface the others don't: the Request keys it hands back, whose URLs
// must be the site's.
//
// This is the PWA critical path. The canonical service-worker install step is
// `cache.addAll(PRECACHE)`, and the canonical activate step is
// `caches.keys().then(ns => ns.filter(n => n !== CURRENT).map(caches.delete))`.

export default [
	basicTest({
		name: "cachestorage-put-and-match",
		js: `
			const c = await caches.open("adversarial-cache");
			await c.put("/cached", new Response("cachedbody", { headers: { "Content-Type": "text/plain" } }));
			const m = await c.match("/cached");
			assert(m, "match found the entry");
			assertEqual(await m.text(), "cachedbody", "cached body");
			assertEqual(m.headers.get("content-type"), "text/plain", "cached headers");
			assertEqual((await c.keys()).length, 1, "one entry");
			assertEqual(await caches.has("adversarial-cache"), true, "caches.has");
			assertEqual(await c.delete("/cached"), true, "cache.delete(request)");
			assertEqual(await c.match("/cached"), undefined, "gone after delete");
			await caches.delete("adversarial-cache");
			assertEqual(await caches.has("adversarial-cache"), false, "caches.delete");
		`,
	}),
	basicTest({
		name: "cachestorage-put-fetched-response",
		js: `
			const c = await caches.open("adversarial-cache2");
			await c.put("/script.js", (await fetch("/script.js")).clone());
			const m = await c.match("/script.js");
			assert(m, "a fetched response can be cached");
			assertEqual(m.url, location.origin + "/script.js", "the cached Response.url is the site's");
			assert(!m.url.includes("/~/sj/"), "no proxy URL in the cached response");
			assert((await m.text()).length > 0, "the cached body is readable");
			await caches.delete("adversarial-cache2");
		`,
	}),

	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: caches.keys() reports the namespaced name
		// ("http://site@name" instead of "name"). The standard activate-time
		// cleanup filters this list against a known cache name, so it either
		// matches nothing and deletes every cache, or matches nothing and cleans
		// up none of them.
		name: "cachestorage-keys-not-namespaced",
		js: `
			const c = await caches.open("adversarial-cache3");
			const names = await caches.keys();
			assert(names.includes("adversarial-cache3"), "own cache is listed under its own name: " + JSON.stringify(names));
			assert(!names.some((n) => n.includes("scramjet")), "no proxy-internal caches listed: " + JSON.stringify(names));
			assert(!names.some((n) => n.includes("http")), "no namespaced names: " + JSON.stringify(names));
			await caches.delete("adversarial-cache3");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the Request objects from cache.keys() carry the proxy
		// origin, so code that re-fetches or compares them targets the wrong host.
		name: "cachestorage-request-keys-urls",
		js: `
			const c = await caches.open("adversarial-cache4");
			await c.put("/cached", new Response("x"));
			const keys = await c.keys();
			assertEqual(keys[0].url, location.origin + "/cached", "the cache Request key URL is the site's");
			assert(!keys[0].url.includes(":4500"), "no proxy origin in the cache key: " + keys[0].url);
			await caches.delete("adversarial-cache4");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: cache.add and cache.addAll reject with "Request failed".
		// addAll is how every precaching service worker populates its cache.
		name: "cachestorage-add-and-addall",
		js: `
			const c = await caches.open("adversarial-cache5");
			let addErr;
			try { await c.add("/script.js"); } catch (e) { addErr = e; }
			assert(!addErr, "cache.add must work: " + (addErr && addErr.message));
			let allErr;
			try { await c.addAll(["/script.js"]); } catch (e) { allErr = e; }
			assert(!allErr, "cache.addAll must work: " + (allErr && allErr.message));
			assert(await c.match("/script.js"), "the added entry is retrievable");
			await caches.delete("adversarial-cache5");
		`,
	}),
];
