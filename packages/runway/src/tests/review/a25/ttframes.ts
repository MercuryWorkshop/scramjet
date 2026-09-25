import { hdrTest } from "./nonce.ts";

const js = (withDefault: boolean, enforce = true) => `
runTest(async () => {
	const pol = trustedTypes.createPolicy("app", { createHTML: s => s, createScript: s => s, createScriptURL: s => s });
	${withDefault ? `trustedTypes.createPolicy("default", { createScript: s => s, createHTML: s => s, createScriptURL: s => s });` : ""}
	if (${enforce}) { const m = document.createElement("meta"); m.httpEquiv = "Content-Security-Policy"; m.content = "require-trusted-types-for 'script'"; document.head.appendChild(m); }
	const errs = []; addEventListener("error", e => errs.push(String(e.message).slice(0, 100)));
	const out = {};
	const probe = (w) => { const r = {}; try { r.href = w.location.href.replace(/:\\d+/, ":P"); } catch (e) { r.href = "ERR " + e.name; }
		try { r.origin = w.origin.replace(/:\\d+/, ":P"); } catch (e) { r.origin = "ERR"; }
		try { const i = w.document.createElement("img"); i.src = "/pic.png"; w.document.body.appendChild(i); r.imgSrc = i.src.replace(/:\\d+/, ":P"); r.imgAttr = i.getAttribute("src"); } catch (e) { r.img = "ERR " + e.name + " " + String(e.message).slice(0, 60); }
		try { w.document.cookie = "fc=1"; r.cookie = document.cookie.includes("fc=1"); } catch (e) { r.cookie = "ERR"; }
		try { r.ls = (w.localStorage.setItem("k", "v"), localStorage.getItem("k")); } catch (e) { r.ls = "ERR"; }
		return r; };
	const blank = document.createElement("iframe"); document.body.append(blank);
	out.blank = probe(blank.contentWindow);
	const sd = document.createElement("iframe"); sd.srcdoc = pol.createHTML("<p>x</p>"); document.body.append(sd);
	await new Promise(r => { sd.onload = r; setTimeout(r, 2000); });
	out.srcdoc = probe(sd.contentWindow);
	const w = window.open("", "_blank"); out.popup = w ? probe(w) : "null"; try { w && w.close(); } catch (e) {}
	out.errs = errs;
	assertConsistent("ttframes", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-ttframes-nodefault",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js(false)}</script></body>`,
			},
			"/pic.png": {
				body: "",
				type: "image/png",
			},
		},
	}),
	hdrTest({
		name: "rv25-ttframes-control",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js(true, false)}</script></body>`,
			},
			"/pic.png": {
				body: "",
				type: "image/png",
			},
		},
	}),
	hdrTest({
		name: "rv25-ttframes-default",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js(true)}</script></body>`,
			},
			"/pic.png": {
				body: "",
				type: "image/png",
			},
		},
	}),
];
