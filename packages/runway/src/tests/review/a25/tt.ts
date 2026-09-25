import { hdrTest } from "./nonce.ts";

const page = (head: string, body: string) =>
	`<!DOCTYPE html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

// mode: "none" (no enforcement), "meta" (dynamic meta enforce), "metadefault" (dynamic meta + default policy), "hdr" (header)
const ttJs = (mode: string) => `
runTest(async () => {
	const out = {};
	const seen = [];
	const pol = trustedTypes.createPolicy("app", { createHTML: s => s, createScript: s => s, createScriptURL: s => s });
	if (${JSON.stringify(mode)} === "metadefault") {
		trustedTypes.createPolicy("default", {
			createHTML: (s, t, sink) => { seen.push(["H", sink, String(s).slice(0, 120)]); return s; },
			createScript: (s, t, sink) => { seen.push(["S", sink, String(s).slice(0, 120)]); return s; },
			createScriptURL: (s, t, sink) => { seen.push(["U", sink, String(s).slice(0, 120)]); return s; },
		});
	}
	if (${JSON.stringify(mode)}.startsWith("meta")) {
		const m = document.createElement("meta");
		m.httpEquiv = "Content-Security-Policy";
		m.content = "require-trusted-types-for 'script'";
		document.head.appendChild(m);
	}
	const errs = [];
	window.addEventListener("securitypolicyviolation", e => errs.push([e.violatedDirective, e.blockedURI, (e.sample||"").slice(0,60)]));
	const tryit = (k, f) => { try { const r = f(); out[k] = r === undefined ? "ok" : r; } catch (e) { out[k] = "ERR " + e.name + ": " + String(e.message).slice(0, 90); } };
	const H = x => pol.createHTML(x), S = x => pol.createScript(x), U = x => pol.createScriptURL(x);
	const div = () => { const d = document.createElement("div"); document.body.append(d); return d; };
	for (const [tag, wrap] of [["T", true], ["s", false]]) {
		const h = x => wrap ? H(x) : x, sc = x => wrap ? S(x) : x, u = x => wrap ? U(x) : x;
		tryit(tag + "innerHTML", () => { const d = div(); d.innerHTML = h('<b title="t">x</b><img src="/a.png">'); return d.innerHTML; });
		tryit(tag + "outerHTML", () => { const d = div(); const c = document.createElement("i"); d.append(c); c.outerHTML = h("<u>o</u>"); return d.innerHTML; });
		tryit(tag + "insertAdjacentHTML", () => { const d = div(); d.insertAdjacentHTML("beforeend", h("<a href='/q'>q</a>")); return d.innerHTML; });
		tryit(tag + "setHTMLUnsafe", () => { const d = div(); d.setHTMLUnsafe(h("<p>u</p>")); return d.innerHTML; });
		tryit(tag + "shadowInnerHTML", () => { const d = div(); const sr = d.attachShadow({mode:"open"}); sr.innerHTML = h("<p>s</p>"); return sr.innerHTML; });
		tryit(tag + "DOMParser", () => new DOMParser().parseFromString(h("<p>dp</p>"), "text/html").body.innerHTML);
		tryit(tag + "createContextualFragment", () => { const r = document.createRange(); r.selectNode(document.body); return r.createContextualFragment(h("<p>cf</p>")).childNodes.length; });
		tryit(tag + "parseHTMLUnsafe", () => Document.parseHTMLUnsafe(h("<p>ph</p>")).body.innerHTML);
		tryit(tag + "srcdoc", () => { const f = document.createElement("iframe"); f.srcdoc = h("<p>sd</p>"); return f.srcdoc; });
		tryit(tag + "setAttrSrcdoc", () => { const f = document.createElement("iframe"); f.setAttribute("srcdoc", h("<p>sd</p>")); return f.getAttribute("srcdoc"); });
		tryit(tag + "scriptText", () => { const s = document.createElement("script"); s.text = sc("window.__t1=1"); document.head.append(s); return [s.text, window.__t1]; });
		tryit(tag + "scriptTextContent", () => { const s = document.createElement("script"); s.textContent = sc("window.__t2=2"); document.head.append(s); return [s.textContent, window.__t2]; });
		tryit(tag + "scriptInnerText", () => { const s = document.createElement("script"); s.innerText = sc("window.__t3=3"); document.head.append(s); return [s.innerText, window.__t3]; });
		tryit(tag + "scriptAppendText", () => { const s = document.createElement("script"); s.append(document.createTextNode("window.__t4=4")); document.head.append(s); return window.__t4; });
		tryit(tag + "scriptSrc", () => { const s = document.createElement("script"); s.src = u("/x.js?" + tag); return s.src.replace(/:\\d+/, ""); });
		tryit(tag + "scriptSetAttrSrc", () => { const s = document.createElement("script"); s.setAttribute("src", u("/y.js")); return s.getAttribute("src"); });
		tryit(tag + "setAttrOnclick", () => { const b = document.createElement("button"); b.setAttribute("onclick", sc("window.__oc=1")); b.click(); return window.__oc; });
		tryit(tag + "eval", () => eval(sc("1+1")));
		tryit(tag + "indirectEval", () => (0, eval)(sc("2+2")));
		tryit(tag + "Function", () => new Function(sc("return 3"))());
		tryit(tag + "setTimeout", () => { setTimeout(sc("window.__st" + tag + "=1"), 0); return "queued"; });
		tryit(tag + "Worker", () => { const w = new Worker(u("/w.js")); w.terminate(); return "ok"; });
		tryit(tag + "iframeSrcJs", () => { const f = document.createElement("iframe"); f.src = "javascript:1"; return "ok"; });
		tryit(tag + "embedSrc", () => { const e = document.createElement("embed"); e.src = u("/e"); return e.getAttribute("src"); });
		tryit(tag + "docWrite", () => { const f = document.createElement("iframe"); document.body.append(f); f.contentDocument.open(); f.contentDocument.write(h("<p>dw</p>")); f.contentDocument.close(); return f.contentDocument.body.innerHTML; });
		tryit(tag + "attrValue", () => { const s = document.createElement("script"); s.setAttribute("src", u("/z.js")); s.getAttributeNode("src").value = u("/zz.js"); return s.getAttribute("src"); });
		tryit(tag + "setAttributeNS", () => { const s = document.createElement("script"); s.setAttributeNS(null, "src", u("/ns.js")); return s.getAttribute("src"); });
	}
	await new Promise(r => setTimeout(r, 100));
	out.stT = window.__stT; out.sts = window.__sts;
	out.isHTML = trustedTypes.isHTML(H("x"));
	out.getAttributeType = trustedTypes.getAttributeType("script", "src");
	out.getPropertyType = trustedTypes.getPropertyType("div", "innerHTML");
	out.defaultPolicy = trustedTypes.defaultPolicy && trustedTypes.defaultPolicy.name;
	out.seen = seen;
	out.violations = errs;
	assertConsistent("tt", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

const routes = (mode: string, headers: Record<string, string> = {}) => ({
	"/": {
		headers,
		body: page("", `<script>${ttJs(mode)}</script>`),
	},
	"/w.js": {
		body: "1",
		type: "text/javascript",
	},
	"/x.js": {
		body: "1",
		type: "text/javascript",
	},
	"/y.js": {
		body: "1",
		type: "text/javascript",
	},
	"/a.png": {
		body: "",
		type: "image/png",
	},
});

export default [
	hdrTest({
		name: "rv25-tt-none",
		routes: routes("none"),
	}),
	hdrTest({
		name: "rv25-tt-meta",
		routes: routes("meta"),
	}),
	hdrTest({
		name: "rv25-tt-metadefault",
		routes: routes("metadefault"),
	}),
	hdrTest({
		name: "rv25-tt-hdr",
		routes: routes("hdr", {
			"content-security-policy": "require-trusted-types-for 'script'",
		}),
	}),
];
