import http from "http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../../testcommon.ts";

// every request is logged with its Sec-Fetch-*, Origin and Referer headers; /__log returns the log
function logTest(
	name: string,
	pageHtml: string,
	pageHeaders: Record<string, string> = {}
): Test {
	let server: http.Server;
	let logs: Record<string, any[]> = {};
	const test: Test = {
		name,
		port: 0,
		async start() {
			logs = {};
			server = http.createServer((req, res) => {
				const u = new URL(req.url!, "http://x");
				let p = u.pathname;
				let run = "none";
				const mm = /^\/(r[a-z0-9]{6,})(\/.*)$/.exec(p);
				if (mm) {
					run = mm[1];
					p = mm[2];
				}
				const log = (logs[run] ||= []);
				if (p === "/__log") {
					res.writeHead(200, {
						"content-type": "application/json",
						"access-control-allow-origin": "*",
						"cache-control": "no-store",
					});
					res.end(JSON.stringify(log));
					return;
				}
				if (!p.startsWith("/favicon"))
					log.push({
						p: p + u.search.replace(/[?&]?t=r[a-z0-9]+/, ""),
						host: req.headers.host?.startsWith("127.") ? "X" : "S",
						m: req.method,
						site: req.headers["sec-fetch-site"],
						mode: req.headers["sec-fetch-mode"],
						dest: req.headers["sec-fetch-dest"],
						user: req.headers["sec-fetch-user"],
						origin: req.headers["origin"]?.replace(/:\d+/, ":P"),
						ref: req.headers["referer"]?.replace(/:\d+/, ":P"),
						cookie: req.headers["cookie"] ? "yes" : undefined,
					});
				const cors = {
					"access-control-allow-origin": req.headers.origin || "*",
					"access-control-allow-credentials": "true",
					"cache-control": "no-store",
				};
				if (p === "/") {
					res.writeHead(200, {
						"content-type": "text/html",
						"set-cookie": "sid=1; SameSite=None; Secure",
						...pageHeaders,
					});
					res.end(pageHtml.replaceAll("$PORT", String(test.port)));
				} else if (p.endsWith(".js") || p.endsWith(".mjs")) {
					res.writeHead(200, {
						"content-type": "text/javascript",
						...cors,
					});
					res.end(
						p.includes("worker")
							? "postMessage(1)"
							: "window.__loaded=(window.__loaded||0)+1"
					);
				} else if (p.endsWith(".css")) {
					res.writeHead(200, {
						"content-type": "text/css",
						...cors,
					});
					res.end("");
				} else if (p.endsWith(".html")) {
					res.writeHead(200, {
						"content-type": "text/html",
						...cors,
					});
					res.end("<p>frame</p>");
				} else if (p.endsWith(".png")) {
					res.writeHead(200, {
						"content-type": "image/gif",
						...cors,
					});
					res.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
				} else {
					res.writeHead(200, {
						"content-type": "text/plain",
						...cors,
					});
					res.end("x");
				}
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
	const T = "r" + Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, "a");
	const X = "http://127.0.0.1:" + location.port + "/" + T;
	const S = "/" + T;
	const wait = ms => new Promise(r => setTimeout(r, ms));
	const load = (el) => new Promise(r => { el.onload = el.onerror = r; document.body.append(el); setTimeout(r, 3000); });
	await fetch(S + "/f-same");
	await fetch(X + "/f-cross");
	await fetch(X + "/f-cross-nocors", { mode: "no-cors" });
	await fetch(X + "/f-cross-cred", { credentials: "include" });
	await fetch(S + "/f-post", { method: "POST", body: "x" });
	await fetch(S + "/f-refpol-origin", { referrerPolicy: "origin" });
	await fetch(S + "/f-referrer-custom", { referrer: "/custom-ref" });
	await fetch(S + "/f-noref", { referrer: "" });
	await new Promise(r => { const x = new XMLHttpRequest(); x.open("GET", X + "/xhr-cross"); x.onloadend = r; x.send(); });
	await load(Object.assign(document.createElement("img"), { src: X + "/img.png" }));
	await load(Object.assign(document.createElement("img"), { src: X + "/img-cors.png", crossOrigin: "anonymous" }));
	await load(Object.assign(document.createElement("script"), { src: X + "/s.js" }));
	await load(Object.assign(document.createElement("script"), { src: X + "/m.mjs", type: "module" }));
	await load(Object.assign(document.createElement("link"), { rel: "stylesheet", href: X + "/c.css" }));
	await load(Object.assign(document.createElement("iframe"), { src: X + "/fr.html" }));
	await load(Object.assign(document.createElement("iframe"), { src: S + "/fr-same.html" }));
	await load(Object.assign(document.createElement("img"), { src: S + "/img-nr.png", referrerPolicy: "no-referrer" }));
	await new Promise(r => { const w = new Worker(S + "/worker.js"); w.onmessage = r; w.onerror = r; setTimeout(r, 3000); });
	navigator.sendBeacon(X + "/beacon", "b");
	try { await import(X + "/dyn.mjs"); } catch (e) {}
	const t = document.createElement("iframe"); t.name = "tgt"; document.body.append(t);
	const nav = async (make) => { await new Promise(r => { t.onload = r; make(); setTimeout(r, 2500); }); };
	const link = (href, attrs) => { const a = document.createElement("a"); a.href = href; a.target = "tgt"; for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v); document.body.append(a); return a; };
	await nav(() => link(S + "/nav-a.html", {}).click());
	await nav(() => link(S + "/nav-a-noref.html", { rel: "noreferrer" }).click());
	await nav(() => link(X + "/nav-a-origin.html", { referrerpolicy: "origin" }).click());
	await nav(() => link(X + "/nav-a-cross.html", {}).click());
	await nav(() => { const f = document.createElement("form"); f.action = X + "/nav-form.html"; f.method = "post"; f.target = "tgt"; f.setAttribute("referrerpolicy", "no-referrer"); document.body.append(f); f.submit(); });
	await nav(() => { const f = document.createElement("form"); f.action = S + "/nav-form-get.html"; f.target = "tgt"; const i = document.createElement("input"); i.name = "q"; i.value = "1"; f.append(i); document.body.append(f); f.submit(); });
	await nav(() => { t.contentWindow.location.href = X + "/nav-loc.html"; });
	await nav(() => { window.open(S + "/nav-open.html", "tgt"); });
	await wait(800);
	const log = await (await fetch(S + "/__log")).json();
	const out = {};
	for (const e of log) { const k = e.host + " " + e.p; if (!(k in out)) { delete e.p; delete e.host; out[k] = e; } }
	assertConsistent("secfetch", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	logTest(
		"rv25-secfetch",
		`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>${js}</script></body></html>`
	),
	logTest(
		"rv25-secfetch-refpolhdr",
		`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>${js}</script></body></html>`,
		{
			"referrer-policy": "no-referrer",
		}
	),
	logTest(
		"rv25-secfetch-refpolmeta",
		`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="origin"></head><body><script>${js}</script></body></html>`
	),
];
