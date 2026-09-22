import { basicTest, serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Request and Response carry the proxy's URL internally and unrewrite it at the
// getter, rather than carrying the site's URL and being swapped out at each
// barrier. That choice is forced: `Response.url`, `type`, `redirected` and the
// headers guard are internal slots with no constructor path, so a Response
// cannot be rebuilt without losing them.
//
// The cost of the choice is that the getters have to be exhaustive, and the
// round trip through the rewriter has to be lossless. Everything here is either
// a URL that must come back as the site's, or an internal slot that must have
// survived untouched because nothing was reconstructed.
//
// The proxy prefix is `/~/sj/`; no assertion below may see it.

const differential = (name: string, js: string) =>
	basicTest({
		name: `reqresp-${name}`,
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
	// --- URL round trip -----------------------------------------------------

	basicTest({
		name: "reqresp-request-url-relative",
		js: `
			assertEqual(new Request("/x").url, location.origin + "/x", "root-relative");
			assertEqual(new Request("x").url, new URL("x", location.href).href, "path-relative");
			// resolving "" against a base yields the base with its fragment dropped,
			// and the harness document URL carries a #runway_token
			assertEqual(new Request("").url, new URL("", location.href).href, "empty string resolves to the document URL");
			assert(!new Request("").url.includes("#"), "and drops the fragment: " + new Request("").url);
			assertEqual(new Request("//" + location.host + "/x").url, location.origin + "/x", "scheme-relative");
			assertEqual(new Request(location.origin + "/x").url, location.origin + "/x", "absolute");
			for (const u of ["/x", "x", "", location.origin + "/x"]) {
				assert(!new Request(u).url.includes("/~/sj/"), "no proxy prefix leaked for " + JSON.stringify(u));
				assert(!new Request(u).url.includes("$tf="), "no frame param leaked for " + JSON.stringify(u));
			}
		`,
	}),

	// The inner URL is percent-encoded into a *path segment* of the proxy URL,
	// so the URL parser never normalises it the way it would a real URL. Every
	// one of these is a case where the rewriter has to do the parser's job.
	differential(
		"url-normalization-host-case",
		`new Request("http://EXAMPLE.com/a").url`
	),
	differential(
		"url-normalization-default-port",
		`new Request("http://example.com:80/a").url`
	),
	differential(
		"url-normalization-https-default-port",
		`new Request("https://example.com:443/a").url`
	),
	differential(
		"url-normalization-dot-segments",
		`new Request("https://example.com/a/./b/../c").url`
	),
	differential(
		"url-normalization-idn",
		`new Request("https://exämple.com/a").url`
	),
	differential(
		"url-normalization-space",
		`new Request("https://example.com/a b").url`
	),
	differential(
		"url-normalization-backslash",
		`new Request("https://example.com\\\\a").url`
	),
	differential(
		"url-normalization-empty-path",
		`new Request("https://example.com").url`
	),
	differential(
		"url-normalization-userinfo",
		`new Request("https://user:pass@example.com/a").url`
	),
	differential(
		"url-normalization-double-encoded",
		`new Request("https://example.com/a%2Fb%3Fc").url`
	),
	differential(
		"url-normalization-query-preserved",
		`new Request("https://example.com/a?x=1&y=%20&z").url`
	),
	differential(
		"url-normalization-plus-in-query",
		`new Request("https://example.com/a?x=a+b").url`
	),

	basicTest({
		name: "reqresp-request-url-fragment",
		js: `
			// a request URL keeps its fragment; only cache matching excludes it
			assertEqual(new Request("/x#frag").url, location.origin + "/x#frag", "fragment survives");
			assertEqual(new Request("/x#").url, location.origin + "/x#", "empty fragment survives");
			assert(!new Request("/x#frag").url.includes("/~/sj/"), "no prefix in a fragmented URL");
		`,
	}),

	basicTest({
		name: "reqresp-request-copy-and-clone-urls",
		js: `
			const a = new Request("/x", { headers: { "X-A": "1" } });
			assertEqual(new Request(a).url, location.origin + "/x", "copy-constructed from a Request");
			assertEqual(new Request(a, {}).url, location.origin + "/x", "copy with an empty init");
			assertEqual(new Request(a, { method: "POST" }).url, location.origin + "/x", "copy with an init override");
			assertEqual(a.clone().url, location.origin + "/x", "clone");
			assertEqual(new Request(a.url).url, a.url, "url round-trips back through the constructor");
			// double-rewriting shows up here: feeding .url back in must be idempotent
			assertEqual(new Request(new Request(new Request("/x").url).url).url, location.origin + "/x", "idempotent");
		`,
	}),

	basicTest({
		name: "reqresp-response-url-is-empty-when-constructed",
		js: `
			// Response.url is only ever non-empty for a browser-produced response.
			// That invariant is what lets the getter unrewrite unconditionally.
			assertEqual(new Response().url, "", "new Response()");
			assertEqual(new Response("body").url, "", "new Response(body)");
			assertEqual(new Response(null, { status: 204 }).url, "", "new Response with a status");
			assertEqual(Response.error().url, "", "Response.error()");
			assertEqual(Response.redirect(location.origin + "/x", 302).url, "", "Response.redirect()");
			assertEqual(Response.json({ a: 1 }).url, "", "Response.json()");
		`,
	}),

	basicTest({
		name: "reqresp-response-url-after-fetch",
		js: `
			const r = await fetch("/script.js");
			assertEqual(r.url, location.origin + "/script.js", "fetched Response.url is the site's");
			assert(!r.url.includes("/~/sj/"), "no proxy prefix");
			assert(!r.url.includes("$"), "no scramjet query params: " + r.url);
			assertEqual(r.clone().url, r.url, "clone preserves url");
		`,
	}),

	// --- internal slots that reconstruction would have destroyed -------------

	basicTest({
		name: "reqresp-request-slots-preserved",
		js: `
			const r = new Request("/x", {
				method: "POST",
				body: "hello",
				mode: "cors",
				credentials: "include",
				cache: "no-store",
				redirect: "error",
				integrity: "sha256-abc",
				keepalive: true,
				referrerPolicy: "no-referrer",
			});
			assertEqual(r.method, "POST", "method");
			assertEqual(r.mode, "cors", "mode");
			assertEqual(r.credentials, "include", "credentials");
			assertEqual(r.cache, "no-store", "cache");
			assertEqual(r.redirect, "error", "redirect");
			assertEqual(r.integrity, "sha256-abc", "integrity");
			assertEqual(r.keepalive, true, "keepalive");
			assertEqual(r.referrerPolicy, "no-referrer", "referrerPolicy");
			assertEqual(r.destination, "", "destination is empty for a constructed Request");
			assert(r.signal instanceof AbortSignal, "signal exists");
			assertEqual(r.signal.aborted, false, "signal starts unaborted");
			// Copy-construction reads the source as an init *dictionary*, so its
			// body member comes back as a ReadableStream - and keepalive rejects a
			// stream body outright. Copy a bodyless request, whose body is null.
			const bodyless = new Request("/x", {
				mode: "cors",
				credentials: "include",
				cache: "no-store",
				redirect: "error",
				integrity: "sha256-abc",
				keepalive: true,
				referrerPolicy: "no-referrer",
			});
			const c = new Request(bodyless.url, bodyless);
			for (const k of ["method", "mode", "credentials", "cache", "redirect", "integrity", "keepalive", "referrerPolicy"]) {
				assertEqual(c[k], bodyless[k], "copy preserved " + k);
			}
			assertEqual(c.url, location.origin + "/x", "copy preserved the url");
		`,
	}),

	basicTest({
		name: "reqresp-request-signal-propagates",
		js: `
			const ctl = new AbortController();
			const r = new Request("/script.js", { signal: ctl.signal });
			// per spec the Request gets its own signal that follows the given one
			assert(r.signal !== ctl.signal, "the Request has its own signal object");
			assertEqual(r.signal.aborted, false, "not aborted yet");
			ctl.abort();
			assertEqual(r.signal.aborted, true, "abort propagated to the Request's signal");

			const ctl2 = new AbortController();
			const p = fetch("/script.js", { signal: ctl2.signal });
			ctl2.abort();
			let name = null;
			try { await p; } catch (e) { name = e.name; }
			assertEqual(name, "AbortError", "an in-flight fetch aborts");
		`,
	}),

	basicTest({
		name: "reqresp-body-used-semantics",
		js: `
			const a = new Request("/x", { method: "POST", body: "hello" });
			assertEqual(a.bodyUsed, false, "fresh Request is unused");
			const b = new Request(a);
			assertEqual(a.bodyUsed, true, "copy-constructing from a Request disturbs the original");
			assertEqual(b.bodyUsed, false, "the copy is unused");
			assertEqual(await b.text(), "hello", "the body moved across intact");
			assertEqual(b.bodyUsed, true, "reading marks it used");

			const c = new Request("/x", { method: "POST", body: "hello" });
			const d = c.clone();
			assertEqual(c.bodyUsed, false, "clone does not disturb");
			assertEqual(await c.text(), "hello", "original still readable");
			assertEqual(await d.text(), "hello", "clone still readable");

			const resp = new Response("body");
			assertEqual(resp.bodyUsed, false, "fresh Response is unused");
			await resp.text();
			assertEqual(resp.bodyUsed, true, "read Response is used");
		`,
	}),

	differential(
		"clone-after-disturbed-throws",
		`(async () => { const r = new Response("x"); await r.text(); return r.clone(); })()`
	),
	differential(
		"construct-from-used-request-throws",
		`(async () => { const r = new Request("/x", { method: "POST", body: "x" }); await r.text(); return new Request(r); })()`
	),
	differential(
		"response-204-with-body-throws",
		`(() => new Response("x", { status: 204 }))()`
	),
	differential(
		"response-status-out-of-range-throws",
		`(() => new Response(null, { status: 0 }))()`
	),
	differential(
		"response-status-999-throws",
		`(() => new Response(null, { status: 999 }))()`
	),
	differential(
		"request-get-with-body-throws",
		`(() => new Request("/x", { method: "GET", body: "x" }))()`
	),
	differential(
		"request-navigate-mode-throws",
		`(() => new Request("/x", { mode: "navigate" }))()`
	),
	differential(
		"request-only-if-cached-without-same-origin-throws",
		`(() => new Request("/x", { cache: "only-if-cached", mode: "cors" }))()`
	),

	basicTest({
		name: "reqresp-response-type-and-redirected",
		js: `
			const r = await fetch("/script.js");
			assertEqual(r.redirected, false, "not redirected");
			assert(r.type === "basic" || r.type === "default", "same-origin response type: " + r.type);
			assertEqual(r.ok, true, "ok");
			assertEqual(r.status, 200, "status");
			// a constructed Response cannot express any of these
			assertEqual(new Response("x").type, "default", "constructed type");
			assertEqual(new Response("x").redirected, false, "constructed redirected");
			assertEqual(Response.error().type, "error", "Response.error type");
			assertEqual(Response.error().status, 0, "Response.error status");
		`,
	}),

	basicTest({
		name: "reqresp-response-clone-preserves-everything",
		js: `
			const r = await fetch("/script.js");
			const c = r.clone();
			assertEqual(c.url, r.url, "url");
			assertEqual(c.type, r.type, "type");
			assertEqual(c.status, r.status, "status");
			assertEqual(c.statusText, r.statusText, "statusText");
			assertEqual(c.redirected, r.redirected, "redirected");
			assertEqual(c.ok, r.ok, "ok");
			assertEqual(c.headers.get("content-type"), r.headers.get("content-type"), "headers");
			assert((await c.text()).length > 0, "clone body readable");
			assert((await r.text()).length > 0, "original body still readable");
		`,
	}),

	// A Response is a valid ResponseInit: `status` and `statusText` are read off
	// `Response.prototype`, so an own-property copy of the init loses both.
	serverTest({
		name: "reqresp-response-init-from-fetched-response",
		autoPass: true,
		js: `
			const r = await fetch("/teapot");
			const copy = new Response("x", r);
			assertEqual(copy.status, 418, "status carried over from the Response init");
			// against the fetched one rather than a literal: what reaches it is
			// the proxy's business, only that the copy carries it over is this's
			assertEqual(copy.statusText, r.statusText, "statusText too");
			assertEqual(copy.headers.get("x-teapot"), "short and stout", "and its headers");
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/teapot") {
					res.writeHead(418, "I'm a Teapot", { "X-Teapot": "short and stout" });
					res.end();
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),

	// Every init member is a page getter the browser runs exactly once.
	differential(
		"init-getters-run-once",
		`(async () => {
			const reads = [];
			const init = (extra) => ({
				get credentials() { reads.push("credentials"); return "same-origin"; },
				get headers() { reads.push("headers"); return { "x-a": "1" }; },
				get mode() { reads.push("mode"); return { toString() { reads.push("mode.toString"); return "cors"; } }; },
				...extra,
			});
			new Request("/x", init());
			await fetch("/script.js", init());
			new Response("x", { get headers() { reads.push("response.headers"); return {}; } });
			return reads.slice().sort();
		})()`
	),

	differential(
		"fetch-brand-checks-its-receiver",
		`fetch.call({}, "/script.js").then(() => "resolved", (e) => e.name)`
	),

	// --- redirects, where request.url and response.url diverge --------------

	serverTest({
		name: "reqresp-redirect-follow-final-url",
		autoPass: true,
		js: `
			const r = await fetch("/redir-start");
			assertEqual(r.redirected, true, "redirected flag set");
			assertEqual(r.url, location.origin + "/redir-end", "response.url is the FINAL url, unrewritten");
			assert(!r.url.includes("/~/sj/"), "no prefix in the final url");
			assertEqual(await r.text(), "landed", "followed to the end");
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/redir-start") {
					res.writeHead(302, { Location: "/redir-end" });
					res.end();
					return;
				}
				if (path === "/redir-end") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("landed");
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),

	serverTest({
		name: "reqresp-redirect-manual-location-header",
		autoPass: true,
		js: `
			const r = await fetch("/redir-start", { redirect: "manual" });
			// an opaqueredirect response exposes nothing; a proxy that turns it into
			// a readable 302 is a divergence, and if it IS readable the Location
			// header must be the site's URL and not the proxy's
			const loc = r.headers.get("location");
			if (loc !== null) {
				assert(!loc.includes("/~/sj/"), "Location header is not a proxy URL: " + loc);
				assert(!loc.includes("$tf="), "no frame param in Location: " + loc);
			}
			ok("redirect:manual type=" + r.type + " status=" + r.status + " location=" + loc);
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/redir-start") {
					res.writeHead(302, { Location: "/redir-end" });
					res.end();
					return;
				}
				if (path === "/redir-end") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("landed");
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),

	// --- streaming bodies, which reconstruction cannot carry ----------------

	basicTest({
		name: "reqresp-streaming-request-body",
		js: `
			const rs = new ReadableStream({
				start(c) { c.enqueue(new TextEncoder().encode("streamed")); c.close(); },
			});
			const req = new Request("/x", { method: "POST", body: rs, duplex: "half" });
			assertEqual(req.method, "POST", "method");
			assertEqual(req.url, location.origin + "/x", "url");
			assertEqual(await req.text(), "streamed", "a streamed request body is readable");
		`,
	}),

	basicTest({
		name: "reqresp-response-body-stream",
		js: `
			const r = await fetch("/script.js");
			assert(r.body instanceof ReadableStream, "body is a stream");
			assertEqual(r.bodyUsed, false, "reading .body does not disturb");
			const reader = r.body.getReader();
			let total = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				total += value.byteLength;
			}
			assert(total > 0, "streamed " + total + " bytes");
			assertEqual(r.bodyUsed, true, "draining the stream marks it used");
		`,
	}),
];
