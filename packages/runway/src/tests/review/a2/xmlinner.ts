import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-xml-innerhtml",
		js: `
			const R = {};
			const rec = (k, f) => { try { R[k] = f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message.slice(0, 120); } };
			const doc = document.implementation.createDocument(null, "root", null);
			rec("xml set", () => { doc.documentElement.innerHTML = "<item a='1'/><Camel/><br/><img src='/x.png'/>"; return new XMLSerializer().serializeToString(doc); });
			rec("xml get", () => doc.documentElement.innerHTML);
			const svgdoc = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
			rec("svg set", () => { svgdoc.documentElement.innerHTML = "<circle r='1'/><use href='#a'/>"; return svgdoc.documentElement.innerHTML; });
			const x2 = document.implementation.createDocument(null, "r", null);
			const el = x2.createElement("Item");
			rec("xml setAttribute", () => { el.setAttribute("Src", "/a"); el.setAttribute("href", "/b"); return [el.getAttribute("Src"), el.getAttribute("src"), el.getAttributeNames(), new XMLSerializer().serializeToString(el)]; });
			rec("xml insertAdjacentHTML", () => { x2.documentElement.insertAdjacentHTML("beforeend", "<a><b/></a>"); return new XMLSerializer().serializeToString(x2); });
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" ? R[k] : JSON.stringify(R[k]));
		`,
	}),
];
