import { serverTest, basicTest } from "../../testcommon.ts";
import { gzipSync } from "zlib";

// Every request a page makes is re-issued by the proxy, so the whole HTTP
// surface has to survive the round trip: methods, bodies of every type, request
// and response headers, status codes, redirects, ranges, streaming and aborts.
// This is also where proxy plumbing would be most visible - an injected header
// showing up in Headers or getAllResponseHeaders() is a direct leak.

const httpTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const url = new URL(req.url || "/", "http://x");
				const path = url.pathname;
				if (path === "/" || path === "/script.js") return;

				const send = (code: number, headers: any, body?: any) => {
					res.writeHead(code, headers);
					res.end(body);
				};

				if (path === "/echo") {
					const chunks: Buffer[] = [];
					req.on("data", (c) => chunks.push(c));
					req.on("end", () =>
						send(
							200,
							{ "Content-Type": "application/json" },
							JSON.stringify({
								method: req.method,
								path,
								query: url.search,
								headers: req.headers,
								body: Buffer.concat(chunks).toString("utf8"),
							})
						)
					);
					return;
				}
				if (path === "/respheaders") {
					return send(
						200,
						{
							"Content-Type": "text/plain",
							"X-Custom": "customvalue",
							"X-Multi": "a, b",
							"Set-Cookie": "srvcookie=srvvalue; Path=/",
						},
						"headers"
					);
				}
				if (path === "/httponly") {
					return send(
						200,
						{
							"Content-Type": "text/plain",
							"Set-Cookie": "hocookie=hovalue; Path=/; HttpOnly",
						},
						"ok"
					);
				}
				if (path === "/status") {
					const code = Number(url.searchParams.get("code") || 200);
					if (code === 204) return send(code, {});
					return send(code, { "Content-Type": "text/plain" }, "body-" + code);
				}
				if (path === "/redirect") {
					return send(302, { Location: url.searchParams.get("to") || "/echo" });
				}
				if (path === "/gzip") {
					const body = gzipSync(Buffer.from("gzipped-payload"));
					return send(
						200,
						{
							"Content-Type": "text/plain",
							"Content-Encoding": "gzip",
							"Content-Length": String(body.length),
						},
						body
					);
				}
				if (path === "/range") {
					const full = Buffer.from("0123456789");
					const range = req.headers.range;
					if (range) {
						const m = /bytes=(\d+)-(\d*)/.exec(range)!;
						const s = Number(m[1]);
						const e = m[2] ? Number(m[2]) : full.length - 1;
						return send(
							206,
							{
								"Content-Type": "text/plain",
								"Content-Range": "bytes " + s + "-" + e + "/" + full.length,
								"Accept-Ranges": "bytes",
							},
							full.subarray(s, e + 1)
						);
					}
					return send(
						200,
						{ "Content-Type": "text/plain", "Accept-Ranges": "bytes" },
						full
					);
				}
				if (path === "/slow") {
					setTimeout(
						() => send(200, { "Content-Type": "text/plain" }, "slow"),
						1500
					);
					return;
				}
				if (path === "/sse") {
					res.writeHead(200, {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					});
					res.write("id: 1\ndata: first\n\n");
					setTimeout(() => res.write("event: custom\ndata: second\n\n"), 50);
					return;
				}
				if (path === "/chunks") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.write("chunk1");
					setTimeout(() => {
						res.write("chunk2");
						res.end();
					}, 50);
					return;
				}
				send(404, { "Content-Type": "text/plain" }, "nf");
			});
		},
	});

export default [
	httpTest(
		"http-methods",
		`
			for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
				const j = await (await fetch("/echo", {
					method,
					body: method === "DELETE" ? undefined : "payload-" + method,
				})).json();
				assertEqual(j.method, method, method + " method");
				if (method !== "DELETE") assertEqual(j.body, "payload-" + method, method + " body");
			}
			const head = await fetch("/echo", { method: "HEAD" });
			assertEqual(head.status, 200, "HEAD status");
			assertEqual(await head.text(), "", "HEAD has no body");
		`
	),
	httpTest(
		"http-body-types",
		`
			const jsonRes = await (await fetch("/echo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ a: 1 }),
			})).json();
			assertEqual(jsonRes.body, '{"a":1}', "JSON body");
			assertEqual(jsonRes.headers["content-type"], "application/json", "explicit content-type");

			const sp = await (await fetch("/echo", { method: "POST", body: new URLSearchParams({ k: "v" }) })).json();
			assertEqual(sp.body, "k=v", "URLSearchParams body");
			assert(sp.headers["content-type"].includes("application/x-www-form-urlencoded"),
				"urlencoded content-type: " + sp.headers["content-type"]);

			const fd = new FormData();
			fd.append("field", "value");
			const fdRes = await (await fetch("/echo", { method: "POST", body: fd })).json();
			assert(fdRes.headers["content-type"].startsWith("multipart/form-data; boundary="),
				"multipart content-type: " + fdRes.headers["content-type"]);
			assert(fdRes.body.includes('name="field"'), "multipart body: " + fdRes.body);

			const blobRes = await (await fetch("/echo", {
				method: "POST",
				body: new Blob(["blobbody"], { type: "text/plain" }),
			})).json();
			assertEqual(blobRes.body, "blobbody", "Blob body");
			assertEqual(blobRes.headers["content-type"], "text/plain", "Blob content-type");

			const abRes = await (await fetch("/echo", { method: "POST", body: new TextEncoder().encode("abbody") })).json();
			assertEqual(abRes.body, "abbody", "typed array body");
		`
	),
	httpTest(
		"http-request-headers",
		`
			const j = await (await fetch("/echo", {
				headers: { "X-Custom": "sent", Authorization: "Bearer tok", Accept: "application/json" },
			})).json();
			assertEqual(j.headers["x-custom"], "sent", "custom request header");
			assertEqual(j.headers["authorization"], "Bearer tok", "Authorization header");
			assertEqual(j.headers["accept"], "application/json", "Accept header");
			assertEqual(j.headers["host"], location.host, "Host header matches the site: " + j.headers["host"]);
			assert(!Object.keys(j.headers).some((h) => h.includes("scramjet")),
				"no proxy header reaches the origin: " + JSON.stringify(Object.keys(j.headers)));
		`
	),
	httpTest(
		"http-response-headers",
		`
			const r = await fetch("/respheaders");
			assertEqual(r.headers.get("x-custom"), "customvalue", "custom response header");
			assertEqual(r.headers.get("X-CUSTOM"), "customvalue", "lookup is case-insensitive");
			assertEqual(r.headers.get("content-type"), "text/plain", "content-type");
			assertEqual(r.headers.get("set-cookie"), null, "set-cookie is a forbidden response header");
			assertEqual(r.headers.has("x-multi"), true, "has()");
			const names = [...r.headers.keys()];
			assert(!names.some((n) => n.includes("scramjet")), "no proxy headers exposed: " + JSON.stringify(names));
			assertEqual(await r.text(), "headers", "body");
		`
	),
	httpTest(
		"http-status-codes",
		`
			for (const code of [200, 201, 400, 404, 418, 500]) {
				const r = await fetch("/status?code=" + code);
				assertEqual(r.status, code, "status " + code);
				assertEqual(r.ok, code < 400, "ok for " + code);
				assertEqual(await r.text(), "body-" + code, "body for " + code);
			}
			const r204 = await fetch("/status?code=204");
			assertEqual(r204.status, 204, "204 status");
			assertEqual(await r204.text(), "", "204 has no body");
		`
	),
	httpTest(
		"http-redirect-follow",
		`
			const r = await fetch("/redirect?to=/echo");
			assertEqual(r.status, 200, "final status");
			assertEqual(r.redirected, true, "redirected flag");
			assertEqual(r.url, location.origin + "/echo", "final URL");
			assert(!r.url.includes("/~/sj/"), "no proxy URL in the final URL");
			assertEqual((await r.json()).path, "/echo", "landed on the target");
		`
	),
	httpTest(
		"http-redirect-modes",
		`
			const manual = await fetch("/redirect?to=/echo", { redirect: "manual" });
			assertEqual(manual.type, "opaqueredirect", "manual redirect type");
			assertEqual(manual.status, 0, "manual redirect status");
			let threw = false;
			try { await fetch("/redirect?to=/echo", { redirect: "error" }); } catch { threw = true; }
			assert(threw, "redirect: error must reject");
		`
	),
	httpTest(
		"http-abort",
		`
			const ac = new AbortController();
			const p = fetch("/slow", { signal: ac.signal });
			ac.abort();
			let err;
			try { await p; } catch (e) { err = e; }
			assert(err, "an aborted fetch rejects");
			assertEqual(err.name, "AbortError", "AbortError, got " + (err && err.name));
			assertEqual(ac.signal.aborted, true, "signal.aborted");
			let err2;
			try { await fetch("/echo", { signal: AbortSignal.abort() }); } catch (e) { err2 = e; }
			assertEqual(err2 && err2.name, "AbortError", "an already-aborted signal");
		`
	),
	httpTest(
		"http-streaming-and-clone",
		`
			const r = await fetch("/chunks");
			const reader = r.body.getReader();
			let out = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				out += new TextDecoder().decode(value);
			}
			assertEqual(out, "chunk1chunk2", "streamed body");
			const r2 = await fetch("/echo");
			const c = r2.clone();
			assertEqual((await r2.json()).path, "/echo", "original");
			assertEqual((await c.json()).path, "/echo", "clone");
			assertEqual(r2.bodyUsed, true, "bodyUsed");
			let reuse = false;
			try { await r2.text(); } catch { reuse = true; }
			assert(reuse, "reading a used body must throw");
		`
	),
	httpTest(
		"http-content-encoding",
		`
			const r = await fetch("/gzip");
			assertEqual(await r.text(), "gzipped-payload", "gzip is transparently decoded");
			assertEqual(r.status, 200, "status");
		`
	),
	httpTest(
		"http-range-requests",
		`
			const r = await fetch("/range", { headers: { Range: "bytes=2-5" } });
			assertEqual(r.status, 206, "partial content status");
			assertEqual(await r.text(), "2345", "partial body");
			assertEqual(r.headers.get("content-range"), "bytes 2-5/10", "content-range");
			assertEqual(r.headers.get("accept-ranges"), "bytes", "accept-ranges");
		`
	),
	httpTest(
		"http-credentials-include",
		`
			await fetch("/httponly");
			const inc = await (await fetch("/echo", { credentials: "include" })).json();
			assert((inc.headers.cookie || "").includes("hocookie=hovalue"),
				"credentials: include sends cookies: " + inc.headers.cookie);
			const same = await (await fetch("/echo", { credentials: "same-origin" })).json();
			assert((same.headers.cookie || "").includes("hocookie=hovalue"),
				"credentials: same-origin sends them too: " + same.headers.cookie);
		`
	),
	httpTest(
		"http-httponly-not-scriptable",
		`
			await fetch("/httponly");
			assert(!document.cookie.includes("hocookie"),
				"an HttpOnly cookie must not be visible to script: " + document.cookie);
			const j = await (await fetch("/echo")).json();
			assert((j.headers.cookie || "").includes("hocookie=hovalue"),
				"but must still be sent: " + j.headers.cookie);
		`
	),
	httpTest(
		// KNOWN FAILURE: credentials: "omit" still sends the jar. That option is
		// how code deliberately makes an unauthenticated request - third-party
		// API calls, token-refresh endpoints, cache-friendly asset fetches - so
		// sending the session cookie anyway is both a correctness and a privacy
		// problem.
		"http-credentials-omit",
		`
			await fetch("/httponly");
			const omit = await (await fetch("/echo", { credentials: "omit" })).json();
			assert(!(omit.headers.cookie || "").includes("hocookie"),
				"credentials: omit must not send cookies: " + omit.headers.cookie);
		`
	),
	httpTest(
		"http-request-object",
		`
			const req = new Request("/echo", { method: "POST", body: "reqbody", headers: { "X-A": "1" } });
			assertEqual(req.method, "POST", "method");
			assertEqual(req.url, location.origin + "/echo", "url");
			assertEqual(req.headers.get("x-a"), "1", "headers");
			const clone = req.clone();
			const j = await (await fetch(req)).json();
			assertEqual(j.body, "reqbody", "fetch(Request) sends the body");
			assertEqual(j.headers["x-a"], "1", "fetch(Request) sends the headers");
			assertEqual(await clone.text(), "reqbody", "clone body");
			assertEqual((await (await fetch(new Request("/echo?q=1"))).json()).query, "?q=1", "query preserved");
		`
	),
	httpTest(
		"http-xhr-headers-and-states",
		`
			const xhr = new XMLHttpRequest();
			xhr.open("POST", "/echo");
			xhr.setRequestHeader("X-Custom", "xhrsent");
			const states = [];
			xhr.onreadystatechange = () => states.push(xhr.readyState);
			await new Promise((res, rej) => { xhr.onload = res; xhr.onerror = rej; xhr.send("xhrbody"); });
			const j = JSON.parse(xhr.responseText);
			assertEqual(j.headers["x-custom"], "xhrsent", "setRequestHeader");
			assertEqual(j.body, "xhrbody", "request body");
			assertEqual(j.method, "POST", "method");
			assertDeepEqual(states.filter((s, i, a) => a.indexOf(s) === i), [2, 3, 4],
				"readyState progression: " + JSON.stringify(states));
			assertEqual(xhr.status, 200, "status");
			assertEqual(xhr.statusText, "OK", "statusText");
			assertEqual(xhr.responseURL, location.origin + "/echo", "responseURL");
		`
	),
	httpTest(
		"http-xhr-response-headers",
		`
			const xhr = new XMLHttpRequest();
			await new Promise((res, rej) => {
				xhr.onload = res; xhr.onerror = rej;
				xhr.open("GET", "/respheaders");
				xhr.send();
			});
			assertEqual(xhr.getResponseHeader("X-Custom"), "customvalue", "getResponseHeader");
			assertEqual(xhr.getResponseHeader("set-cookie"), null, "set-cookie is forbidden");
			const all = xhr.getAllResponseHeaders();
			assert(all.includes("x-custom: customvalue"), "getAllResponseHeaders: " + JSON.stringify(all));
			assert(!all.includes("scramjet"), "no proxy headers listed: " + JSON.stringify(all));
			assert(!all.toLowerCase().includes("set-cookie"), "no set-cookie listed: " + JSON.stringify(all));
		`
	),
	httpTest(
		"http-xhr-response-types",
		`
			const get = async (type) => {
				const xhr = new XMLHttpRequest();
				xhr.responseType = type;
				await new Promise((res, rej) => { xhr.onload = res; xhr.onerror = rej; xhr.open("GET", "/echo"); xhr.send(); });
				return xhr.response;
			};
			assertEqual((await get("json")).path, "/echo", "responseType json");
			assert((await get("blob")) instanceof Blob, "responseType blob");
			assert((await get("arraybuffer")) instanceof ArrayBuffer, "responseType arraybuffer");
			assertEqual(typeof (await get("text")), "string", "responseType text");
		`
	),
	httpTest(
		"http-xhr-abort-and-errors",
		`
			const xhr = new XMLHttpRequest();
			let aborted = false;
			xhr.onabort = () => { aborted = true; };
			xhr.open("GET", "/slow");
			xhr.send();
			xhr.abort();
			await new Promise((r) => setTimeout(r, 100));
			assert(aborted, "abort event fired");
			assertEqual(xhr.readyState, 0, "readyState after abort");
			const x404 = new XMLHttpRequest();
			await new Promise((res) => { x404.onloadend = res; x404.open("GET", "/status?code=404"); x404.send(); });
			assertEqual(x404.status, 404, "404 status");
			assertEqual(x404.responseText, "body-404", "404 body");
		`
	),

	// ------------------------------------------------------------------
	// the fetch object model, no server needed
	// ------------------------------------------------------------------
	basicTest({
		name: "http-headers-object",
		js: `
			const h = new Headers({ "X-A": "1" });
			h.append("X-B", "2");
			h.append("X-B", "3");
			assertEqual(h.get("x-b"), "2, 3", "append combines");
			h.set("X-B", "4");
			assertEqual(h.get("x-b"), "4", "set replaces");
			assert(h.has("X-A"), "has is case-insensitive");
			h.delete("X-A");
			assert(!h.has("x-a"), "delete");
			const h2 = new Headers([["Z", "1"], ["A", "2"]]);
			assertDeepEqual([...h2.keys()], ["a", "z"], "iteration is lowercased and sorted");
			assertDeepEqual([...h2.entries()], [["a", "2"], ["z", "1"]], "entries");
			assertEqual(new Headers(h2).get("a"), "2", "copy construction");
		`,
	}),
	basicTest({
		name: "http-response-object",
		js: `
			const r = new Response("body", { status: 201, statusText: "Created", headers: { "X-A": "1" } });
			assertEqual(r.status, 201, "status");
			assertEqual(r.statusText, "Created", "statusText");
			assertEqual(r.ok, true, "ok");
			assertEqual(r.headers.get("x-a"), "1", "headers");
			assertEqual(await r.text(), "body", "text");
			assertEqual(r.bodyUsed, true, "bodyUsed");
			assertDeepEqual(await Response.json({ a: 1 }).json(), { a: 1 }, "Response.json");
			assertEqual(Response.error().type, "error", "Response.error");
			const rd = Response.redirect("/somewhere", 302);
			assertEqual(rd.status, 302, "Response.redirect status");
			assert(!rd.headers.get("location").includes("/~/sj/"),
				"Response.redirect location: " + rd.headers.get("location"));
		`,
	}),
	basicTest({
		name: "http-eventsource-url",
		js: `
			assertEqual(typeof EventSource, "function", "EventSource exists");
			const es = new EventSource("/sse");
			assertEqual(es.url, location.origin + "/sse", "EventSource.url");
			assertEqual(es.withCredentials, false, "withCredentials");
			assertEqual(es.readyState, 0, "CONNECTING");
			es.close();
			assertEqual(es.readyState, 2, "CLOSED");
		`,
	}),
	httpTest(
		"http-eventsource-stream",
		`
			const es = new EventSource("/sse");
			const first = await new Promise((res, rej) => {
				es.onmessage = res;
				es.onerror = () => rej(new Error("EventSource errored"));
				setTimeout(() => rej(new Error("no SSE message arrived")), 6000);
			});
			assertEqual(first.data, "first", "first event data");
			assertEqual(first.lastEventId, "1", "lastEventId");
			const custom = await new Promise((res, rej) => {
				es.addEventListener("custom", res);
				setTimeout(() => rej(new Error("no custom SSE event arrived")), 6000);
			});
			assertEqual(custom.data, "second", "a custom event type");
			assertEqual(es.readyState, 1, "OPEN while streaming");
			es.close();
		`
	),
];
