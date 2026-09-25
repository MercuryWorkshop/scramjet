import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
function srv(server) {
	server.on("request", (req, res) => {
		const u = new URL(req.url, "http://x");
		if (u.pathname === "/multi") {
			res.setHeader("Link", ['</p2>; rel="next"', '</p9>; rel="last"']);
			res.setHeader("Vary", ["Accept", "Origin"]);
			res.setHeader("X-Foo", ["a", "b , c", ' "q,uo" ']);
			res.setHeader("Set-Cookie", ["a=1", "b=2"]);
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			res.setHeader("Cache-Control", ["no-cache", "max-age=0"]);
			res.setHeader("WWW-Authenticate", ['Basic realm="a"', 'Bearer x="1,2"']);
			res.setHeader("Server-Timing", ["db;dur=53", "app;dur=47.2"]);
			res.setHeader("Content-Security-Policy", [
				"default-src 'self'",
				"img-src *",
			]);
			res.setHeader("X-RateLimit-Remaining", "59");
			res.setHeader("ETag", 'W/"abc"');
			res.end('{"a":1}');
			return;
		}
	});
}
export default [
	serverTest({
		name: "rv24-multi",
		autoPass: true,
		js: `
			const r = await fetch("/multi");
			const h = r.headers;
			const out = {};
			for (const n of ["link","vary","x-foo","set-cookie","content-type","cache-control","www-authenticate","server-timing","content-security-policy","x-ratelimit-remaining","etag","content-length","date","connection","keep-alive"]) out[n] = h.get(n);
			out.iter = [...h].map(([k,v]) => k + "=" + v);
			out.getSetCookie = h.getSetCookie();
			out.has = h.has("X-Foo");
			out.type = r.type; out.redirected = r.redirected;
			const x = new XMLHttpRequest();
			x.open("GET", "/multi");
			await new Promise(res => { x.onload = res; x.send(); });
			out.xhrAll = x.getAllResponseHeaders();
			out.xhrLink = x.getResponseHeader("LINK");
			out.xhrFoo = x.getResponseHeader("x-foo");
			out.xhrCookie = x.getResponseHeader("set-cookie");
			for (const k in out) if (!/date|connection|keep-alive/.test(k)) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			srv(server);
		},
	}),
	serverTest({
		name: "rv24-blobdata",
		autoPass: true,
		js: `
			const out = {};
			const b = URL.createObjectURL(new Blob(["hi"], { type: "text/x-foo;charset=utf-8" }));
			let r = await fetch(b);
			out.blobCT = r.headers.get("content-type"); out.blobLen = r.headers.get("content-length");
			out.blobIter = [...r.headers];
			r = await fetch("data:text/csv;charset=utf-8,a,b");
			out.dataCT = r.headers.get("content-type");
			out.dataIter = [...r.headers];
			const x = new XMLHttpRequest(); x.open("GET", b);
			await new Promise(res => { x.onload = res; x.onerror = res; x.send(); });
			out.xhrBlobCT = x.getResponseHeader("content-type"); out.xhrBlobAll = x.getAllResponseHeaders();
			const y = new XMLHttpRequest(); y.open("GET", "data:application/json,{}");
			await new Promise(res => { y.onload = res; y.onerror = res; y.send(); });
			out.xhrDataCT = y.getResponseHeader("content-type"); out.xhrDataAll = y.getAllResponseHeaders();
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			srv(server);
		},
	}),
];
