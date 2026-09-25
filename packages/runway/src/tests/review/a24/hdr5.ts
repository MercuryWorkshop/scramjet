import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
let beacons = [];
function srv(server) {
	server.on("request", (req, res) => {
		const u = new URL(req.url, "http://x");
		const p = u.pathname;
		if (p === "/echo") {
			let b = "";
			req.on("data", (d) => (b += d));
			req.on("end", () => {
				res.setHeader("Content-Type", "application/json");
				res.end(
					JSON.stringify({
						m: req.method,
						q: u.search,
						ct: req.headers["content-type"] || null,
						b,
						x: req.headers["x-a"] || null,
						cookie: req.headers["cookie"] || null,
						xs: Object.keys(req.headers).filter((k) =>
							k.startsWith("x-scramjet")
						),
					})
				);
			});
			return;
		}
		if (p === "/beacon") {
			let b = "";
			req.on("data", (d) => (b += d));
			req.on("end", () => {
				beacons.push({
					ct: req.headers["content-type"] || null,
					b,
				});
				res.end();
			});
			return;
		}
		if (p === "/beacons") {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(beacons));
			beacons = [];
			return;
		}
	});
}
export default [
	serverTest({
		name: "rv24-inputs",
		autoPass: true,
		js: `
			const out = {};
			const t = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = "ERR " + e.name + ": " + e.message; } };
			await t("urlObj", async () => (await (await fetch(new URL("/echo?a=1", location.href))).json()).q);
			await t("strObj", async () => (await (await fetch({ toString() { return "/echo?b=2"; } })).json()).q);
			await t("reqUrlObj", async () => (await (await fetch(new Request(new URL("/echo?c=3", location.href)))).json()).q);
			await t("reqPost", async () => (await (await fetch(new Request("/echo", { method: "POST", body: "hi", headers: { "x-a": "1" } }))).json()));
			await t("reqCopyInit", async () => { const r0 = new Request("/echo?d=4", { method: "POST", body: "zz", headers: { "content-type": "text/foo" } }); return (await (await fetch(r0, { headers: { "x-a": "2" } })).json()); });
			await t("respHeadersIntoReq", async () => { const r1 = await fetch("/echo"); return (await (await fetch("/echo", { method: "POST", body: "q", headers: r1.headers })).json()); });
			await t("respHeadersSpread", async () => { const r1 = await fetch("/echo"); return (await (await fetch("/echo", { headers: Object.fromEntries(r1.headers) })).json()).xs; });
			await t("xhrUrlObj", async () => { const x = new XMLHttpRequest(); x.open("GET", new URL("/echo?e=5", location.href)); await new Promise(r => { x.onload = r; x.send(); }); return JSON.parse(x.responseText).q; });
			await t("formdata", async () => { const fd = new FormData(); fd.append("a", "b"); return (await (await fetch("/echo", { method: "POST", body: fd })).json()).ct.split(";")[0]; });
			await t("usp", async () => (await (await fetch("/echo", { method: "POST", body: new URLSearchParams("a=b") })).json()).ct);
			await t("blobType", async () => (await (await fetch("/echo", { method: "POST", body: new Blob(["x"], { type: "text/x-y" }) })).json()).ct);
			await t("beacon", async () => { navigator.sendBeacon(new URL("/beacon", location.href), new Blob(["{}"], { type: "text/plain" })); navigator.sendBeacon("/beacon", "str"); navigator.sendBeacon("/beacon", new URLSearchParams("a=1")); await new Promise(r => setTimeout(r, 500)); return (await (await fetch("/beacons")).json()); });
			await t("reqClone", async () => { const r = new Request("/echo?f=6"); return [r.url.replace(location.origin, ""), r.clone().url.replace(location.origin, "")]; });
			await t("respUrlClone", async () => { const r = await fetch("/echo?g=7"); return [r.url.replace(location.origin, ""), r.clone().url.replace(location.origin, "")]; });
			await t("keepalive", async () => (await (await fetch("/echo?h=8", { keepalive: true, method: "POST", body: "k" })).json()).b);
			await t("signalAbort", async () => { const ac = new AbortController(); const p = fetch("/echo", { signal: ac.signal }); ac.abort(); await p; return "no"; });
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			srv(server);
		},
	}),
];
