import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-cacheapi",
		autoPass: true,
		js: `
			const out = {};
			const keys = (r) => r ? [...r.headers].map(([k, v]) => k + "=" + (k === "date" ? "D" : v)).filter(k => !/keep|conn/.test(k)) : "undefined";
			const nm = "rv24-" + Math.random();
			const c = await caches.open(nm);
			await c.put("/a", new Response("pm", { headers: { "Content-Type": "text/x-page", "X-Page": "1" } }));
			let m = await c.match("/a"); out.pageMade = [keys(m), m.url, m.type, await m.text()];
			const fr = await fetch("/h");
			await c.put("/b", fr.clone());
			m = await c.match("/b"); out.fetched = [keys(m), m.url.replace(location.origin, ""), m.type, m.redirected, await m.text()];
			m = await c.match("/b"); out.fetchedClone = keys(m.clone());
			out.fetchedDateNum = typeof Date.parse(m.headers.get("date"));
			await c.put("/c", new Response(await (await fetch("/h")).blob(), fr));
			m = await c.match("/c"); out.rebuilt = [keys(m), m.url];
			const f2 = await fetch("/h"); const mod = new Response(f2.body, { status: f2.status, statusText: f2.statusText, headers: new Headers(f2.headers) }); mod.headers.set("sw-fetched-on", "123");
			await c.put("/d", mod);
			m = await c.match("/d"); out.workboxStyle = keys(m);
			await c.add("/h?add=1");
			m = await c.match("/h?add=1"); out.added = [keys(m), m.url.replace(location.origin, "")];
			m = await caches.match("/b"); out.cachesMatch = keys(m);
			const all = await c.matchAll(); out.matchAll = all.map(keys);
			const ks = await c.keys(); out.keys = ks.map(k => k.url.replace(location.origin, ""));
			await caches.delete(nm);
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				if (u.pathname === "/h") {
					res.setHeader("X-Foo", "foo");
					res.setHeader("ETag", '"e"');
					res.setHeader("Content-Type", "text/plain");
					res.setHeader("Content-Security-Policy", "img-src *");
					res.end("net");
					return;
				}
			});
		},
	}),
];
