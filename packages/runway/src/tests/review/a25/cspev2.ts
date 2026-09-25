import { hdrTest } from "./nonce.ts";

const js = `
runTest(async () => {
	const out = {};
	out.SPVE = typeof SecurityPolicyViolationEvent;
	out.onspv = "onsecuritypolicyviolation" in document;
	const evs = [];
	document.addEventListener("securitypolicyviolation", e => evs.push({
		isTrusted: e.isTrusted, type: e.type, cls: e.constructor.name, dir: e.violatedDirective, eff: e.effectiveDirective,
		blocked: e.blockedURI, doc: e.documentURI, ref: e.referrer, src: e.sourceFile, orig: e.originalPolicy, disp: e.disposition,
		target: e.target && e.target.nodeName, sample: e.sample, line: e.lineNumber, status: e.statusCode,
		thisOk: this === undefined || true }));
	let onprop = 0; document.onsecuritypolicyviolation = () => onprop++;
	const m = document.createElement("meta"); m.httpEquiv = "Content-Security-Policy"; m.content = "img-src 'none'"; document.head.append(m);
	await new Promise(r => { const i = new Image(); i.onerror = i.onload = r; i.src = "https://example.invalid/x.png?q=1"; document.body.append(i); setTimeout(r, 1500); });
	await new Promise(r => { const s = document.createElement("script"); s.onerror = s.onload = r; s.src = "https://cdn.example.invalid/lib.js"; document.body.append(s); setTimeout(r, 1500); });
	await new Promise(r => setTimeout(r, 300));
	out.evs = evs.map(e => JSON.parse(JSON.stringify(e).replace(/:\\d{4,5}/g, ":P")));
	out.onprop = onprop;
	// synthetic event construction
	try { const e = new SecurityPolicyViolationEvent("securitypolicyviolation", { violatedDirective: "x", effectiveDirective: "x", originalPolicy: "p", disposition: "enforce", statusCode: 0, blockedURI: "https://a.b/c", documentURI: "https://d.e/" }); out.synth = [e.blockedURI, e.documentURI, e.isTrusted]; } catch (err) { out.synth = "ERR " + err.message; }
	// framing detection
	out.topIsSelf = window.top === window.self;
	out.parentIsSelf = window.parent === window;
	out.frameElement = window.frameElement === null ? "null" : typeof window.frameElement;
	out.length = window.length;
	try { out.topHref = typeof top.location.href; } catch (e) { out.topHref = "ERR " + e.name; }
	out.ancestorOrigins = location.ancestorOrigins ? location.ancestorOrigins.length : null;
	assertConsistent("cspev", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-cspev-none",
		routes: {
			"/": {
				body: `<!DOCTYPE html><html><head></head><body><script>${js}</script></body></html>`,
			},
		},
	}),
];
