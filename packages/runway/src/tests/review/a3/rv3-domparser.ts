import { basicTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + e.message; } assertConsistent(label, v); };
const perr = (d) => d.getElementsByTagName("parsererror").length;`;

export default [
	basicTest({
		name: "rv3-domparser-xml",
		js: `${C}
const p = new DOMParser();
// RSS / SOAP / generic XML with an XML declaration - jQuery.parseXML, feed readers
const rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>T &amp; U</title><item><link>https://example.com/i</link></item></channel></rss>';
const d1 = p.parseFromString(rss, "text/xml");
c("rss.perr", () => perr(d1));
c("rss.root", () => d1.documentElement.nodeName);
c("rss.title", () => d1.querySelector("title") && d1.querySelector("title").textContent);
const d1b = p.parseFromString(rss, "application/xml");
c("rss.appxml.perr", () => perr(d1b));
// Atom: <link href> is an XML element that happens to be named link
const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><link rel="alternate" href="https://example.com/post?a=1&amp;b=2"/></entry></feed>';
const d2 = p.parseFromString(atom, "application/xml");
c("atom.perr", () => perr(d2));
c("atom.href", () => d2.querySelector("link").getAttribute("href"));
c("atom.attrs", () => Array.from(d2.querySelector("link").attributes).map(a => a.name).join(","));
c("atom.serialize", () => new XMLSerializer().serializeToString(d2));
// SVG icon from a file (Illustrator export): declaration + doctype
const svg = '<?xml version="1.0" encoding="utf-8"?>\\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="fill:red"><path d="M0 0h24"/></svg>';
const d3 = p.parseFromString(svg, "image/svg+xml");
c("svg.perr", () => perr(d3));
c("svg.root", () => d3.documentElement.nodeName);
c("svg.viewBox", () => d3.documentElement.getAttribute("viewBox"));
c("svg.outer", () => d3.documentElement.outerHTML);
// internal DTD subset and entity reference
const dtd = '<?xml version="1.0"?><!DOCTYPE note [<!ENTITY w "Donald">]><note><to>&w;</to></note>';
const d4 = p.parseFromString(dtd, "text/xml");
c("dtd.perr", () => perr(d4));
c("dtd.to", () => d4.querySelector("to") && d4.querySelector("to").textContent);
// malformed XML must still report an error
const d5 = p.parseFromString('<root><a>unclosed<b></a></root>', "text/xml");
c("malformed.perr", () => perr(d5) > 0);
// processing instruction
const d6 = p.parseFromString('<?xml-stylesheet type="text/xsl" href="s.xsl"?><r/>', "text/xml");
c("pi.perr", () => perr(d6));
c("pi.first", () => d6.firstChild && d6.firstChild.nodeName + "|" + d6.firstChild.data);
// case-sensitive names and attributes, CDATA
const d7 = p.parseFromString('<Root CaseAttr="1"><Child/><![CDATA[a<b]]></Root>', "text/xml");
c("case", () => d7.documentElement.nodeName + " " + d7.documentElement.getAttribute("CaseAttr") + " " + d7.documentElement.firstChild.nodeName + " " + d7.documentElement.lastChild.nodeType);
// XHTML
const d8 = p.parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>x</p></body></html>', "application/xhtml+xml");
c("xhtml.perr", () => perr(d8));
c("xhtml.body", () => d8.body && d8.body.innerHTML);
`,
	}),
	basicTest({
		name: "rv3-domparser-html",
		js: `${C}
const p = new DOMParser();
const d = p.parseFromString('<!doctype html><title>t</title><noscript><p id=n>n</p></noscript><a id=a href="/x?a=1&amp;b=2">a</a><template id=t><b>x</b></template>', "text/html");
c("ns", () => d.getElementById("n") ? d.getElementById("n").outerHTML : null);
c("a", () => d.getElementById("a").getAttribute("href"));
c("tpl", () => d.getElementById("t").innerHTML);
c("compat", () => d.compatMode);
const q = p.parseFromString('<p>quirks</p>', "text/html");
c("quirks", () => q.compatMode);
`,
	}),
];
