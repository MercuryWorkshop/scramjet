import { hdrTest } from "./nonce.ts";

const SEC = {
	"content-security-policy": "default-src 'self'; script-src 'nonce-q'",
	"content-security-policy-report-only":
		"img-src 'none'; report-uri /csp-report",
	"cross-origin-opener-policy": "same-origin",
	"cross-origin-embedder-policy": "require-corp",
	"cross-origin-resource-policy": "same-site",
	"permissions-policy": "camera=(), geolocation=(self)",
	"referrer-policy": "strict-origin",
	"x-frame-options": "DENY",
	"x-content-type-options": "nosniff",
	"strict-transport-security": "max-age=100",
	"timing-allow-origin": "*",
	"server-timing": "db;dur=53",
	"access-control-expose-headers": "*",
	"access-control-allow-origin": "*",
	"x-custom": "1",
};

const js = `
runTest(async () => {
	const out = {};
	const r = await fetch("/res.txt");
	out.get = {}; for (const k of ${JSON.stringify(Object.keys(SEC))}) out.get[k] = r.headers.get(k);
	out.keys = [...r.headers.keys()].sort();
	out.hasCarrier = [...r.headers.keys()].filter(k => k.includes("scramjet"));
	const x = new XMLHttpRequest(); x.open("GET", "/res.txt"); await new Promise(res => { x.onload = res; x.send(); });
	out.xhrAll = x.getAllResponseHeaders().split("\\r\\n").map(l => l.split(":")[0]).filter(Boolean).sort();
	out.xhrCsp = x.getResponseHeader("content-security-policy");
	out.xhrPP = x.getResponseHeader("permissions-policy");
	out.xhrRP = x.getResponseHeader("referrer-policy");
	// the document itself, via fetch(location.href)
	const d = await fetch(location.href);
	out.docCsp = d.headers.get("content-security-policy");
	out.docRP = d.headers.get("referrer-policy");
	out.docCoop = d.headers.get("cross-origin-opener-policy");
	// cross-origin: only safelisted + exposed
	const c = await fetch("http://127.0.0.1:" + location.port + "/res.txt");
	out.crossKeys = [...c.headers.keys()].sort();
	// PerformanceResourceTiming.serverTiming
	await new Promise(r => setTimeout(r, 200));
	const e = performance.getEntriesByType("resource").find(e => e.name.includes("res.txt"));
	out.serverTiming = e && e.serverTiming.map(s => s.name + ":" + s.duration);
	out.navServerTiming = performance.getEntriesByType("navigation")[0].serverTiming.map(s => s.name + ":" + s.duration);
	out.coi = self.crossOriginIsolated;
	out.fp = typeof document.featurePolicy;
	out.fpAllows = document.featurePolicy ? ["camera","geolocation","fullscreen","autoplay","payment","clipboard-write"].map(f => f + "=" + document.featurePolicy.allowsFeature(f)) : null;
	assertConsistent("hdrs", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-hdrs-sec",
		routes: {
			"/": {
				headers: {
					...SEC,
					"content-security-policy":
						"script-src 'unsafe-inline' 'unsafe-eval' 'self'",
					"cross-origin-embedder-policy": "unsafe-none",
					"x-frame-options": "ALLOWALL",
					"cross-origin-opener-policy": "unsafe-none",
				},
				body: `<!DOCTYPE html><script>${js}</script>`,
			},
			"/res.txt": {
				headers: SEC,
				body: "hi",
				type: "text/plain",
			},
		},
	}),
];
