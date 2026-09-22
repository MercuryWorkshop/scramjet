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
	basicTest({
		name: "cachestorage-request-input-matrix",
		js: `
			const cacheName = "request-input-matrix";
			const c = await caches.open(cacheName);
			const absoluteURL = location.origin + "/matrix-absolute";
			const request = new Request("/matrix-request", { headers: { "X-Input": "request" } });

			await c.put("/matrix-relative", new Response("relative"));
			await c.put(absoluteURL, new Response("absolute"));
			await c.put(request, new Response("request"));

			assertEqual(await (await c.match("/matrix-relative")).text(), "relative", "relative string key");
			assertEqual(await (await c.match(absoluteURL)).text(), "absolute", "absolute string key");
			assertEqual(await (await c.match(request)).text(), "request", "Request object key");
			assertEqual(await (await caches.match(request, { cacheName })).text(), "request", "CacheStorage.match Request with cacheName");
			assertEqual(await (await caches.match("/matrix-relative", { cacheName })).text(), "relative", "CacheStorage.match string with cacheName");

			const urls = (await c.keys()).map((key) => key.url).sort();
			assertDeepEqual(urls, [
				location.origin + "/matrix-absolute",
				location.origin + "/matrix-relative",
				location.origin + "/matrix-request",
			].sort(), "all stored Request URLs are site-facing");
			assert(!urls.some((url) => url.includes(":4500") || url.includes("/~/sj/")), "no stored Request URL leaks the proxy");

			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-query-ignore-search",
		js: `
			const cacheName = "query-ignore-search";
			const c = await caches.open(cacheName);
			await c.put("/query?q=one", new Response("search"));

			const otherSearch = new Request("/query?q=two");
			assertEqual(await c.match(otherSearch), undefined, "search differs by default");
			assert(await c.match(otherSearch, { ignoreSearch: true }), "ignoreSearch matches");
			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-query-ignore-vary",
		js: `
			const cacheName = "query-ignore-vary";
			const c = await caches.open(cacheName);

			const cachedVaryRequest = new Request("/vary", { headers: { "X-Variant": "one" } });
			await c.put(cachedVaryRequest, new Response("variant", { headers: { "Vary": "X-Variant" } }));
			const otherHeader = new Request("/vary", { headers: { "X-Variant": "two" } });
			assertEqual(await c.match(otherHeader), undefined, "Vary differs by default");
			assert(await c.match(otherHeader, { ignoreVary: true }), "ignoreVary matches");
			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-query-ignore-method",
		js: `
			const cacheName = "query-ignore-method";
			const c = await caches.open(cacheName);

			await c.put("/method", new Response("method"));
			const post = new Request("/method", { method: "POST", body: "body" });
			assertEqual(await c.match(post), undefined, "non-GET query does not match by default");
			assert(await c.match(post, { ignoreMethod: true }), "ignoreMethod matches a non-GET query");
			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-query-excludes-fragments",
		js: `
			const cacheName = "query-excludes-fragments";
			const c = await caches.open(cacheName);

			await c.put("/fragment#stored", new Response("fragment"));
			assert(await c.match("/fragment#different"), "URL fragments are excluded from matching");
			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-response-url-matrix",
		js: `
			const cacheName = "response-url-matrix";
			const c = await caches.open(cacheName);
			const fetched = await fetch("/script.js");
			assertEqual(fetched.url, location.origin + "/script.js", "fetched response URL is site-facing");

			await c.put("/fetched-response", fetched.clone());
			const cachedFetched = await c.match("/fetched-response");
			assertEqual(cachedFetched.url, location.origin + "/script.js", "cached fetched Response retains its source URL");
			assert(!cachedFetched.url.includes(":4500") && !cachedFetched.url.includes("/~/sj/"), "cached fetched Response does not leak proxy URL");
			assertEqual(cachedFetched.status, 200, "fetched response status survives cache");
			assertEqual(cachedFetched.headers.get("content-type"), "application/javascript", "fetched response headers survive cache");

			const synthetic = new Response("synthetic", { status: 201, headers: { "X-Synthetic": "yes" } });
			await c.put("/synthetic-response", synthetic.clone());
			const cachedSynthetic = await c.match("/synthetic-response");
			assertEqual(cachedSynthetic.url, "", "synthetic Response keeps an empty URL");
			assertEqual(cachedSynthetic.status, 201, "synthetic status survives cache");
			assertEqual(cachedSynthetic.headers.get("x-synthetic"), "yes", "synthetic headers survive cache");
			assertEqual(await cachedSynthetic.text(), "synthetic", "synthetic body survives cache");

			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-request-key-roundtrip-fetch",
		js: `
			const cacheName = "request-key-roundtrip";
			const c = await caches.open(cacheName);
			await c.add("/script.js");

			const [key] = await c.keys();
			assertEqual(key.url, location.origin + "/script.js", "Cache.keys Request URL is site-facing");
			assert(!key.url.includes(":4500") && !key.url.includes("/~/sj/"), "Cache.keys Request hides proxy URL");
			assert(await c.match(key), "returned Request key matches its cached entry");

			const response = await fetch(key);
			assertEqual(response.status, 200, "returned Request key can be fetched");
			assertEqual(response.url, location.origin + "/script.js", "re-fetching a key remains site-facing");
			assert((await response.text()).includes("runTest"), "re-fetched key has the origin body");

			const clone = new Request(key);
			assertEqual(clone.url, location.origin + "/script.js", "cloning a returned key preserves the site URL");
			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-fetch-input-matrix",
		js: `
			const siteURL = new URL("/script.js", location.href);
			const fromString = await fetch("/script.js");
			const fromURL = await fetch(siteURL);
			const requestFromURL = new Request(siteURL);
			const fromRequest = await fetch(requestFromURL);

			for (const [label, response] of [["string", fromString], ["URL", fromURL], ["Request", fromRequest]]) {
				assertEqual(response.status, 200, label + " fetch succeeds");
				assertEqual(response.url, location.origin + "/script.js", label + " fetch URL is site-facing");
				assert(!response.url.includes(":4500") && !response.url.includes("/~/sj/"), label + " fetch hides proxy URL");
			}
			assertEqual(requestFromURL.url, location.origin + "/script.js", "Request constructed from URL is site-facing");
		`,
	}),
	basicTest({
		name: "cachestorage-webidl-conversion-once",
		js: `
			const cacheName = "webidl-conversion-once";
			const c = await caches.open(cacheName);
			await c.put("/conversion", new Response("converted"));

			let requestConversions = 0;
			const requestLike = { toString() { requestConversions++; return "/conversion"; } };
			assert(await c.match(requestLike), "stringifiable RequestInfo matches");
			assertEqual(requestConversions, 1, "RequestInfo is converted once");

			const order = [];
			const proto = {};
			for (const name of ["cacheName", "ignoreMethod", "ignoreSearch", "ignoreVary"]) {
				Object.defineProperty(proto, name, {
					get() { order.push(name); return name === "cacheName" ? cacheName : false; },
				});
			}
			const options = Object.create(proto);
			assert(await caches.match("/conversion", options), "inherited MultiCacheQueryOptions work");
			assertDeepEqual(order, ["ignoreMethod", "ignoreSearch", "ignoreVary", "cacheName"], "dictionary getters run once in Web IDL order");

			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-matchall-keys-delete-filters",
		js: `
			const cacheName = "filter-matrix";
			const c = await caches.open(cacheName);
			await c.put("/filter-a", new Response("a"));
			await c.put("/filter-b", new Response("b"));

			assertEqual((await c.matchAll()).length, 2, "unfiltered matchAll returns every response");
			assertEqual((await c.matchAll("/filter-a")).length, 1, "matchAll filters by string request");
			assertEqual((await c.keys(new Request("/filter-b"))).length, 1, "keys filters by Request");
			assertEqual(await c.delete(new Request("/filter-a")), true, "delete accepts Request");
			assertEqual(await c.delete("/filter-a"), false, "delete reports no second match");
			assertEqual(await (await c.match("/filter-b")).text(), "b", "delete leaves other entries intact");

			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-url-object-inputs",
		js: `
			const cacheName = "url-object-inputs";
			const c = await caches.open(cacheName);
			const url = new URL("/url-object", location.href);
			await c.put(url, new Response("url"));

			assertEqual(await (await c.match(url)).text(), "url", "URL object is converted as USVString");
			assertEqual((await c.keys(url))[0].url, url.href, "URL object filter returns a site-facing key");
			assertEqual(await c.delete(url), true, "URL object works for delete");

			await caches.delete(cacheName);
		`,
	}),
	basicTest({
		name: "cachestorage-response-body-lifecycle",
		js: `
			const cacheName = "response-body-lifecycle";
			const c = await caches.open(cacheName);
			const response = new Response("readable");
			await c.put("/readable", response);
			assertEqual(response.bodyUsed, true, "put consumes the caller's response body");
			let rereadError;
			try { await response.text(); } catch (caught) { rereadError = caught; }
			assert(rereadError instanceof TypeError, "the consumed caller response cannot be read again");
			assertEqual(await (await c.match("/readable")).text(), "readable", "cached body has an independent stream");

			const consumed = new Response("consumed");
			await consumed.text();
			let error;
			try { await c.put("/consumed", consumed); } catch (caught) { error = caught; }
			assert(error instanceof TypeError, "put rejects a consumed response with TypeError");
			assertEqual(await c.match("/consumed"), undefined, "failed put creates no entry");

			await caches.delete(cacheName);
		`,
	}),

	// ------------------------------------------------------------------
	basicTest({
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
