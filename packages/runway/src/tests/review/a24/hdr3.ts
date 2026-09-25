import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
function srv(server) {
	server.on("request", (req, res) => {
		const u = new URL(req.url, "http://x");
		const p = u.pathname;
		if (p === "/multi") {
			res.setHeader("Link", ['</p2>; rel="next"', '</p9>; rel="last"']);
			res.setHeader("X-Foo", "foo");
			res.setHeader("Content-Security-Policy", "default-src 'self'");
			res.setHeader("Content-Type", "application/json");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.end('{"a":1}');
			return;
		}
		if (p === "/w.js") {
			res.setHeader("Content-Type", "text/javascript");
			res.end(`
				async function probe() {
					const r = await fetch("/multi");
					const o = { get: r.headers.get("x-foo"), link: r.headers.get("link"), keys: [...r.headers.keys()].filter(k => !/date|keep-alive|connection/.test(k)) };
					if (self.XMLHttpRequest) { const x = new XMLHttpRequest(); x.open("GET", "/multi"); await new Promise(res => { x.onload = res; x.send(); }); o.xhr = x.getResponseHeader("x-foo"); o.xhrLink = x.getResponseHeader("link"); }
					const c = await caches.open("w"); await c.put("/multi", await fetch("/multi")); const m = await c.match("/multi"); o.cache = m.headers.get("x-foo");
					return o;
				}
				if (self.onconnect === null) self.onconnect = e => { const port = e.ports[0]; probe().then(o => port.postMessage(o), e => port.postMessage(String(e))); };
				else probe().then(o => postMessage(o), e => postMessage(String(e)));
			`);
			return;
		}
	});
}
const PROBE = `async (w) => {
	const r = await w.fetch("/multi");
	const o = { get: r.headers.get("x-foo"), link: r.headers.get("link"), keys: [...r.headers.keys()].filter(k => !/date|keep-alive|connection/.test(k)) };
	const x = new w.XMLHttpRequest(); x.open("GET", "/multi"); await new Promise(res => { x.onload = res; x.send(); }); o.xhr = x.getResponseHeader("x-foo"); o.xhrAll = x.getAllResponseHeaders().split("\\r\\n").map(l => l.split(":")[0]).filter(k => k && !/date|keep-alive|connection/.test(k));
	return o;
}`;
export default [
	serverTest({
		name: "rv24-realms",
		autoPass: true,
		js: `
			const out = {};
			const probe = ${PROBE};
			out.top = await probe(window);
			const f = document.createElement("iframe"); document.body.append(f);
			out.blankIframe = await probe(f.contentWindow);
			const f2 = document.createElement("iframe"); f2.srcdoc = "<p>x</p>"; document.body.append(f2); await new Promise(r => f2.onload = r);
			out.srcdoc = await probe(f2.contentWindow);
			const f3 = document.createElement("iframe"); f3.src = "/multi"; document.body.append(f3); await new Promise(r => f3.onload = r);
			try { out.sameOriginIframe = await probe(f3.contentWindow); } catch (e) { out.sameOriginIframe = String(e); }
			// fetch from the child realm, read with the parent's getter
			const cr = await f.contentWindow.fetch("/multi");
			out.crossRealmGetter = Object.getOwnPropertyDescriptor(Response.prototype, "headers").get.call(cr).get("x-foo");
			out.crossRealmHeadersGet = Headers.prototype.get.call(cr.headers, "x-foo");
			// removed iframe fetch (Sentry getNativeImplementation style keeps the iframe)
			const w1 = new Worker("/w.js");
			out.worker = await new Promise(r => w1.onmessage = e => r(e.data));
			const w2 = new Worker(URL.createObjectURL(new Blob(["importScripts(" + JSON.stringify(location.origin + "/w.js") + ")"])));
			out.blobWorker = await new Promise(r => { w2.onmessage = e => r(e.data); w2.onerror = e => r("err " + e.message); });
			const sw = new SharedWorker("/w.js");
			out.shared = await new Promise(r => { sw.port.onmessage = e => r(e.data); sw.port.start(); });
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			srv(server);
		},
	}),
];
