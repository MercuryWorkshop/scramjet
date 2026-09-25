import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-xrealm-headers",
		autoPass: true,
		js: `
			const out = {};
			const f = document.createElement("iframe"); f.src = "/child"; document.body.append(f); await new Promise(r => f.onload = r);
			const cw = f.contentWindow;
			const pr = await fetch("/h");
			const t = (k, fn) => { try { out[k] = fn(); } catch (e) { out[k] = "ERR " + e.message; } };
			t("childGet", () => cw.Headers.prototype.get.call(pr.headers, "x-foo"));
			t("childNewHeaders", () => [...new cw.Headers(pr.headers)].map(([k]) => k).filter(k => !/date|keep|conn/.test(k)));
			t("childNewResponse", () => [...new cw.Response("x", { headers: pr.headers }).headers].map(([k]) => k).filter(k => !/date|keep|conn/.test(k)));
			t("childEntries", () => [...cw.Headers.prototype.entries.call(pr.headers)].map(([k]) => k).filter(k => !/date|keep|conn/.test(k)));
			t("childGetter", () => Object.getOwnPropertyDescriptor(cw.Response.prototype, "headers").get.call(pr).get("x-foo"));
			const cr = await cw.fetch("/h");
			t("parentGetOnChild", () => Headers.prototype.get.call(cr.headers, "x-foo"));
			t("parentNewHeadersFromChild", () => [...new Headers(cr.headers)].map(([k]) => k).filter(k => !/date|keep|conn/.test(k)));
			t("parentGetterOnChild", () => Object.getOwnPropertyDescriptor(Response.prototype, "headers").get.call(cr).get("x-foo"));
			t("childUrl", () => Object.getOwnPropertyDescriptor(cw.Response.prototype, "url").get.call(pr).replace(location.origin, ""));
			// child realm fetch with parent response headers as request headers
			const echo = await (await cw.fetch("/echo", { headers: pr.headers })).json();
			out.childFetchSentHeaders = echo;
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const u = new URL(req.url, "http://x");
				if (u.pathname === "/child") {
					res.setHeader("Content-Type", "text/html");
					res.end("<p>child</p>");
					return;
				}
				if (u.pathname === "/h") {
					res.setHeader("X-Foo", "foo");
					res.setHeader("Content-Type", "text/plain");
					res.end("x");
					return;
				}
				if (u.pathname === "/echo") {
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify(
							Object.keys(req.headers).filter((k) => k.startsWith("x-"))
						)
					);
					return;
				}
			});
		},
	}),
];
