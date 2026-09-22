import { basicTest, serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// The service worker does five different things to a response's headers: it
// copies every original as `X-Scramjet-<name>`, deletes the ~18 security
// headers, deletes permissions-policy and set-cookie, and rewrites the
// URL-bearing ones (location, content-location, referer) and link.
//
// So the client-side Headers a page sees is not a lightly-patched view of the
// native one - it is a different header list, with different names, different
// values, and a different sort order. Every read path has to agree on it.
//
// The paths are: get, has, entries, keys, values, forEach, @@iterator (which
// is the SAME function object as entries), and the HeadersInit fill that
// `new Headers(h)` / `new Request(u, {headers: h})` / `fetch(u, {headers: h})`
// perform by iterating. forEach does NOT go through the iterator - Web IDL's
// generated forEach walks the value pairs directly - so it is its own path.

const SECURITY_HEADERS = {
	"Content-Security-Policy": "default-src 'self'; script-src 'nonce-abc'",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "require-corp",
	"Cross-Origin-Resource-Policy": "same-site",
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Strict-Transport-Security": "max-age=31536000",
	"Permissions-Policy": "geolocation=()",
	"X-XSS-Protection": "1; mode=block",
};

const withHeaders = (extra: Record<string, string>) => (server: any) => {
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		if (path === "/hdr") {
			res.writeHead(200, { "Content-Type": "text/plain", ...extra });
			res.end("hdrbody");
			return;
		}
		res.writeHead(404);
		res.end();
	});
};

const differential = (name: string, js: string) =>
	basicTest({
		name: `hdrview-${name}`,
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
	// --- the carrier must not be visible through ANY path -------------------

	basicTest({
		name: "hdrview-no-carrier-through-any-read-path",
		js: `
			const h = (await fetch("/script.js")).headers;
			const leaked = [];

			const check = (label, names) => {
				for (const n of names) {
					if (String(n).toLowerCase().startsWith("x-scramjet-")) leaked.push(label + ":" + n);
				}
			};

			check("entries", [...h.entries()].map((e) => e[0]));
			check("keys", [...h.keys()]);
			check("for-of", [...h].map((e) => e[0]));
			check("spread", Array.from(h).map((e) => e[0]));
			check("fromEntries", Object.keys(Object.fromEntries(h)));
			check("new Headers", [...new Headers(h).keys()]);
			check("request-init", [...new Request("/x", { headers: h }).headers.keys()]);
			check("response-init", [...new Response("x", { headers: h }).headers.keys()]);

			const seen = [];
			h.forEach((v, k) => seen.push(k));
			check("forEach", seen);

			assertEqual(leaked.length, 0, "carrier headers leaked through: " + leaked.join(", "));

			// and not one at a time either
			assertEqual(h.get("x-scramjet-content-type"), null, "get() must not read the carrier");
			assertEqual(h.has("x-scramjet-content-type"), false, "has() must not see the carrier");
			assertEqual(h.get("X-Scramjet-Content-Type"), null, "get() is case-insensitive about it too");
		`,
	}),

	// get() and has() are separately implemented and drift apart easily: one
	// consults the carrier and falls back to the live value, the other only
	// consults the carrier. They must agree for every name, in both directions.
	basicTest({
		name: "hdrview-get-and-has-agree",
		js: `
			const h = (await fetch("/script.js")).headers;
			const disagree = [];
			for (const [name] of h.entries()) {
				if (h.has(name) !== (h.get(name) !== null)) {
					disagree.push(name + " has=" + h.has(name) + " get=" + JSON.stringify(h.get(name)));
				}
			}
			// names that are NOT in the list must be absent through both
			for (const name of ["x-scramjet-content-type", "x-not-here", "set-cookie"]) {
				if (h.has(name) !== (h.get(name) !== null)) {
					disagree.push(name + " has=" + h.has(name) + " get=" + JSON.stringify(h.get(name)));
				}
			}
			assertEqual(disagree.length, 0, "get/has disagree on: " + disagree.join(" | "));
		`,
	}),

	basicTest({
		name: "hdrview-every-path-agrees-with-entries",
		js: `
			const h = (await fetch("/script.js")).headers;
			const entries = [...h.entries()];
			const asObj = JSON.stringify(entries);

			assertEqual(JSON.stringify([...h]), asObj, "@@iterator matches entries");
			assertEqual(JSON.stringify(Array.from(h)), asObj, "Array.from matches entries");
			assertEqual(JSON.stringify([...h.keys()]), JSON.stringify(entries.map((e) => e[0])), "keys matches entries");
			assertEqual(JSON.stringify([...h.values()]), JSON.stringify(entries.map((e) => e[1])), "values matches entries");

			const viaForEach = [];
			h.forEach((v, k) => viaForEach.push([k, v]));
			assertEqual(JSON.stringify(viaForEach), asObj, "forEach matches entries");

			assertEqual(JSON.stringify([...new Headers(h).entries()]), asObj, "a refilled Headers matches");

			for (const [k, v] of entries) {
				assertEqual(h.get(k), v, "get(" + k + ") matches its iterated value");
			}
		`,
	}),

	// Restoring `x-scramjet-content-security-policy` to `content-security-policy`
	// moves it from the x-region to the c-region of a lexicographic sort, so a
	// view corrected entry-by-entry as the native iterator walks would emit them
	// out of order.
	basicTest({
		name: "hdrview-iteration-is-sorted",
		js: `
			const h = (await fetch("/script.js")).headers;
			const names = [...h.keys()];
			const sorted = names.slice().sort();
			assertEqual(JSON.stringify(names), JSON.stringify(sorted), "header iteration is lexicographically sorted");
			assertEqual(JSON.stringify(names.map((n) => n.toLowerCase())), JSON.stringify(names), "names are lowercased");
		`,
	}),

	serverTest({
		name: "hdrview-restores-stripped-security-headers",
		autoPass: true,
		js: `
			const h = (await fetch("/hdr")).headers;
			const expected = ${JSON.stringify(SECURITY_HEADERS)};
			const missing = [];
			const wrong = [];
			for (const name of Object.keys(expected)) {
				const got = h.get(name);
				if (got === null) missing.push(name);
				else if (got !== expected[name]) wrong.push(name + ": " + JSON.stringify(got));
			}
			// These are stripped from the wire so the proxy can function at all,
			// but the page is entitled to read what the origin actually sent.
			ok("missing=" + JSON.stringify(missing) + " wrong=" + JSON.stringify(wrong));
			assertEqual(missing.length + wrong.length, 0,
				"security headers not faithfully restored. missing=" + missing.join(",") + " wrong=" + wrong.join(","));
		`,
		start: async (server) => withHeaders(SECURITY_HEADERS)(server),
	}),

	serverTest({
		name: "hdrview-link-header-unrewritten",
		autoPass: true,
		js: `
			const link = (await fetch("/hdr")).headers.get("link");
			assert(link !== null, "Link header is exposed");
			assert(!link.includes("/~/sj/"), "no proxy prefix in Link: " + link);
			assert(!link.includes("$tf="), "no frame param in Link: " + link);
			assert(link.includes("/style.css"), "the original target survives: " + link);
			assert(link.includes("rel=preload"), "the rel survives: " + link);
		`,
		start: async (server) =>
			withHeaders({
				Link: "</style.css>; rel=preload; as=style, </font.woff2>; rel=preload; as=font",
			})(server),
	}),

	serverTest({
		name: "hdrview-content-location-unrewritten",
		autoPass: true,
		js: `
			const h = (await fetch("/hdr")).headers;
			const cl = h.get("content-location");
			assert(cl !== null, "Content-Location is exposed");
			assert(!cl.includes("/~/sj/"), "no proxy prefix in Content-Location: " + cl);
			assert(cl.endsWith("/canonical"), "the original value survives: " + cl);
		`,
		start: async (server) =>
			withHeaders({ "Content-Location": "/canonical" })(server),
	}),

	serverTest({
		name: "hdrview-unusual-header-shapes",
		autoPass: true,
		js: `
			const h = (await fetch("/hdr")).headers;
			// duplicates are combined with ", " on read
			assertEqual(h.get("x-dup"), "a, b", "duplicate headers combine: " + JSON.stringify(h.get("x-dup")));
			assertEqual(h.get("x-empty"), "", "an empty value stays empty");
			assertEqual(h.get("x-spaces"), "trimmed", "surrounding whitespace is trimmed");
			assertEqual(h.get("X-CASE"), h.get("x-case"), "get is case-insensitive");
			assertEqual(h.has("X-CASE"), h.has("x-case"), "has is case-insensitive");
			assert(h.get("x-comma").includes(","), "a comma inside a single value survives: " + h.get("x-comma"));
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/hdr") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"X-Dup": ["a", "b"],
						"X-Empty": "",
						"X-Spaces": "  trimmed  ",
						"X-Case": "value",
						"X-Comma": "one, two",
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
		name: "hdrview-foreach-passes-the-headers-itself",
		js: `
			const h = (await fetch("/script.js")).headers;
			const thisArg = {};
			let calls = 0;
			h.forEach(function (value, key, object) {
				calls++;
				assert(object === h, "forEach's third argument is the Headers being iterated");
				assert(this === thisArg, "and thisArg is honoured");
			}, thisArg);
			assert(calls > 0, "forEach visited the headers");
		`,
	}),
	differential(
		"foreach-non-callable-throws",
		`(async () => { (await fetch("/script.js")).headers.forEach(5); return "no throw"; })()`
	),

	// --- the guard, which reconstruction silently downgrades ----------------

	differential(
		"fetched-headers-are-immutable",
		`(async () => { (await fetch("/script.js")).headers.set("x-a", "b"); return "no throw"; })()`
	),
	differential(
		"fetched-headers-append-immutable",
		`(async () => { (await fetch("/script.js")).headers.append("x-a", "b"); return "no throw"; })()`
	),
	differential(
		"fetched-headers-delete-immutable",
		`(async () => { (await fetch("/script.js")).headers.delete("content-type"); return "no throw"; })()`
	),
	differential(
		"constructed-response-headers-are-mutable",
		`(() => { const r = new Response("x"); r.headers.set("x-a", "b"); return r.headers.get("x-a"); })()`
	),
	differential(
		"request-headers-forbidden-name-is-a-noop",
		`(() => { const r = new Request("/x", { headers: { Host: "evil" } }); return r.headers.get("host"); })()`
	),

	basicTest({
		name: "hdrview-headers-object-identity",
		js: `
			const r = await fetch("/script.js");
			assert(r.headers === r.headers, "Response.headers is a stable object");
			const req = new Request("/x");
			assert(req.headers === req.headers, "Request.headers is a stable object");
			// and a per-instance method wrapper would show up here
			assert(r.headers.get === Headers.prototype.get, "get is not wrapped per instance");
			assert(r.headers.entries === Headers.prototype.entries, "entries is not wrapped per instance");
		`,
	}),

	// --- untagged Headers must be left completely alone ---------------------

	basicTest({
		name: "hdrview-constructed-headers-untouched",
		js: `
			// a page building its own Headers, including values that look like
			// something the proxy would rewrite, must get them back verbatim
			const h = new Headers();
			h.set("Link", "</style.css>; rel=preload");
			h.set("Location", "/somewhere");
			h.set("Content-Security-Policy", "default-src 'none'");
			h.set("X-Scramjet-Content-Type", "not-a-carrier");
			assertEqual(h.get("link"), "</style.css>; rel=preload", "Link untouched");
			assertEqual(h.get("location"), "/somewhere", "Location untouched");
			assertEqual(h.get("content-security-policy"), "default-src 'none'", "CSP untouched");
			assertEqual(h.get("x-scramjet-content-type"), "not-a-carrier", "a page-set x-scramjet- name is the page's own data");
			assertEqual([...h.keys()].length, 4, "all four are iterable");

			const r = new Response("x", { headers: h });
			assertEqual(r.headers.get("link"), "</style.css>; rel=preload", "and through a Response init");
		`,
	}),

	basicTest({
		name: "hdrview-request-headers-untouched",
		js: `
			const r = new Request("/x", { headers: { "X-Custom": "v", "Content-Type": "application/json" } });
			assertEqual(r.headers.get("x-custom"), "v", "custom request header");
			assertEqual(r.headers.get("content-type"), "application/json", "content-type");
			assertEqual([...r.headers.keys()].join(","), "content-type,x-custom", "request headers iterate sorted and unpolluted");
			r.headers.set("X-Another", "w");
			assertEqual(r.headers.get("x-another"), "w", "request headers are mutable");
		`,
	}),

	// --- the shape of the iteration machinery itself ------------------------

	basicTest({
		name: "hdrview-entries-is-the-same-function-as-symbol-iterator",
		js: `
			// Web IDL defines @@iterator with the same value as entries. Patching
			// one and not the other both breaks this identity and leaves a hole:
			// for..of, spread, Object.fromEntries and every HeadersInit fill go
			// through @@iterator, not through entries.
			assert(Headers.prototype[Symbol.iterator] === Headers.prototype.entries,
				"Headers.prototype[@@iterator] === entries");
			assert(URLSearchParams.prototype[Symbol.iterator] === URLSearchParams.prototype.entries,
				"URLSearchParams too");
			assert(FormData.prototype[Symbol.iterator] === FormData.prototype.entries,
				"FormData too");
		`,
	}),

	differential(
		"iterator-brand",
		`(() => {
			const it = new Headers({ a: "1" }).entries();
			return {
				tag: Object.prototype.toString.call(it),
				ownProto: Object.getPrototypeOf(it) === Object.getPrototypeOf(new Headers().keys()),
				grandProto: Object.getPrototypeOf(Object.getPrototypeOf(it)) ===
					Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())),
				hasNext: typeof it.next === "function",
				selfIterable: it[Symbol.iterator]() === it,
			};
		})()`
	),

	basicTest({
		name: "hdrview-iterator-is-independent-and-lazy",
		js: `
			const h = (await fetch("/script.js")).headers;
			const a = h.entries();
			const b = h.entries();
			assert(a !== b, "each call returns a fresh iterator");
			const first = a.next();
			assertEqual(first.done, false, "first entry exists");
			assertEqual(JSON.stringify(b.next().value), JSON.stringify(first.value), "iterators are independent");
			// drain and confirm exhaustion is sticky
			while (!a.next().done);
			assertEqual(a.next().done, true, "exhausted iterator stays done");
			assertEqual(a.next().value, undefined, "and yields undefined");
		`,
	}),

	basicTest({
		name: "hdrview-getsetcookie",
		js: `
			// Set-Cookie never reaches document JS, and the proxy deletes it and
			// keeps no carrier copy, so this must be an empty array either way -
			// but it must be an ARRAY, not undefined or a throw.
			const h = (await fetch("/script.js")).headers;
			const v = h.getSetCookie();
			assert(Array.isArray(v), "getSetCookie returns an array");
			assertConsistent("getsetcookie-length", v.length);
			assertEqual(h.get("set-cookie"), null, "set-cookie is not readable via get either");
			assertEqual(h.has("set-cookie"), false, "nor via has");
		`,
	}),

	serverTest({
		name: "hdrview-set-cookie-not-exposed-but-still-applied",
		autoPass: true,
		js: `
			await fetch("/hdr");
			await new Promise((r) => setTimeout(r, 400));
			assert(document.cookie.includes("hv=1"), "the cookie was still stored: " + document.cookie);
			const h = (await fetch("/hdr")).headers;
			assertEqual(h.getSetCookie().length, 0, "but Set-Cookie is not exposed");
			assert(![...h.keys()].some((k) => k.includes("cookie")), "no cookie header of any name is iterable: " + [...h.keys()].join(","));
		`,
		start: async (server) =>
			withHeaders({ "Set-Cookie": "hv=1; Path=/" })(server),
	}),
];
