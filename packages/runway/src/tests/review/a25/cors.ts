import http from "http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../../testcommon.ts";

function corsTest(name: string, js: string): Test {
	let server: http.Server;
	const test: Test = {
		name,
		port: 0,
		async start() {
			server = http.createServer((req, res) => {
				const u = new URL(req.url!, "http://x");
				const p = u.pathname;
				const o = req.headers.origin;
				if (p === "/") {
					res.writeHead(200, {
						"content-type": "text/html",
					});
					res.end(`<!DOCTYPE html><script>${js}</script>`);
					return;
				}
				if (req.method === "OPTIONS") {
					if (p === "/preflight-ok") {
						res.writeHead(204, {
							"access-control-allow-origin": o || "*",
							"access-control-allow-headers": "x-foo",
							"access-control-allow-methods": "PUT",
						});
						res.end();
						return;
					}
					res.writeHead(204);
					res.end();
					return;
				}
				const h: Record<string, string> = {
					"content-type": "text/plain",
					"x-secret": "s",
					"cache-control": "no-store",
				};
				if (p === "/acao-star") h["access-control-allow-origin"] = "*";
				if (p === "/acao-echo-cred") {
					h["access-control-allow-origin"] = o || "";
					h["access-control-allow-credentials"] = "true";
				}
				if (p === "/acao-echo") h["access-control-allow-origin"] = o || "";
				if (p === "/acao-wrong")
					h["access-control-allow-origin"] = "https://other.example";
				if (p === "/preflight-ok") h["access-control-allow-origin"] = o || "*";
				if (p === "/expose") {
					h["access-control-allow-origin"] = "*";
					h["access-control-expose-headers"] = "x-secret";
				}
				if (p === "/redir") {
					res.writeHead(302, {
						location: "/acao-star",
						"access-control-allow-origin": "*",
					});
					res.end();
					return;
				}
				if (p === "/redir-same") {
					res.writeHead(302, {
						location: "/plain-same",
					});
					res.end();
					return;
				}
				res.writeHead(200, h);
				res.end("body:" + p);
			});
			await new Promise<void>((r) =>
				server.listen(0, () => {
					test.port = (server.address() as AddressInfo).port;
					r();
				})
			);
		},
		async stop() {
			server.closeAllConnections?.();
			await new Promise<void>((r) => server.close(() => r()));
		},
	};
	return test;
}

const js = `
runTest(async () => {
	const X = "http://127.0.0.1:" + location.port;
	const out = {};
	const f = async (k, url, init) => {
		try { const r = await fetch(url, init); let t = null; try { t = await r.text(); } catch (e) { t = "textERR"; }
			out[k] = { type: r.type, status: r.status, ok: r.ok, url: r.url.replace(/:\\d+/, ":P"), redirected: r.redirected, body: t, secret: r.headers.get("x-secret"), ctype: r.headers.get("content-type") };
		} catch (e) { out[k] = "ERR " + e.name; }
	};
	await f("noAcao", X + "/plain");
	await f("star", X + "/acao-star");
	await f("starCred", X + "/acao-star", { credentials: "include" });
	await f("echoCred", X + "/acao-echo-cred", { credentials: "include" });
	await f("echoNoCredHdr", X + "/acao-echo", { credentials: "include" });
	await f("wrong", X + "/acao-wrong");
	await f("noCors", X + "/plain", { mode: "no-cors" });
	await f("sameOriginMode", X + "/acao-star", { mode: "same-origin" });
	await f("preflightFail", X + "/plain", { method: "PUT", headers: { "x-foo": "1" } });
	await f("preflightOk", X + "/preflight-ok", { method: "PUT", headers: { "x-foo": "1" } });
	await f("expose", X + "/expose");
	await f("redir", X + "/redir");
	await f("redirManual", X + "/redir", { redirect: "manual" });
	await f("redirError", "/redir-same", { redirect: "error" });
	await f("sameRedirManual", "/redir-same", { redirect: "manual" });
	await f("same", "/plain-same");
	out.xhr = await new Promise(res => { const x = new XMLHttpRequest(); x.open("GET", X + "/plain"); x.onload = () => res(["load", x.status, x.responseText]); x.onerror = () => res(["error", x.status]); x.send(); });
	out.xhrStar = await new Promise(res => { const x = new XMLHttpRequest(); x.open("GET", X + "/acao-star"); x.onload = () => res(["load", x.status, x.responseText, x.getResponseHeader("x-secret")]); x.onerror = () => res(["error", x.status]); x.send(); });
	out.img = await new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res("load"); i.onerror = () => res("error"); i.src = X + "/plain.png"; });
	assertConsistent("cors", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [corsTest("rv25-cors", js)];
