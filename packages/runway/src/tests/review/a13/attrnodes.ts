import { htmlTest } from "../../../testcommon.ts";

// Attr nodes leaving their element by copy rather than removal (cloneNode,
// importNode, adoptNode), attribute-copy idioms, isEqualNode, and the style
// mirror after a CSSOM write.

const T = String.raw`const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };`;

export default [
	htmlTest({
		name: "rv13-attrnodes",
		html: `<!doctype html><body>
<a id=pa href="/p/a" target="_top" style="background: url(/bg.png)" onclick="f()">a</a>
<img id=pi src="/p/i.png" srcset="/p/i.png 1x">
<div id=pn nonce="abc"></div>
<iframe id=pf sandbox="allow-scripts"></iframe>
<script>${T}
function f() {}
runTest(async () => {
	const pa = document.getElementById("pa"), pi = document.getElementById("pi"), pn = document.getElementById("pn"), pf = document.getElementById("pf");
	const describe = (a) => a ? [a.name, a.value, a.nodeValue, a.textContent, a.ownerElement === null].join("|") : "none";
	for (const [label, el, name] of [["a.href", pa, "href"], ["a.target", pa, "target"], ["a.style", pa, "style"], ["a.onclick", pa, "onclick"], ["img.src", pi, "src"], ["img.srcset", pi, "srcset"], ["div.nonce", pn, "nonce"], ["iframe.sandbox", pf, "sandbox"]]) {
		const node = el.getAttributeNode(name);
		assertConsistent(label + " cloneNode", T(() => describe(node.cloneNode())));
		assertConsistent(label + " cloneNode(true)", T(() => describe(node.cloneNode(true))));
		assertConsistent(label + " importNode", T(() => describe(document.importNode(node))));
		assertConsistent(label + " importNode other doc", T(() => describe(document.implementation.createHTMLDocument("").importNode(node))));
		assertConsistent(label + " isEqualNode", T(() => { const c = document.createElement(el.localName); c.setAttribute(name, el.getAttribute(name)); return node.isEqualNode(c.getAttributeNode(name)); }));
		// the attribute-copy idiom
		assertConsistent(label + " copy via clone", T(() => { const c = document.createElement(el.localName); c.setAttributeNode(node.cloneNode()); return [c.getAttribute(name), c.getAttributeNames().join(), c.outerHTML].join(" | "); }));
		assertConsistent(label + " copy via setAttribute", T(() => { const c = document.createElement(el.localName); for (const at of el.attributes) c.setAttribute(at.name, at.value); return [c.getAttribute(name), c.getAttributeNames().join(), c.outerHTML].join(" | "); }));
		assertConsistent(label + " copy via NS", T(() => { const c = document.createElement(el.localName); for (const at of el.attributes) c.setAttributeNS(at.namespaceURI, at.name, at.value); return [c.getAttribute(name), c.getAttributeNames().join()].join(" | "); }));
		assertConsistent(label + " element isEqualNode", T(() => { const c = document.createElement(el.localName); for (const at of el.attributes) c.setAttribute(at.name, at.value); c.textContent = el.textContent; return el.isEqualNode(c); }));
	}
	// adopting the attribute node itself into another document
	const other = document.implementation.createHTMLDocument("");
	const ad = pi.cloneNode().getAttributeNode("src");
	assertConsistent("adoptNode attached attr", T(() => describe(other.adoptNode(ad))));
	// adoptNode of an attribute that is still attached detaches it from its element
	for (const [label, mk, name] of [["img.src", () => { const e = document.createElement("img"); e.setAttribute("src", "/q.png"); return e; }, "src"], ["a.href", () => { const e = document.createElement("a"); e.setAttribute("href", "/q"); return e; }, "href"], ["div.style", () => { const e = document.createElement("div"); e.setAttribute("style", "color: red"); return e; }, "style"], ["div.nonce", () => { const e = document.createElement("div"); e.setAttribute("nonce", "n1"); return e; }, "nonce"], ["div.title", () => { const e = document.createElement("div"); e.setAttribute("title", "t"); return e; }, "title"]]) {
		for (const where of ["same", "other"]) {
			const el = mk(); document.body.append(el);
			const at = el.getAttributeNode(name);
			const d = where === "same" ? document : document.implementation.createHTMLDocument("");
			const res = T(() => describe(d.adoptNode(at)));
			assertConsistent("adopt " + where + " " + label, [res, T(() => el.getAttribute(name)), T(() => el.hasAttribute(name)), T(() => el.getAttributeNames().join()), T(() => el.outerHTML), T(() => el.matches("[" + name + "]"))].join(" | "));
		}
	}
	// style mirror after CSSOM writes
	const s = document.createElement("div");
	s.setAttribute("style", "background-image: url(/a.png)");
	s.style.color = "red";
	assertConsistent("style after cssom", T(() => [s.getAttribute("style"), s.outerHTML, s.matches('[style*="/a.png"]'), s.matches('[style*="localhost"]')].join(" | ")));
	const s2 = document.createElement("div");
	s2.style.backgroundImage = "url(img/b.png)";
	assertConsistent("style set by cssom only", T(() => [s2.getAttribute("style"), s2.outerHTML].join(" | ")));
	s2.style.removeProperty("background-image");
	assertConsistent("style cssom removed", T(() => [s2.getAttribute("style"), s2.hasAttribute("style"), s2.outerHTML].join(" | ")));
	const s3 = document.createElement("div");
	s3.setAttribute("style", "color: red");
	s3.style.cssText = "";
	assertConsistent("style cssText empty", T(() => [s3.getAttribute("style"), s3.hasAttribute("style"), s3.outerHTML].join(" | ")));
	const s4 = document.createElement("div");
	s4.attributeStyleMap.set("background-image", "url(/tom.png)");
	assertConsistent("style typed om", T(() => [s4.getAttribute("style"), s4.outerHTML].join(" | ")));
}, true);
</script></body>`,
	}),
];
