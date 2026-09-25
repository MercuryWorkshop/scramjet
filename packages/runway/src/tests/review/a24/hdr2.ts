import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
function srv(server) {
	server.on("request", (req, res) => {
		const u = new URL(req.url, "http://x");
		const p = u.pathname;
		if (p === "/cors" || p === "/corsexp" || p === "/nocors") {
			if (p !== "/nocors") res.setHeader("Access-Control-Allow-Origin", "*");
			if (p === "/corsexp")
				res.setHeader("Access-Control-Expose-Headers", "Link, X-Total-Count");
			res.setHeader("Link", '</p2>; rel="next"');
			res.setHeader("X-Total-Count", "42");
			res.setHeader("X-Secret", "s");
			res.setHeader("Content-Security-Policy", "default-src 'none'");
			res.setHeader("X-Frame-Options", "DENY");
			res.setHeader("Content-Type", "application/json");
			res.setHeader("Cache-Control", "max-age=10");
			res.end("{}");
			return;
		}
		if (p === "/r1") {
			res.writeHead(302, {
				Location: "/r2",
				"X-Hop": "1",
			});
			res.end();
			return;
		}
		if (p === "/r2") {
			res.writeHead(200, {
				"X-Hop": "2",
				"Content-Type": "text/plain",
			});
			res.end("final");
			return;
		}
		if (p === "/etag") {
			if (req.headers["if-none-match"] === '"v1"') {
				res.writeHead(304, {
					ETag: '"v1"',
					"X-Revalidated": "yes",
				});
				res.end();
				return;
			}
			res.writeHead(200, {
				ETag: '"v1"',
				"Cache-Control": "no-cache",
				"Content-Type": "text/plain",
				"X-Revalidated": "no",
			});
			res.end("body");
			return;
		}
	});
}
export default [
	serverTest({
		name: "rv24-cors",
		autoPass: true,
		js: `
			const out = {};
			const other = location.protocol + "//127.0.0.1:" + location.port;
			const dump = (h) => [...h].map(([k,v]) => k).filter(k => !/date|keep-alive|connection/.test(k));
			let r = await fetch(other + "/cors");
			out.corsType = r.type; out.corsKeys = dump(r.headers); out.corsLink = r.headers.get("link"); out.corsCSP = r.headers.get("content-security-policy");
			r = await fetch(other + "/corsexp");
			out.expKeys = dump(r.headers); out.expLink = r.headers.get("link");
			r = await fetch(other + "/nocors", { mode: "no-cors" });
			out.ncType = r.type; out.ncStatus = r.status; out.ncKeys = dump(r.headers); out.ncCT = r.headers.get("content-type");
			const x = new XMLHttpRequest(); x.open("GET", other + "/cors");
			await new Promise(res => { x.onload = res; x.onerror = res; x.send(); });
			out.xhrAll = x.getAllResponseHeaders().split("\\r\\n").map(l => l.split(":")[0]).filter(k => k && !/date|keep-alive|connection/.test(k));
			out.xhrSecret = x.getResponseHeader("x-secret");
			r = await fetch("/r1");
			out.redir = [r.redirected, r.url.replace(location.origin, ""), r.headers.get("x-hop"), r.status];
			r = await fetch("/r1", { redirect: "manual" });
			out.manual = [r.type, r.status, dump(r.headers), r.url.replace(location.origin, "")];
			r = await fetch("/etag");
			out.e1 = [r.status, r.headers.get("etag"), r.headers.get("x-revalidated")];
			try { throw "skip-304-libcurl";
			out.e2 = [r.status, r.headers.get("etag"), r.headers.get("x-revalidated")]; } catch (e) { out.e2 = String(e); }
			r = await fetch("/etag");
			out.e3 = [r.status, r.headers.get("etag"), r.headers.get("x-revalidated")];
			r = await fetch("/etag", { cache: "no-cache" });
			out.e4 = [r.status, r.headers.get("x-revalidated")];
			const c = (await fetch("/r2")).clone();
			out.clone = [c.headers.get("x-hop"), c.url.replace(location.origin, "")];
			const orig = await fetch("/r2");
			const built = new Response("x", orig);
			out.built = [built.headers.get("x-hop"), dump(built.headers)];
			const built2 = new Response("x", { headers: orig.headers });
			out.built2 = dump(built2.headers);
			out.json = [...Response.json({a:1}).headers];
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			srv(server);
		},
	}),
];
