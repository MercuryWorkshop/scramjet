import { basicTest } from "../../../testcommon.ts";

const X_ATOM =
	'<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A &amp; B</title><link rel="alternate" href="https://ex.test/post"/></feed>';
const X_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><path d="M0 0L24 24" fill="url(#g)"/><use xlink:href="#p"/><image href="/i.png"/><style>.a{fill:red}</style><script>var q=1;</script></svg>';

const err = (x: string, mime: string) =>
	`(() => { const d = new DOMParser().parseFromString(${JSON.stringify(x)}, ${JSON.stringify(mime)}); const e = d.querySelector("parsererror"); return e ? "PARSERERROR: " + e.textContent : "ok:" + d.documentElement.nodeName; })()`;

export default [
	basicTest({
		name: "rv2-xml-jquery-parsexml",
		js: `
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
			let r;
			try { const x = jQuery.parseXML('<?xml version="1.0" encoding="UTF-8"?><response><status>ok</status><item id="1"/></response>'); r = "ok:" + jQuery(x).find("status").text(); } catch (e) { r = "THREW " + e.message; }
			assertEqual(r, "ok:ok", "jQuery.parseXML of an XML API response");
		`,
	}),
	basicTest({
		name: "rv2-xml-domparser-declaration",
		js: `
			const r = ${err(X_ATOM, "application/xml")};
			assert(r.startsWith("ok:"), "atom feed with <?xml?> declaration fails to parse: " + r);
		`,
	}),
	basicTest({
		name: "rv2-xml-domparser-svg-icon",
		js: `
			const r = ${err(X_SVG, "image/svg+xml")};
			assert(r.startsWith("ok:"), "svg icon fails to parse: " + r);
		`,
	}),
	basicTest({
		name: "rv2-xml-domparser-svg-simple",
		js: `
			const cases = [
				'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><linearGradient id="a"/></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:red}</style></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><script>var q=1;</script></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><script>if (a < b) {}</script></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><style><![CDATA[ .a > .b {fill:red} ]]></style></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#p"/></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><image href="/i.png"/></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><text>a &amp; b &#169;</text></svg>',
				'<svg xmlns="http://www.w3.org/2000/svg"><!-- c --><g/></svg>',
				'<?xml version="1.0"?><r/>',
				'<?xml version="1.0" encoding="utf-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>',
				'<r><![CDATA[ <b> & ]]></r>',
				'<r a="1" A="2"/>',
				'<r><p:x xmlns:p="urn:p" p:src="/a"/></r>',
				'<r>&nbsp;</r>',
			];
			const out = [];
			for (const c of cases) {
				const d = new DOMParser().parseFromString(c, "image/svg+xml");
				const e = d.querySelector("parsererror");
				out.push((e ? "ERR " + e.textContent.split("\\n")[1] : "ok " + new XMLSerializer().serializeToString(d)));
			}
			for (let i = 0; i < out.length; i++) assertConsistent("case" + i, out[i]);
		`,
	}),
];
