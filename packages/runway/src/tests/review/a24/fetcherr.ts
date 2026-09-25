import { serverTest } from "../../../testcommon.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv24-fetcherr",
		autoPass: true,
		js: `
			const out = {};
			const t = async (k, fn) => { let sync = true; try { const p = fn(); sync = false; const v = await Promise.race([p, new Promise(r => setTimeout(() => r("HANG"), 2500))]); out[k] = v === "HANG" ? "HANG" : "ok"; } catch (e) { out[k] = (sync ? "SYNC " : "REJ ") + e.name; } };
			await t("noargs", () => fetch());
			await t("sym", () => fetch(Symbol()));
			await t("badInit", () => fetch("/x", 5));
			await t("badMode", () => fetch("/x", { mode: "bogus" }));
			await t("badMethod", () => fetch("/x", { method: "a b" }));
			await t("getBody", () => fetch("/x", { method: "GET", body: "x" }));
			await t("badHeader", () => fetch("/x", { headers: { "a b": "1" } }));
			await t("navigateMode", () => fetch("/x", { mode: "navigate" }));
			await t("credsUrl", () => fetch("http://u:p@localhost/x"));
			await t("ftp", () => fetch("ftp://x/y"));
			await t("unfetchableScheme", () => fetch("chrome://version"));
			await t("fileUrl", () => fetch("file:///etc/passwd"));
			await t("aboutBlank", () => fetch("about:blank"));
			await t("jsUrl", () => fetch("javascript:1"));
			await t("reqNoArgs", () => new Request());
			await t("respBadStatus", () => new Response("", { status: 99 }));
			await t("respNullBody", () => new Response("x", { status: 204 }));
			await t("detachedThis", () => { const f = window.fetch; return f.call(undefined, "/x"); });
			await t("wrongThis", () => window.fetch.call({}, "/x"));
			for (const k in out) assertConsistent(k, out[k]);
			if (window.__dump !== false) fail("R24 " + JSON.stringify(out));
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/x") res.end("x");
			});
		},
	}),
];
