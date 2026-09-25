import { hdrTest } from "./nonce.ts";

const js = `
runTest(async () => {
	const out = {};
	const r = (el) => ({ csp: el.csp, cspA: el.getAttribute("csp"), cl: el.credentialless, clA: el.getAttribute("credentialless"), sb: String(el.sandbox), sbA: el.getAttribute("sandbox"), rp: el.referrerPolicy, rpA: el.getAttribute("referrerpolicy"), allow: el.allow, has: ["csp","credentialless","sandbox","referrerpolicy"].map(n => el.hasAttribute(n)), html: el.outerHTML.replace(/ name="[^"]*"/, "") });
	const p = document.getElementById("p"); out.parsed = r(p);
	const f = document.createElement("iframe"); f.csp = "script-src 'none'"; f.credentialless = true; f.sandbox = "allow-scripts"; f.referrerPolicy = "no-referrer"; out.idl = r(f);
	const g = document.createElement("iframe"); g.setAttribute("csp", "img-src 'none'"); g.setAttribute("credentialless", ""); out.attr = r(g);
	g.removeAttribute("credentialless"); g.csp = ""; out.removed = r(g);
	const d = document.createElement("div"); d.innerHTML = '<iframe csp="default-src \\'self\\'" credentialless sandbox="allow-same-origin"></iframe>'; out.ih = r(d.firstChild);
	out.clone = r(p.cloneNode());
	out.sel = [document.querySelectorAll("iframe[csp]").length, document.querySelectorAll("iframe[credentialless]").length, p.matches("[csp^=script]")];
	const s = document.getElementById("s"); out.script = { integrity: s.integrity, iA: s.getAttribute("integrity"), co: s.crossOrigin, rp: s.referrerPolicy, html: s.outerHTML };
	out.anon = window.__anonCheck;
	assertConsistent("stripped", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-stripped-attrs",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><iframe id="p" csp="script-src 'none'" credentialless sandbox="allow-scripts allow-same-origin" referrerpolicy="origin" allow="camera"></iframe><script id="s" src="/ok.js" integrity="sha384-abc" crossorigin="anonymous" referrerpolicy="no-referrer"></script><script>${js}</script></body>`,
			},
			"/ok.js": {
				body: "window.__anonCheck = 1",
				type: "text/javascript",
				headers: {
					"access-control-allow-origin": "*",
				},
			},
		},
	}),
];
