import { basicTest, serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// The Cache API is the only persistent, URL-keyed store the page can reach, so
// it is where "the proxy URL is not a function of the real URL" stops being
// cosmetic and starts losing data.
//
// rewriteUrl stamps the call site into the query: $tf/$pf are per-frame
// randomness from createFrameId() (Math.random, fresh every load), and
// $mode/$cred/$dest/$rfp/$io vary per call site within a single load. Any key
// derived from a proxy URL is therefore unreachable after a reload, and often
// from a different call site in the same page.
//
// These tests pin the key to the resource, not to how it was asked for.

const differential = (name: string, js: string) =>
	basicTest({
		name: `cachekey-${name}`,
		js: `
			const snapshot = async () => {
				try {
					return { value: await (${js}) };
				} catch (error) {
					return { error: error && error.name, message: error && error.message };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

export default [
	// --- the key must not carry the call site -------------------------------

	basicTest({
		name: "cachekey-mode-variants-share-one-key",
		js: `
			const c = await caches.open("ck-mode");
			try {
				// the same resource, requested four different ways. a real browser
				// keys all four identically; a proxy URL carrying $mode/$cred does not
				const variants = [
					new Request("/script.js"),
					new Request("/script.js", { mode: "no-cors" }),
					new Request("/script.js", { mode: "same-origin" }),
					new Request("/script.js", { credentials: "include" }),
				];
				await c.put(variants[1], new Response("stored-via-no-cors"));
				const misses = [];
				for (let i = 0; i < variants.length; i++) {
					const m = await c.match(variants[i]);
					if (!m) misses.push(i);
				}
				assertEqual((await c.keys()).length, 1, "one entry, not one per mode");
				assertEqual(misses.length, 0, "these request variants missed the shared key: " + misses.join(","));
				assertEqual(await (await c.match("/script.js")).text(), "stored-via-no-cors", "a plain string key matches too");
			} finally {
				await caches.delete("ck-mode");
			}
		`,
	}),

	basicTest({
		name: "cachekey-subresource-and-fetch-share-one-key",
		js: `
			const c = await caches.open("ck-subresource");
			try {
				// document.currentScript.src went through the HTML rewriter, so its
				// proxy URL carries $tf/$pf/$dest; a fetch() of the same path does
				// not. Both must land on the same cache key.
				const el = document.querySelector('script[src]');
				assert(el, "the harness script tag is present");
				const fromElement = el.src;
				assert(!fromElement.includes("/~/sj/"), "the element's src reads back unrewritten: " + fromElement);

				await c.put("/script.js", new Response("stored"));
				const m = await c.match(fromElement);
				assert(m, "an element-derived URL matches a fetch-derived key");
				assertEqual(await m.text(), "stored", "same entry");
			} finally {
				await caches.delete("ck-subresource");
			}
		`,
	}),

	basicTest({
		name: "cachekey-keys-returns-site-urls",
		js: `
			const c = await caches.open("ck-keys");
			try {
				await c.put("/a", new Response("a"));
				await c.put(location.origin + "/b?x=1", new Response("b"));
				await c.put(new Request("/c", { headers: { "X-K": "1" } }), new Response("c"));
				const keys = await c.keys();
				assertEqual(keys.length, 3, "three entries");
				for (const k of keys) {
					assert(k instanceof Request, "keys() yields Requests");
					assert(k.url.startsWith(location.origin + "/"), "key is a site URL: " + k.url);
					assert(!k.url.includes("/~/sj/"), "no proxy prefix in a key: " + k.url);
					assert(!k.url.includes("$tf="), "no frame param in a key: " + k.url);
					assertEqual(k.method, "GET", "cache keys are GET");
				}
				const urls = keys.map((k) => k.url).sort();
				assertEqual(urls[0], location.origin + "/a", "key a");
				assertEqual(urls[1], location.origin + "/b?x=1", "key b keeps its real query");
				assertEqual(urls[2], location.origin + "/c", "key c");
			} finally {
				await caches.delete("ck-keys");
			}
		`,
	}),

	// The real URL's query has to survive as a *query*, not be swallowed into
	// an encoded path segment - otherwise ignoreSearch silently becomes an
	// exact match, because it strips the proxy's params instead of the site's.
	basicTest({
		name: "cachekey-ignore-search",
		js: `
			const c = await caches.open("ck-search");
			try {
				await c.put("/q?v=1", new Response("one"));
				assert(await c.match("/q?v=1"), "exact match");
				assertEqual(await c.match("/q?v=2"), undefined, "a different query does not match by default");
				assertEqual(await c.match("/q"), undefined, "no query does not match by default");

				const m2 = await c.match("/q?v=2", { ignoreSearch: true });
				assert(m2, "ignoreSearch matches across a different query");
				assertEqual(await m2.text(), "one", "and returns the stored entry");

				const m3 = await c.match("/q", { ignoreSearch: true });
				assert(m3, "ignoreSearch matches with no query at all");

				const all = await c.matchAll("/q?v=9", { ignoreSearch: true });
				assertEqual(all.length, 1, "matchAll honours ignoreSearch");
			} finally {
				await caches.delete("ck-search");
			}
		`,
	}),

	basicTest({
		name: "cachekey-ignore-method",
		js: `
			const c = await caches.open("ck-method");
			try {
				await c.put("/m", new Response("m"));
				const head = new Request("/m", { method: "HEAD" });
				assertEqual(await c.match(head), undefined, "a HEAD request does not match by default");
				assert(await c.match(head, { ignoreMethod: true }), "ignoreMethod matches");
			} finally {
				await caches.delete("ck-method");
			}
		`,
	}),

	serverTest({
		name: "cachekey-vary-matching",
		autoPass: true,
		js: `
			const c = await caches.open("ck-vary");
			try {
				const stored = new Response("varied", { headers: { Vary: "X-Variant", "Content-Type": "text/plain" } });
				await c.put(new Request("/v", { headers: { "X-Variant": "a" } }), stored);

				const same = await c.match(new Request("/v", { headers: { "X-Variant": "a" } }));
				assert(same, "the matching variant is found");
				assertEqual(await same.text(), "varied", "body");

				const other = await c.match(new Request("/v", { headers: { "X-Variant": "b" } }));
				assertEqual(other, undefined, "a different variant does not match");

				const ignored = await c.match(new Request("/v", { headers: { "X-Variant": "b" } }), { ignoreVary: true });
				assert(ignored, "ignoreVary matches anyway");
			} finally {
				await caches.delete("ck-vary");
			}
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				res.writeHead(404);
				res.end();
			});
		},
	}),

	// --- put() rejections -----------------------------------------------------

	differential(
		"put-206-rejects",
		`(async () => {
			const c = await caches.open("ck-206");
			try { await c.put("/p", new Response("x", { status: 206 })); return "no throw"; }
			finally { await caches.delete("ck-206"); }
		})()`
	),
	differential(
		"put-vary-star-rejects",
		`(async () => {
			const c = await caches.open("ck-varystar");
			try { await c.put("/p", new Response("x", { headers: { Vary: "*" } })); return "no throw"; }
			finally { await caches.delete("ck-varystar"); }
		})()`
	),
	differential(
		"put-non-get-rejects",
		`(async () => {
			const c = await caches.open("ck-post");
			try { await c.put(new Request("/p", { method: "POST", body: "b" }), new Response("x")); return "no throw"; }
			finally { await caches.delete("ck-post"); }
		})()`
	),
	differential(
		"put-used-body-rejects",
		`(async () => {
			const c = await caches.open("ck-used");
			try {
				const r = new Response("x");
				await r.text();
				await c.put("/p", r);
				return "no throw";
			} finally { await caches.delete("ck-used"); }
		})()`
	),
	differential(
		"put-non-http-scheme-rejects",
		`(async () => {
			const c = await caches.open("ck-scheme");
			try { await c.put("data:text/plain,x", new Response("x")); return "no throw"; }
			finally { await caches.delete("ck-scheme"); }
		})()`
	),

	basicTest({
		name: "cachekey-put-consumes-the-response-body",
		js: `
			const c = await caches.open("ck-consume");
			try {
				const r = new Response("body");
				assertEqual(r.bodyUsed, false, "unused before put");
				await c.put("/x", r);
				assertEqual(r.bodyUsed, true, "put consumed the body");
				// which is why the idiom is to clone before caching
				const f = await fetch("/script.js");
				await c.put("/y", f.clone());
				assert((await f.text()).length > 0, "the clone left the original readable");
			} finally {
				await caches.delete("ck-consume");
			}
		`,
	}),

	// --- add / addAll, which fetch and key atomically inside the native -------

	serverTest({
		name: "cachekey-add-rejects-non-ok",
		autoPass: true,
		js: `
			const c = await caches.open("ck-add");
			try {
				assert(await c.add("/ok200") === undefined, "add of a 200 resolves");
				assert(await c.match("/ok200"), "and stored it");

				let threw = null;
				try { await c.add("/gone404"); } catch (e) { threw = e && e.name; }
				assertEqual(threw, "TypeError", "add of a 404 rejects with TypeError, got " + threw);
				assertEqual(await c.match("/gone404"), undefined, "and stored nothing");

				let threw5 = null;
				try { await c.add("/err500"); } catch (e) { threw5 = e && e.name; }
				assertEqual(threw5, "TypeError", "add of a 500 rejects, got " + threw5);
			} finally {
				await caches.delete("ck-add");
			}
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/ok200") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("ok200");
					return;
				}
				if (path === "/err500") {
					res.writeHead(500, { "Content-Type": "text/plain" });
					res.end("boom");
					return;
				}
				res.writeHead(404);
				res.end("nope");
			});
		},
	}),

	serverTest({
		name: "cachekey-addall-is-atomic",
		autoPass: true,
		js: `
			const c = await caches.open("ck-addall");
			try {
				let threw = null;
				try { await c.addAll(["/ok200", "/gone404", "/ok201"]); } catch (e) { threw = e && e.name; }
				assertEqual(threw, "TypeError", "addAll rejects when any entry fails, got " + threw);
				const keys = await c.keys();
				assertEqual(keys.length, 0, "and wrote nothing at all: " + keys.map((k) => k.url).join(","));

				await c.addAll(["/ok200", "/ok201"]);
				assertEqual((await c.keys()).length, 2, "a fully-successful addAll writes everything");
			} finally {
				await caches.delete("ck-addall");
			}
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/ok200" || path === "/ok201") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end(path);
					return;
				}
				res.writeHead(404);
				res.end("nope");
			});
		},
	}),

	serverTest({
		name: "cachekey-addall-duplicate-keys",
		autoPass: true,
		js: `
			const c = await caches.open("ck-dup");
			try {
				let name = null;
				try { await c.addAll(["/ok200", "/ok200"]); } catch (e) { name = e && e.name; }
				assertEqual(name, "InvalidStateError", "duplicate entries reject with InvalidStateError, got " + name);

				// canonicalisation can MANUFACTURE a duplicate: these are two
				// distinct proxy URLs for one resource
				let name2 = null;
				try {
					await c.addAll([new Request("/ok200"), new Request("/ok200", { mode: "same-origin" })]);
				} catch (e) { name2 = e && e.name; }
				ok("mode-variant duplicate rejected as: " + name2);
				const keys = await c.keys();
				assert(keys.length <= 1, "at most one entry survives, not a silent overwrite of two: " + keys.length);
			} finally {
				await caches.delete("ck-dup");
			}
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/ok200") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("ok200");
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),

	// --- what comes back out ------------------------------------------------

	serverTest({
		name: "cachekey-retrieved-response-is-fully-corrected",
		autoPass: true,
		js: `
			const c = await caches.open("ck-retrieve");
			try {
				await c.put("/hdr", (await fetch("/hdr")).clone());
				const m = await c.match("/hdr");
				assert(m, "stored and retrieved");

				// a cache.match() Response is a FRESH object each call, so a
				// provenance tag applied at fetch() time cannot ride along - but it
				// did come off the network and still holds proxy URLs internally
				assertEqual(m.url, location.origin + "/hdr", "cached Response.url is the site's");
				assert(!m.url.includes("/~/sj/"), "no prefix in the cached url");

				const names = [...m.headers.keys()];
				assert(!names.some((n) => n.startsWith("x-scramjet-")), "no carrier headers survive caching: " + names.join(","));
				const link = m.headers.get("link");
				assert(link === null || !link.includes("/~/sj/"), "cached Link is unrewritten: " + link);
				assertEqual(m.headers.get("content-security-policy"), "default-src 'self'", "cached CSP is restored");
				assertEqual(await m.text(), "hdrbody", "cached body");

				const again = await c.match("/hdr");
				assert(again !== m, "each match() mints a fresh Response object");
				assertEqual(again.url, m.url, "and the fresh one is corrected too");
				assert(![...again.headers.keys()].some((n) => n.startsWith("x-scramjet-")), "including its headers");
			} finally {
				await caches.delete("ck-retrieve");
			}
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/hdr") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Content-Security-Policy": "default-src 'self'",
						Link: "</style.css>; rel=preload; as=style",
					});
					res.end("hdrbody");
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),

	basicTest({
		name: "cachekey-matchall-and-delete",
		js: `
			const c = await caches.open("ck-matchall");
			try {
				await c.put("/a", new Response("a"));
				await c.put("/b", new Response("b"));
				assertEqual((await c.matchAll()).length, 2, "matchAll with no argument returns everything");
				assertEqual((await c.matchAll("/a")).length, 1, "matchAll with a key");
				assertEqual((await c.matchAll("/nope")).length, 0, "matchAll with a miss");

				assertEqual(await c.delete("/nope"), false, "delete of a miss returns false");
				assertEqual(await c.delete("/a"), true, "delete of a hit returns true");
				assertEqual((await c.keys()).length, 1, "one left");
				assertEqual(await c.delete("/b", { ignoreSearch: true }), true, "delete honours options");
				assertEqual((await c.keys()).length, 0, "empty");
			} finally {
				await caches.delete("ck-matchall");
			}
		`,
	}),

	// --- CacheStorage-level scoping -----------------------------------------

	basicTest({
		name: "cachekey-caches-keys-are-unprefixed",
		js: `
			const before = await caches.keys();
			assert(!before.some((n) => n.includes("@")), "no origin-scoping visible in caches.keys(): " + before.join(","));
			assert(!before.some((n) => n.toLowerCase().includes("scramjet")), "no proxy caches visible: " + before.join(","));

			await caches.open("ck-visible");
			try {
				const after = await caches.keys();
				assert(after.includes("ck-visible"), "the name round-trips exactly: " + after.join(","));
				assertEqual(await caches.has("ck-visible"), true, "caches.has");
				assertEqual(await caches.has("ck-visible@"), false, "a scoped spelling is not a real name");
			} finally {
				await caches.delete("ck-visible");
			}
			assertEqual(await caches.has("ck-visible"), false, "deleted");
		`,
	}),

	basicTest({
		name: "cachekey-caches-match-without-cachename",
		js: `
			// CacheStorage.match with no cacheName searches EVERY cache in the
			// origin in creation order. Under a proxy that origin holds every
			// proxied site's caches plus the proxy's own.
			const c1 = await caches.open("ck-cs-one");
			const c2 = await caches.open("ck-cs-two");
			try {
				await c1.put("/only-in-one", new Response("one"));
				await c2.put("/only-in-two", new Response("two"));

				const m1 = await caches.match("/only-in-one");
				assert(m1, "found across caches");
				assertEqual(await m1.text(), "one", "correct entry");

				const scoped = await caches.match("/only-in-two", { cacheName: "ck-cs-two" });
				assert(scoped, "found with an explicit cacheName");
				assertEqual(await caches.match("/only-in-one", { cacheName: "ck-cs-two" }), undefined,
					"cacheName really restricts the search");
				assertEqual(await caches.match("/nowhere"), undefined, "a genuine miss is undefined");
			} finally {
				await caches.delete("ck-cs-one");
				await caches.delete("ck-cs-two");
			}
		`,
	}),

	differential(
		"caches-match-unknown-cachename",
		`caches.match("/x", { cacheName: "definitely-not-open" })`
	),
	differential("caches-open-empty-name", `caches.open("").then(() => "ok")`),
	differential(
		"caches-match-options-not-a-dictionary",
		`caches.match("/x", 5)`
	),
	differential("caches-delete-unknown", `caches.delete("definitely-not-open")`),

	basicTest({
		name: "cachekey-name-round-trips-exotic-strings",
		js: `
			// the internal namespace uses "origin@name", so a name containing the
			// separator must not be able to escape it or collide
			const names = ["a@b", "@", "with space", "with/slash", "ünïcode", "1"];
			try {
				for (const n of names) {
					const c = await caches.open(n);
					await c.put("/x", new Response(n));
				}
				const listed = await caches.keys();
				for (const n of names) {
					assert(listed.includes(n), "name round-trips: " + JSON.stringify(n) + " in " + JSON.stringify(listed));
					const c = await caches.open(n);
					assertEqual(await (await c.match("/x")).text(), n, "each name has its own storage: " + n);
				}
			} finally {
				for (const n of names) await caches.delete(n);
			}
		`,
	}),
];
