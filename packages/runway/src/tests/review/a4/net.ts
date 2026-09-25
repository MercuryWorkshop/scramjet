import { serverTest } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";
import type { IncomingMessage, ServerResponse, Server } from "http";

/* eslint-disable quotes */

type Handler = (req: IncomingMessage, res: ServerResponse) => boolean | void;

export function api(server: Server, handler: Handler) {
	server.on("request", (req, res) => {
		if (req.url === "/" || req.url === "/script.js") return;
		const done = handler(req, res);
		if (done === false && !res.headersSent) {
			res.writeHead(404);
			res.end("nf");
		}
	});
}

// generic API endpoints used by many tests
export const common: Handler = (req, res) => {
	const u = new URL(req.url!, "http://x");
	if (u.pathname === "/echo") {
		let body = "";
		req.on("data", (c) => (body += c));
		req.on("end", () => {
			res.writeHead(200, {
				"Content-Type": "application/json",
				"X-Custom": "custom-value",
				"Access-Control-Expose-Headers": "X-Custom",
			});
			res.end(
				JSON.stringify({
					method: req.method,
					url: req.url,
					headers: req.headers,
					body,
				})
			);
		});
		return;
	}
	if (u.pathname === "/redirect") {
		res.writeHead(302, {
			Location: "/echo?redirected=1",
		});
		res.end();
		return;
	}
	if (u.pathname === "/text") {
		res.writeHead(200, {
			"Content-Type": "text/plain; charset=utf-8",
			"X-Custom": "abc",
			Link: '</next>; rel="next"',
		});
		res.end("hello");
		return;
	}
	if (u.pathname === "/sse") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
		});
		res.write("data: one\n\n");
		res.write("event: custom\ndata: two\nid: 7\n\n");
		return;
	}
	if (u.pathname === "/setcookie") {
		res.writeHead(200, {
			"Set-Cookie": ["srv=1; Path=/", "srvhttp=2; Path=/; HttpOnly"],
			"Content-Type": "text/plain",
		});
		res.end("ok");
		return;
	}
	if (u.pathname === "/beacon") {
		let body = "";
		req.on("data", (c) => (body += c));
		req.on("end", () => {
			(globalThis as any).__rv4beacon = body;
			res.writeHead(204);
			res.end();
		});
		return;
	}
	if (u.pathname === "/beaconresult") {
		res.writeHead(200, {
			"Content-Type": "text/plain",
		});
		res.end(String((globalThis as any).__rv4beacon ?? ""));
		return;
	}
	return false;
};

export function t(name: string, js: string, extra?: (server: Server) => void) {
	return serverTest({
		name,
		autoPass: true,
		js,
		async start(server) {
			extra?.(server);
			api(server, (req, res) =>
				res.headersSent ? undefined : common(req, res)
			);
		},
	});
}

export default [
	t(
		"rv4-fetch-unbound-this",
		`
		const f = window.fetch;
		const r1 = await f("/echo");
		assertEqual((await r1.json()).method, "GET", "unbound fetch works");
		const r2 = await fetch.call(undefined, "/echo");
		assert(r2.ok, "fetch.call(undefined)");
		const r3 = await fetch.call(null, "/echo");
		assert(r3.ok, "fetch.call(null)");
		const r4 = await fetch.bind(window)("/echo");
		assert(r4.ok, "bound");
		const r5 = await globalThis.fetch.call(self, "/echo");
		assert(r5.ok, "call self");
		const { fetch: f2 } = window;
		assert((await f2("/echo")).ok, "destructured");
	`
	),
	t(
		"rv4-fetch-input-shapes",
		`
		const abs = location.origin + "/echo";
		let r = await fetch(new URL("/echo", location.href));
		assertEqual(r.url, abs, "URL object");
		r = await fetch("echo?x=1");
		assertEqual(r.url, abs + "?x=1", "relative");
		r = await fetch(new Request("/echo"));
		assertEqual(r.url, abs, "Request");
		const req = new Request("/echo", { method: "POST", body: "hi", headers: { "X-A": "1" } });
		assertEqual(req.url, abs, "Request.url real");
		r = await fetch(req.clone());
		const j = await r.json();
		assertEqual(j.body, "hi", "body of cloned request");
		assertEqual(j.headers["x-a"], "1", "header");
		r = await fetch({ toString() { return "/echo?obj"; } });
		assertEqual(r.url, abs + "?obj", "stringifiable object");
	`
	),
	t(
		"rv4-fetch-init-headers-shapes",
		`
		let j = await (await fetch("/echo", { headers: new Headers({ "X-H": "h" }) })).json();
		assertEqual(j.headers["x-h"], "h", "Headers init");
		j = await (await fetch("/echo", { headers: [["X-Arr", "a"]] })).json();
		assertEqual(j.headers["x-arr"], "a", "array init");
		j = await (await fetch("/echo", { headers: { "X-Obj": "o" }, method: "PUT", body: "b" })).json();
		assertEqual(j.headers["x-obj"], "o", "object init");
		assertEqual(j.method, "PUT", "method");
		const resp = await fetch("/text");
		j = await (await fetch("/echo", { headers: resp.headers })).json();
		assertEqual(j.headers["x-custom"], "abc", "fetched headers forwarded");
		assert(!Object.keys(j.headers).some(k => k.startsWith("x-scramjet")), "no carrier leak: " + Object.keys(j.headers).join());
	`
	),
	t(
		"rv4-fetch-init-is-request",
		`
		const base = new Request("/echo", { method: "POST", body: "zz", headers: { "X-Q": "q" } });
		const r = await fetch(base.url, base);
		const j = await r.json();
		assertEqual(j.method, "POST", "method from request-as-init");
		assertEqual(j.headers["x-q"], "q", "headers from request-as-init");
		const r2 = new Request("/echo?two", new Request("/other", { method: "DELETE" }));
		assertEqual(r2.method, "DELETE", "new Request(url, request)");
		assertEqual(r2.url, location.origin + "/echo?two", "url");
	`
	),
	t(
		"rv4-fetch-response-props",
		`
		const r = await fetch("/redirect");
		assert(r.redirected, "redirected");
		assertEqual(r.url, location.origin + "/echo?redirected=1", "final url");
		const c = r.clone();
		assertEqual(c.url, r.url, "clone url");
		const t = await fetch("/text");
		assertEqual(t.headers.get("content-type"), "text/plain; charset=utf-8", "ct");
		assertEqual(t.headers.get("X-Custom"), "abc", "custom");
		assertEqual(t.headers.get("link"), '</next>; rel="next"', "link");
		const all = [...t.headers];
		assert(all.some(([k]) => k === "x-custom"), "spread");
		assert(!all.some(([k]) => k.startsWith("x-scramjet")), "no carriers: " + JSON.stringify(all));
		const obj = Object.fromEntries(t.headers);
		assertEqual(obj["x-custom"], "abc", "fromEntries");
		const b = await t.blob();
		assertEqual(b.type, "text/plain;charset=utf-8", "blob type");
		const h2 = new Headers(t.headers);
		assertEqual(h2.get("x-custom"), "abc", "copy");
		const resp = new Response("x", { headers: t.headers });
		assertEqual(resp.headers.get("x-custom"), "abc", "response copy");
	`
	),
	t(
		"rv4-subclass-request-response-headers",
		`
		class R extends Request { foo() { return 1; } }
		const r = new R("/echo");
		assertEqual(r.foo(), 1, "Request subclass method");
		assert(r instanceof R, "instanceof R");
		assertEqual(r.url, location.origin + "/echo", "url");
		class Res extends Response { bar() { return 2; } }
		const s = new Res("x");
		assertEqual(s.bar(), 2, "Response subclass");
		class H extends Headers { baz() { return 3; } }
		const h = new H({ a: "b" });
		assertEqual(h.baz(), 3, "Headers subclass");
		assertEqual(h.get("a"), "b", "get");
		const resp = await fetch(r);
		assert(resp.ok, "fetch subclassed request");
	`
	),
	t(
		"rv4-xhr-jquery-open",
		`
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.open("GET", "/echo?jq", true, undefined, undefined);
			x.onload = () => {
				try {
					const j = JSON.parse(x.responseText);
					assert(!j.headers.authorization, "no auth header: " + j.headers.authorization);
					assertEqual(x.responseURL, location.origin + "/echo?jq", "responseURL");
					res();
				} catch (e) { rej(e); }
			};
			x.onerror = () => rej(new Error("xhr error"));
			x.send();
		});
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.open("POST", "/echo", true, null, null);
			x.setRequestHeader("Content-Type", "application/json");
			x.onload = () => { try { assertEqual(JSON.parse(x.responseText).body, "{}", "body"); res(); } catch (e) { rej(e); } };
			x.onerror = () => rej(new Error("xhr error 2"));
			x.send("{}");
		});
	`
	),
	t(
		"rv4-xhr-headers-and-events",
		`
		const events = [];
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.onreadystatechange = () => events.push("rs" + x.readyState);
			x.open("GET", "/text");
			x.onloadstart = () => events.push("loadstart");
			x.onprogress = () => events.push("progress");
			x.onload = () => {
				events.push("load");
				try {
					assertEqual(x.getResponseHeader("X-Custom"), "abc", "custom header");
					assertEqual(x.getResponseHeader("content-type"), "text/plain; charset=utf-8", "ct");
					const all = x.getAllResponseHeaders();
					assert(/x-custom: abc/.test(all), "all has custom: " + all);
					assert(/content-type: text\\/plain/.test(all), "all has ct: " + all);
					assert(!/x-scramjet/.test(all), "no carrier");
					assertEqual(x.getResponseHeader("link"), '</next>; rel="next"', "link");
				} catch (e) { rej(e); return; }
			};
			x.onloadend = () => { events.push("loadend"); res(); };
			x.onerror = () => rej(new Error("err"));
			x.send();
		});
		assertEqual(events.filter(e => e !== "progress").join(","), "rs1,loadstart,rs2,rs3,rs4,load,loadend", "event order");
	`
	),
	t(
		"rv4-xhr-responsetypes",
		`
		for (const [type, check] of [
			["json", (x) => x.response.method === "GET"],
			["text", (x) => typeof x.response === "string"],
			["arraybuffer", (x) => x.response instanceof ArrayBuffer],
			["blob", (x) => x.response instanceof Blob && x.response.type === "application/json"],
			["document", (x) => x.response === null || typeof x.response === "object"],
		]) {
			await new Promise((res, rej) => {
				const x = new XMLHttpRequest();
				x.open("GET", "/echo");
				x.responseType = type;
				x.onload = () => { try { assert(check(x), "responseType " + type); res(); } catch (e) { rej(e); } };
				x.onerror = () => rej(new Error("err " + type));
				x.send();
			});
		}
	`
	),
	t(
		"rv4-xhr-upload-progress",
		`
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			let up = 0;
			x.upload.onprogress = () => up++;
			x.upload.addEventListener("load", () => up++);
			x.open("POST", "/echo");
			x.onload = () => { try { assert(up > 0, "upload events fired"); assertEqual(JSON.parse(x.responseText).body.length, 100000, "body"); res(); } catch (e) { rej(e); } };
			x.onerror = () => rej(new Error("err"));
			x.send("a".repeat(100000));
		});
	`
	),
	t(
		"rv4-xhr-sync",
		`
		const x = new XMLHttpRequest();
		let threw = null;
		try {
			x.open("GET", "/text", false);
			x.send();
		} catch (e) { threw = e.name + ": " + e.message; }
		assertEqual(threw, null, "sync xhr open/send should not throw");
	`
	),
	t(
		"rv4-xhr-sync-undefined-async",
		`
		const x = new XMLHttpRequest();
		let threw = null;
		try {
			x.open("GET", "/text", undefined);
			x.send();
		} catch (e) { threw = e.name + ": " + e.message; }
		assertEqual(threw, null, "open with undefined async");
		console.log("sync-undefined status", x.status, x.readyState, x.responseText);
	`
	),
	t(
		"rv4-eventsource",
		`
		await new Promise((res, rej) => {
			const es = new EventSource("/sse");
			assertEqual(es.url, location.origin + "/sse", "url");
			const got = [];
			es.onmessage = (e) => { got.push(e.data); };
			es.addEventListener("custom", (e) => {
				got.push(e.data + ":" + e.lastEventId + ":" + e.origin);
				es.close();
				try {
					assertEqual(got.join("|"), "one|two:7:" + location.origin, "events");
					res();
				} catch (err) { rej(err); }
			});
			es.onerror = () => rej(new Error("es error"));
			setTimeout(() => rej(new Error("timeout " + got)), 5000);
		});
		const es2 = new EventSource(new URL("/sse", location.href), { withCredentials: true });
		assert(es2.withCredentials, "withCredentials");
		es2.close();
	`
	),
	t(
		"rv4-document-cookie",
		`
		document.cookie = "a=1";
		document.cookie = "b=2; path=/; max-age=3600; SameSite=Lax";
		document.cookie = "c=3; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		assert(document.cookie.includes("a=1"), "a: " + document.cookie);
		assert(document.cookie.includes("b=2"), "b");
		assert(!document.cookie.includes("c=3"), "c expired");
		document.cookie = "a=; max-age=0";
		assert(!document.cookie.includes("a=1"), "deleted");
		await fetch("/setcookie");
		assert(document.cookie.includes("srv=1"), "server cookie visible: " + document.cookie);
		assert(!document.cookie.includes("srvhttp"), "httponly hidden");
		const j = await (await fetch("/echo")).json();
		assert((j.headers.cookie || "").includes("b=2"), "cookie sent: " + j.headers.cookie);
		assert((j.headers.cookie || "").includes("srvhttp=2"), "httponly sent");
	`
	),
	t(
		"rv4-cookiestore",
		`
		if (!("cookieStore" in window)) { console.log("no cookieStore"); return; }
		await cookieStore.set("cs1", "v1");
		const c = await cookieStore.get("cs1");
		assertEqual(c && c.value, "v1", "get");
		assert(document.cookie.includes("cs1=v1"), "visible in document.cookie: " + document.cookie);
		document.cookie = "dc=5";
		const all = await cookieStore.getAll();
		assert(all.some(x => x.name === "dc"), "getAll sees document.cookie");
		await cookieStore.delete("cs1");
		assertEqual(await cookieStore.get("cs1"), null, "deleted");
		let changes = 0;
		cookieStore.addEventListener("change", () => changes++);
		await cookieStore.set({ name: "cs2", value: "x", expires: Date.now() + 100000 });
		const j = await (await fetch("/echo")).json();
		assert((j.headers.cookie || "").includes("cs2=x"), "sent to server: " + j.headers.cookie);
		await new Promise(r => setTimeout(r, 200));
		console.log("cookieStore change events:", changes);
	`
	),
	t(
		"rv4-sendbeacon",
		`
		assert(navigator.sendBeacon("/beacon", "beacondata"), "queued");
		await new Promise(r => setTimeout(r, 1000));
		const r = await (await fetch("/beaconresult")).text();
		assertEqual(r, "beacondata", "beacon reached server");
		const f = navigator.sendBeacon;
		assert(f.call(navigator, "/beacon", "x"), "call");
	`
	),
	t(
		"rv4-fetch-in-worker",
		`
		const src = \`
			(async () => {
				try {
					const r = await fetch("/text");
					postMessage({ url: r.url, ct: r.headers.get("content-type"), custom: r.headers.get("x-custom"), keys: [...r.headers.keys()].join(",") });
				} catch (e) { postMessage({ err: String(e) }); }
			})();
		\`;
		const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
		const d = await new Promise((res) => (w.onmessage = (e) => res(e.data)));
		assert(!d.err, "worker err " + d.err);
		assertEqual(d.url, location.origin + "/text", "url");
		assertEqual(d.custom, "abc", "custom");
		assert(!d.keys.includes("x-scramjet"), "no carriers " + d.keys);
	`
	),
	t(
		"rv4-fetch-iframe-realm",
		`
		const f = document.createElement("iframe");
		f.src = "/echo?frame";
		document.body.appendChild(f);
		await new Promise(r => f.onload = r);
		const w = f.contentWindow;
		const r = await w.fetch("/text");
		assertEqual(r.url, location.origin + "/text", "iframe fetch url");
		assertEqual(r.headers.get("x-custom"), "abc", "iframe headers");
		const r2 = await fetch.call(w, "/text");
		assert(r2.ok, "cross-realm this");
		const req = new w.Request("/echo?x");
		assertEqual(req.url, location.origin + "/echo?x", "iframe Request url");
		const r3 = await fetch(req);
		assert(r3.ok, "fetch foreign Request");
		assertEqual(r3.url, location.origin + "/echo?x", "foreign request url");
	`
	),
	serverTest({
		name: "rv4-ws-basics",
		autoPass: true,
		js: `
			const ws = new WebSocket(new URL("/sock", location.href.replace("http", "ws")), ["chat", "superchat"]);
			assertEqual(ws.readyState, 0, "connecting");
			assertEqual(ws.url, "ws://" + location.host + "/sock", "url");
			assertEqual(WebSocket.OPEN, 1, "static");
			assertEqual(ws.OPEN, 1, "proto const");
			ws.binaryType = "arraybuffer";
			const order = [];
			await new Promise((res, rej) => {
				ws.onopen = (e) => {
					order.push("open");
					try {
						assertEqual(ws.readyState, 1, "open state");
						assertEqual(ws.protocol, "chat", "negotiated protocol");
					} catch (e) { rej(e); return; }
					ws.send(new Uint8Array([1, 2, 3]));
				};
				ws.onmessage = (e) => {
					try {
						order.push("msg");
						assert(e.data instanceof ArrayBuffer, "arraybuffer");
						assertEqual(new Uint8Array(e.data)[2], 3, "data");
						assertEqual(e.origin, "ws://" + location.host, "origin");
						ws.close(4001, "bye");
					} catch (e) { rej(e); }
				};
				ws.onclose = (e) => {
					order.push("close");
					try {
						assertEqual(e.code, 4001, "code");
						assertEqual(e.reason, "bye", "reason");
						assert(e.wasClean, "clean");
						res();
					} catch (e) { rej(e); }
				};
				ws.onerror = () => rej(new Error("ws error"));
			});
			assertEqual(order.join(), "open,msg,close", "order");
		`,
		async start(server) {
			const wss = new WebSocketServer({
				server,
				handleProtocols: (protocols) =>
					protocols.has("chat") ? "chat" : false,
			});
			wss.on("connection", (s) =>
				s.on("message", (m, bin) =>
					s.send(m, {
						binary: bin,
					})
				)
			);
		},
	}),
	serverTest({
		name: "rv4-ws-server-close-and-text",
		autoPass: true,
		js: `
			const ws = new WebSocket("ws://" + location.host + "/");
			const got = [];
			await new Promise((res, rej) => {
				ws.onmessage = (e) => got.push(typeof e.data === "string" ? e.data : "blob:" + (e.data instanceof Blob));
				ws.onclose = (e) => { got.push("close:" + e.code + ":" + e.reason + ":" + e.wasClean); res(); };
				ws.onerror = () => got.push("error");
				setTimeout(() => rej(new Error("timeout " + got)), 5000);
			});
			assertEqual(got.join("|"), "hello|blob:true|close:4321:server-bye:true", "sequence");
		`,
		async start(server) {
			const wss = new WebSocketServer({
				server,
			});
			wss.on("connection", (s) => {
				s.send("hello");
				s.send(Buffer.from([1, 2]));
				setTimeout(() => s.close(4321, "server-bye"), 100);
			});
		},
	}),
];
