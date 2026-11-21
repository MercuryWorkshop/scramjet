import { serverTest } from "../../../testcommon.ts";

// the attribute selectors scripts actually use to find their own tags and links
export default [
	serverTest({
		name: "v3-common-attribute-selectors",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url!.split("?")[0].endsWith(".js")) {
					res.writeHead(200, { "Content-Type": "text/javascript" });
					res.end("");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><html><head>
<link rel="canonical" href="https://example.com/page">
<meta name="description" content="hello world">
<meta http-equiv="refresh" content="999; url=/later">
<script src="/static/sdk.js?v=2" data-key="abc" async></script>
<script src="https://cdn.example.net/lib/widget.min.js"></script>
</head><body>
<a id=a1 href="/about">about</a>
<a id=a2 href="https://other.example/x" target="_blank" rel="noopener">ext</a>
<a id=a3 href="#top">top</a>
<a id=a4 href="mailto:x@y.z">mail</a>
<a id=a5 href="file.PDF">pdf</a>
<img id=i1 src="/img/logo.png" srcset="/img/logo@2x.png 2x">
<iframe id=f1 src="https://www.youtube.com/embed/abc" width=1 height=1></iframe>
<form id=fm action="/search" method=get target="_self"><button formaction="/alt">go</button></form>
<div id=d1 style="display: none; background: url(/bg.png)"></div>
<div id=d2 data-src="/lazy.png"></div>
<script>
runTest(async () => {
	const q = (s) => { try { return [...document.querySelectorAll(s)].map((e) => e.id || e.tagName + (e.getAttribute("src") || e.getAttribute("href") || e.getAttribute("content") || "")).join(","); } catch (e) { return "threw:" + e.name; } };
	const sels = [
		'script[src*="sdk.js"]', 'script[src$="widget.min.js"]', 'script[src^="https://cdn.example.net"]', 'script[src]',
		'a[href^="/"]', 'a[href^="http"]', 'a[href^="#"]', 'a[href^="mailto:"]', 'a[href$=".pdf" i]', 'a[href="/about"]', 'a[target="_blank"]', 'a[href]:not([href^="#"])',
		'link[rel="canonical"][href]', 'meta[name="description"][content]', 'meta[http-equiv="refresh"]', 'meta[content*="url="]',
		'img[src$=".png"]', 'img[srcset*="2x"]', 'iframe[src*="youtube.com/embed"]', 'form[action="/search"]', 'button[formaction]', 'form[target="_self"]',
		'[style*="display: none"]', '[style*="url(/bg.png)"]', '[data-src]', ':is(a, area)[href]', 'body > a[href^="/"], img[src]',
	];
	const out = {};
	for (const s of sels) out[s] = q(s);
	out.closest = document.getElementById("a1").closest('a[href^="/"]')?.id ?? null;
	out.matches = document.getElementById("i1").matches('img[src*="logo"]');
	out.currentScriptLookup = document.querySelector('script[data-key]').src;
	assertConsistent("selectors", out);
}, true);
</script></body></html>`);
			});
		},
	}),
];
