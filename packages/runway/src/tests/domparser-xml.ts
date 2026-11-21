import { basicTest } from "../testcommon.ts";

// XML through DOMParser: the rewriter parses and re-serializes it, which has
// to give the browser back a document it parses the same way

const X_ATOM =
	'<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A &amp; B</title><link rel="alternate" href="https://ex.test/post"/></feed>';
const X_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><path d="M0 0L24 24" fill="url(#g)"/><use xlink:href="#p"/><image href="/i.png"/><style>.a{fill:red}</style><script>var q=1;</script></svg>';

const err = (x: string, mime: string) =>
	`(() => { const d = new DOMParser().parseFromString(${JSON.stringify(x)}, ${JSON.stringify(mime)}); const e = d.querySelector("parsererror"); return e ? "PARSERERROR: " + e.textContent : "ok:" + d.documentElement.nodeName; })()`;

export default [
	basicTest({
		name: "domparser-xml-jquery-parsexml",
		js: `
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
			let r;
			try { const x = jQuery.parseXML('<?xml version="1.0" encoding="UTF-8"?><response><status>ok</status><item id="1"/></response>'); r = "ok:" + jQuery(x).find("status").text(); } catch (e) { r = "THREW " + e.message; }
			assertEqual(r, "ok:ok", "jQuery.parseXML of an XML API response");
		`,
	}),
	basicTest({
		name: "domparser-xml-domparser-declaration",
		js: `
			const r = ${err(X_ATOM, "application/xml")};
			assert(r.startsWith("ok:"), "atom feed with <?xml?> declaration fails to parse: " + r);
		`,
	}),
	basicTest({
		name: "domparser-xml-domparser-svg-icon",
		js: `
			const r = ${err(X_SVG, "image/svg+xml")};
			assert(r.startsWith("ok:"), "svg icon fails to parse: " + r);
		`,
	}),
	basicTest({
		name: "domparser-xml-malformed-reports-parsererror",
		js: `
			const r = ${err("<a><b></a>", "text/xml")};
			assertConsistent("malformed", r.startsWith("PARSERERROR"));
		`,
	}),
];
