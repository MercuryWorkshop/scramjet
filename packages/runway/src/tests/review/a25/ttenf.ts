import { hdrTest } from "./nonce.ts";

// Page enforces Trusted Types with a CSP <meta> it inserts itself (the one way page CSP is live under the
// proxy) and uses Trusted Types correctly. Every sink below works in Chrome.
const js = (withDefault: boolean) => `
runTest(async () => {
	const pol = trustedTypes.createPolicy("app", { createHTML: s => s, createScript: s => s, createScriptURL: s => s });
	const seen = [];
	${withDefault ? `trustedTypes.createPolicy("default", { createScript: (s, t, sink) => { seen.push(sink + "|" + s); return s; }, createHTML: s => s, createScriptURL: s => s });` : ""}
	const m = document.createElement("meta"); m.httpEquiv = "Content-Security-Policy"; m.content = "require-trusted-types-for 'script'"; document.head.appendChild(m);
	const out = {};
	const tryit = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = "ERR " + e.name + ": " + String(e.message).slice(0, 70); } };
	tryit("scriptText", () => { const s = document.createElement("script"); s.text = pol.createScript("window.__a = 1"); document.head.append(s); return window.__a; });
	tryit("scriptTextContent", () => { const s = document.createElement("script"); s.textContent = pol.createScript("window.__b = 2"); document.head.append(s); return window.__b; });
	tryit("shadowInnerHTML", () => { const d = document.createElement("div"); d.attachShadow({ mode: "open" }).innerHTML = pol.createHTML("<p>s</p>"); return d.shadowRoot.innerHTML; });
	tryit("shadowSetHTMLUnsafe", () => { const d = document.createElement("div"); d.attachShadow({ mode: "open" }).setHTMLUnsafe(pol.createHTML("<p>s</p>")); return d.shadowRoot.innerHTML; });
	tryit("parseHTMLUnsafe", () => Document.parseHTMLUnsafe(pol.createHTML("<p>p</p>")).body.innerHTML);
	tryit("inlineHandler", () => { const b = document.createElement("button"); b.setAttribute("onclick", pol.createScript("window.__c = 3")); b.click(); return window.__c; });
	tryit("setTimeoutTS", () => { setTimeout(pol.createScript("window.__d = 4"), 0); return "queued"; });
	await new Promise(r => setTimeout(r, 50));
	out.setTimeoutRan = window.__d;
	tryit("evalTS", () => eval(pol.createScript("5")));
	out.seen = seen;
	assertConsistent("ttenf", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-ttenf-nodefault",
		routes: {
			"/": {
				body: `<!DOCTYPE html><script>${js(false)}</script>`,
			},
		},
	}),
	hdrTest({
		name: "rv25-ttenf-default",
		routes: {
			"/": {
				body: `<!DOCTYPE html><script>${js(true)}</script>`,
			},
		},
	}),
];
