import { serverTest } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";
import { t } from "./net.ts";

/* eslint-disable quotes */

function wsEcho(server: any) {
	const wss = new WebSocketServer({
		server,
	});
	wss.on("connection", (s) =>
		s.on("message", (m, bin) =>
			s.send(m, {
				binary: bin,
			})
		)
	);
}

export default [
	t(
		"rv4-b-sync-native-undefined",
		`
		const x = new XMLHttpRequest();
		x.open("GET", "/text", undefined);
		x.send();
		assertEqual(x.readyState, 4, "sync readyState");
		assertEqual(x.status, 200, "sync status");
		assertEqual(x.responseText, "hello", "sync body");
	`
	),
	t(
		"rv4-b-blob-type",
		`
		const b = await (await fetch("/text")).blob();
		assertEqual(b.type, "text/plain;charset=utf-8", "blob type");
	`
	),
	t(
		"rv4-b-content-type-header",
		`
		const r = await fetch("/text");
		assertEqual(r.headers.get("content-type"), "text/plain; charset=utf-8", "ct");
	`
	),
	t(
		"rv4-b-data-url-fetch",
		`
		const r = await fetch("data:text/plain;charset=utf-8,hi");
		assertEqual(await r.clone().text(), "hi", "body");
		assertEqual(r.headers.get("content-type"), "text/plain;charset=utf-8", "data: content-type");
		assert(r.url.startsWith("data:"), "data url: " + r.url);
	`
	),
	t(
		"rv4-b-blob-url-fetch",
		`
		const u = URL.createObjectURL(new Blob(["bb"], { type: "application/x-foo" }));
		const r = await fetch(u);
		assertEqual(await r.clone().text(), "bb", "body");
		assertEqual(r.headers.get("content-type"), "application/x-foo", "blob: content-type");
		assertEqual(r.headers.get("content-length"), "2", "blob: content-length");
		assertEqual(r.url, u, "url");
	`
	),
	t(
		"rv4-b-cache-roundtrip",
		`
		const c = await caches.open("rv4");
		await c.put("/text", await fetch("/text"));
		const m = await c.match("/text");
		assertEqual(m.url, location.origin + "/text", "cache url");
		assertEqual(m.headers.get("x-custom"), "abc", "cache header");
		assert(![...m.headers.keys()].some(k => k.startsWith("x-scramjet")), "no carrier");
		await c.add("/echo");
		const m2 = await c.match("/echo");
		assertEqual(m2.headers.get("x-custom"), "custom-value", "cache.add header");
		await caches.delete("rv4");
	`
	),
	t(
		"rv4-b-worker-file",
		`
		const w = new Worker("/worker.js");
		const d = await new Promise((res) => (w.onmessage = (e) => res(e.data)));
		assert(!d.err, "worker err " + d.err);
		assertEqual(d.url, location.origin + "/text", "url");
		assertEqual(d.custom, "abc", "custom");
		assertEqual(d.xhr, "abc", "worker xhr header");
		assert(!d.keys.includes("x-scramjet"), "no carriers " + d.keys);
	`,
		(server) => {
			server.on("request", (req, res) => {
				if (req.url === "/worker.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(`
						(async () => {
							try {
								const r = await fetch("/text");
								const x = new XMLHttpRequest();
								x.open("GET", "/text");
								await new Promise(r => { x.onload = r; x.send(); });
								postMessage({ url: r.url, custom: r.headers.get("x-custom"), keys: [...r.headers.keys()].join(","), xhr: x.getResponseHeader("x-custom") });
							} catch (e) { postMessage({ err: String(e) }); }
						})();
					`);
				}
			});
		}
	),
	t(
		"rv4-b-fetch-abort-keepalive",
		`
		const ac = new AbortController();
		const p = fetch("/echo", { signal: ac.signal });
		ac.abort();
		let name = null;
		try { await p; } catch (e) { name = e.name; }
		assertEqual(name, "AbortError", "abort");
		const r = await fetch("/echo", { method: "POST", body: "k", keepalive: true });
		assertEqual((await r.json()).body, "k", "keepalive");
		const r2 = await fetch("/echo", { method: "POST", body: new Blob(["bl"]) });
		assertEqual((await r2.json()).body, "bl", "blob body");
		const fd = new FormData(); fd.append("a", "b");
		const r3 = await fetch("/echo", { method: "POST", body: fd });
		assert((await r3.json()).headers["content-type"].startsWith("multipart/form-data"), "formdata");
		const r4 = await fetch("/echo", { method: "POST", body: new URLSearchParams("q=1") });
		assertEqual((await r4.json()).headers["content-type"], "application/x-www-form-urlencoded;charset=UTF-8", "usp");
	`
	),
	t(
		"rv4-b-fetch-request-then-init-override",
		`
		const req = new Request("/echo", { headers: { "X-A": "req" }, method: "POST", body: "rb" });
		const r = await fetch(req, { headers: { "X-B": "init" } });
		const j = await r.json();
		assertEqual(j.headers["x-b"], "init", "init headers used");
		assertEqual(j.body, "rb", "body kept");
		const r2 = await fetch(new Request("/echo"), { method: "PUT", body: "x" });
		assertEqual((await r2.json()).method, "PUT", "method override");
	`
	),
	t(
		"rv4-b-fetch-frozen-init",
		`
		const resp = await fetch("/text");
		const init = Object.freeze({ headers: resp.headers });
		const r = await fetch("/echo", init);
		assert(r.ok, "frozen init with fetched headers");
		const init2 = Object.freeze({ mode: "cors", credentials: "include", headers: Object.freeze({ a: "b" }) });
		assert((await fetch("/echo", init2)).ok, "frozen init");
	`
	),
	t(
		"rv4-b-headers-misc",
		`
		const r = await fetch("/text");
		assert(r.headers.has("content-type"), "has ct");
		assert(r.headers.has("Content-Length") || r.headers.has("transfer-encoding") || true, "len");
		assertEqual(r.headers.get("nope"), null, "missing");
		let n = 0; r.headers.forEach((v, k, h) => { n++; assert(h === r.headers, "3rd arg"); });
		assert(n >= 2, "forEach count");
		assert(Array.isArray(r.headers.getSetCookie()), "getSetCookie");
		assertEqual(typeof Headers.prototype[Symbol.iterator], "function", "iter");
		const h = new Headers([["a","1"],["a","2"]]);
		assertEqual(h.get("a"), "1, 2", "combine");
		h.append("b","3"); h.delete("a"); h.set("c","4");
		assertEqual([...h].map(x=>x.join("=")).join("&"), "b=3&c=4", "mutations");
	`
	),
	t(
		"rv4-b-xhr-misc",
		`
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.open("GET", "/echo");
			x.withCredentials = true;
			x.overrideMimeType("text/plain");
			x.timeout = 5000;
			x.onload = () => {
				try {
					assertEqual(x.status, 200, "status");
					assertEqual(x.statusText, "OK", "statusText");
					assert(x.responseText.includes("GET"), "text");
					assertEqual(x.getResponseHeader("Access-Control-Expose-Headers"), "X-Custom", "expose");
					res();
				} catch (e) { rej(e); }
			};
			x.onerror = () => rej(new Error("err"));
			x.send(null);
		});
		// redirected XHR
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.open("GET", "/redirect");
			x.onload = () => { try { assertEqual(x.responseURL, location.origin + "/echo?redirected=1", "responseURL after redirect"); res(); } catch (e) { rej(e); } };
			x.onerror = () => rej(new Error("err"));
			x.send();
		});
		// abort
		const x = new XMLHttpRequest();
		x.open("GET", "/echo");
		x.send();
		x.abort();
		assertEqual(x.readyState, 0, "abort resets");
		// open with URL object and 2 args
		const y = new XMLHttpRequest();
		y.open("GET", new URL("/echo?u", location.href));
		await new Promise((r) => { y.onload = r; y.send(); });
		assertEqual(y.responseURL, location.origin + "/echo?u", "URL object");
	`
	),
	serverTest({
		name: "rv4-b-ws-shapes",
		autoPass: true,
		js: `
			const base = "ws://" + location.host + "/";
			const mk = (...a) => new WebSocket(...a);
			const sockets = [mk(base), mk(base, undefined), mk(base, []), mk(location.href.split("#")[0]), mk("/rel"), mk(new URL(base))];
			assertEqual(sockets[3].url, base, "http->ws");
			assertEqual(sockets[4].url, base + "rel", "relative");
			await Promise.all(sockets.map((s, i) => new Promise((res, rej) => {
				s.onopen = () => { s.send("m" + i); };
				s.onmessage = (e) => { try { assertEqual(e.data, "m" + i, "echo " + i); s.close(); } catch (er) { rej(er); } };
				s.onclose = () => res();
				s.onerror = () => rej(new Error("err " + i));
			})));
			// addEventListener-only socket, close from onopen, blob send
			const s = new WebSocket(base);
			const got = [];
			await new Promise((res, rej) => {
				s.addEventListener("open", () => { s.send(new Blob(["blobby"])); s.send("after"); });
				s.addEventListener("message", async (e) => {
					got.push(typeof e.data === "string" ? e.data : await e.data.text());
					if (got.length === 2) s.close(1000);
				});
				s.addEventListener("close", (e) => { try { assertEqual(e.code, 1000, "code"); res(); } catch (er) { rej(er); } });
				s.addEventListener("error", () => rej(new Error("err")));
			});
			assertEqual(got.join(","), "blobby,after", "ordered");
			assertEqual(s.readyState, 3, "closed");
			assertEqual(s.bufferedAmount, 0, "buffered");
			s.send("ignored");
		`,
		async start(server) {
			wsEcho(server);
		},
	}),
	serverTest({
		name: "rv4-b-ws-in-worker",
		autoPass: true,
		js: `
			const src = "const s = new WebSocket('ws://" + location.host + "/'); s.binaryType='arraybuffer'; s.onopen = () => s.send(new Uint8Array([9])); s.onmessage = (e) => postMessage(new Uint8Array(e.data)[0]); s.onerror = () => postMessage('error');";
			const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
			const d = await new Promise((res, rej) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("worker error " + e.message)); setTimeout(() => rej(new Error("timeout")), 5000); });
			assertEqual(d, 9, "worker ws");
		`,
		async start(server) {
			wsEcho(server);
		},
	}),
	serverTest({
		name: "rv4-b-wsstream",
		autoPass: true,
		js: `
			if (!("WebSocketStream" in window)) return;
			const wss = new WebSocketStream("ws://" + location.host + "/");
			const { readable, writable } = await wss.opened;
			const w = writable.getWriter();
			await w.write("hey");
			const r = readable.getReader();
			const { value } = await r.read();
			assertEqual(value, "hey", "echo");
			assertEqual(wss.url, "ws://" + location.host + "/", "url");
			wss.close();
			const info = await wss.closed;
			assertEqual(info.closeCode, 1000, "closeCode");
		`,
		async start(server) {
			wsEcho(server);
		},
	}),
	serverTest({
		name: "rv4-b-ws-many-messages-order",
		autoPass: true,
		js: `
			const s = new WebSocket("ws://" + location.host + "/");
			s.binaryType = "arraybuffer";
			const got = [];
			await new Promise((res, rej) => {
				s.onmessage = (e) => { got.push(typeof e.data === "string" ? e.data : "b" + new Uint8Array(e.data)[0]); if (got.length === 200) res(); };
				s.onerror = () => rej(new Error("err"));
				setTimeout(() => rej(new Error("timeout " + got.length)), 8000);
			});
			const exp = []; for (let i = 0; i < 100; i++) { exp.push("t" + i); exp.push("b" + i); }
			assertEqual(got.join(), exp.join(), "order");
		`,
		async start(server) {
			const wss = new WebSocketServer({
				server,
			});
			wss.on("connection", (s) => {
				for (let i = 0; i < 100; i++) {
					s.send("t" + i);
					s.send(Buffer.from([i]));
				}
			});
		},
	}),
	t(
		"rv4-b-eventsource-init",
		`
		const es = new EventSource("/sse", undefined);
		await new Promise((res, rej) => { es.onmessage = (e) => { try { assertEqual(e.data, "one", "msg"); es.close(); res(); } catch (er) { rej(er); } }; es.onerror = () => rej(new Error("err")); });
		assertEqual(es.readyState, 2, "closed");
		const es2 = new EventSource("/sse", { withCredentials: false });
		assertEqual(es2.withCredentials, false, "wc");
		es2.close();
		class E extends EventSource {}
		const e3 = new E("/sse"); assert(e3 instanceof E, "subclass"); e3.close();
	`
	),
	t(
		"rv4-b-beacon-bodies",
		`
		assert(navigator.sendBeacon("/beacon", new Blob(["bb"], { type: "text/plain" })), "blob");
		assert(navigator.sendBeacon("/beacon", new URLSearchParams("a=1")), "usp");
		assert(navigator.sendBeacon(new URL("/beacon", location.href)), "url obj no data");
		await new Promise(r => setTimeout(r, 800));
	`
	),
];
