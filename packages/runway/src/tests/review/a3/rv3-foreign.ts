import { htmlTest } from "../../../testcommon.ts";

const snippets = [
	`<svg><g></p><img src="/fp.png"></svg>`,
	`<svg><g></br><img src="/fbr.png"></svg>`,
	`<math><mi></p><img src="/mp.png"></math>`,
	`<svg><foreignObject><p>x</p><img src="/fo.png"></foreignObject></svg>`,
	`<svg><desc></p><img src="/desc.png"></desc></svg>`,
	`<svg><b>breakout</b><image href="/after.png"/></svg>`,
	`<svg><font color="red">f</font><image href="/f.png"/></svg>`,
	`<svg><title><img src="/title.png"></title></svg>`,
	`<p><svg><style>a{}</style><image href="/s.png"/></svg></p>`,
	`<table><svg><g><td>x</td></g></svg></table>`,
	`<svg><script>var __svgs = 1<2;</script></svg>`,
	`<math><annotation-xml encoding="text/html"><img src="/ax.png"></annotation-xml></math>`,
	`<math><annotation-xml><svg><image href="/axsvg.png"/></svg></annotation-xml></math>`,
	`<svg><![CDATA[<img src="/cdata.png">]]></svg>`,
	`<select><svg><image href="/sel.png"/></svg></select>`,
];

let body = "";
snippets.forEach((s, i) => (body += `<div id="s${i}">${s}</div>\n`));
const js = `<script>runTest(async () => {
  const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.message; } assertConsistent(label, v); };
  const shape = (n) => { if (n.nodeType === 3) return "#" + n.data; if (n.nodeType !== 1) return "?" + n.nodeType; const ns = n.namespaceURI.split("/").pop(); return "<" + ns + ":" + n.localName + [...n.attributes].filter(a => !a.name.startsWith("scramjet")).map(a => " " + a.name).join("") + ">" + [...n.childNodes].map(shape).join("") + "</>"; };
  for (let i = 0; i < ${snippets.length}; i++) c("s" + i, () => [...document.getElementById("s" + i).childNodes].map(shape).join("") + " NEXT:" + (document.getElementById("s" + i).nextElementSibling || {}).id);
  c("svgscript", () => window.__svgs);
  // images that were rewritten load through the proxy; count img/image elements whose effective URL still points at the page's own origin path
}, true);</script>`;

export default [
	htmlTest({
		name: "rv3-foreign-parse",
		html: `<!doctype html><html><body>${body}${js}</body></html>`,
	}),
];
