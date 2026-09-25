import { hdrTest } from "./nonce.ts";

const js = `
runTest(async () => {
	const pol = trustedTypes.createPolicy("m", { createHTML: s => s, createScript: s => s, createScriptURL: s => s });
	const out = {};
	const t = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = "ERR " + e.name + ": " + String(e.message).slice(0, 60); } };
	await t("importTSU", async () => (await import(pol.createScriptURL("/mod.mjs"))).v);
	await t("importTSUcatch", () => import(pol.createScriptURL("/mod.mjs?2")).then(m => m.v, e => "rej " + e.name));
	await t("execInsertHTML", () => { const d = document.createElement("div"); d.contentEditable = "true"; document.body.append(d); d.focus(); document.execCommand("insertHTML", false, pol.createHTML("<b>x</b>")); return d.innerHTML; });
	await t("crossRealm", () => { const f = document.createElement("iframe"); document.body.append(f); const p2 = f.contentWindow.trustedTypes.createPolicy("x", { createHTML: s => s }); const d = document.createElement("div"); d.innerHTML = p2.createHTML("<i>cr</i>"); return d.innerHTML; });
	await t("crossRealmScript", () => { const f = document.createElement("iframe"); document.body.append(f); const p2 = f.contentWindow.trustedTypes.createPolicy("y", { createScript: s => s }); const s = document.createElement("script"); s.text = p2.createScript("window.__cr = 9"); document.head.append(s); return window.__cr; });
	await t("iframeSrcTSU", () => { const f = document.createElement("iframe"); f.src = pol.createScriptURL("/x.html"); return f.src.replace(/:\\d+/, ":P"); });
	await t("blobTH", () => new Blob([pol.createHTML("<p>")]).size);
	await t("textNodeTS", () => document.createTextNode(pol.createScript("a")).data);
	await t("setTimeoutTS", () => new Promise(r => { window.__stcb = r; setTimeout(pol.createScript("window.__stcb('ran')"), 0); setTimeout(() => r("never"), 500); }));
	await t("FunctionTS", () => new Function(pol.createScript("return 7"))());
	await t("evalTS", () => eval(pol.createScript("8")));
	await t("scriptSrcTSUload", () => new Promise(r => { const s = document.createElement("script"); s.src = pol.createScriptURL("/cls.js"); s.onload = () => r(window.__cls); s.onerror = () => r("error"); document.head.append(s); }));
	await t("workerTSU", () => new Promise(r => { const w = new Worker(pol.createScriptURL("/w.js")); w.onmessage = e => r(e.data); w.onerror = () => r("error"); }));
	await t("insertAdjTH", () => { const d = document.createElement("div"); d.insertAdjacentHTML("afterbegin", pol.createHTML("<a href='/q'>q</a>")); return d.firstChild.href.replace(/:\\d+/, ":P"); });
	await t("srcdocTHload", () => new Promise(r => { const f = document.createElement("iframe"); f.srcdoc = pol.createHTML("<script>parent.postMessage('sd-ok','*')<\\/script>"); addEventListener("message", e => { if (e.data === "sd-ok") r("ok"); }); document.body.append(f); setTimeout(() => r("timeout"), 3000); }));
	assertConsistent("ttmisc", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-ttmisc",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js}</script></body>`,
			},
			"/mod.mjs": {
				body: "export const v = 5;",
				type: "text/javascript",
			},
			"/cls.js": {
				body: "window.__cls = 'cls';",
				type: "text/javascript",
			},
			"/w.js": {
				body: "postMessage('w');",
				type: "text/javascript",
			},
			"/x.html": {
				body: "x",
			},
		},
	}),
];
