import { basicTest } from "../../../testcommon.ts";

// Members that main patched as a shadow on a subclass prototype (Text, Attr)
// and develop patches on the owning ancestor (CharacterData, Node) - so they
// now also run for Comment, ProcessingInstruction, CDATASection, Element,
// Document, DocumentType... Compare every node type against bare Chrome.
// Run WITHOUT RUNWAY_FAST.
export default [
	basicTest({
		name: "rv12-owners",
		js: String.raw`
const R = {};
const T = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + (e && e.constructor && e.constructor.name) + ": " + String(e && e.message).slice(0, 100); } R[label] = v; };
const xml = new DOMParser().parseFromString("<r/>", "application/xml");
const host = document.createElement("div"); document.body.appendChild(host);
const makers = {
  text: () => document.createTextNode("abc"),
  comment: () => document.createComment("abc"),
  pi: () => xml.createProcessingInstruction("t", "abc"),
  cdata: () => xml.createCDATASection("abc"),
  attr: () => { const a = document.createAttribute("title"); a.value = "abc"; return a; },
  el: () => document.createElement("span"),
  frag: () => document.createDocumentFragment(),
  doctype: () => document.implementation.createDocumentType("html", "", ""),
};
const scriptParent = () => { const s = document.createElement("script"); s.type = "text/plain"; return s; };
const styleParent = () => document.createElement("style");
for (const [k, mk] of Object.entries(makers)) {
  T(k + ".nodeValue", () => mk().nodeValue);
  T(k + ".nodeValue=", () => { const n = mk(); n.nodeValue = "u/rl(/x.png)"; return n.nodeValue + "|" + n.textContent; });
  T(k + ".textContent=", () => { const n = mk(); n.textContent = "t"; return n.textContent; });
  T(k + ".nodeName", () => mk().nodeName);
  T(k + ".appendData", () => { const n = mk(); n.appendData("d"); return n.data; });
  T(k + ".insertData", () => { const n = mk(); n.insertData(1, "i"); return n.data; });
  T(k + ".replaceData", () => { const n = mk(); n.replaceData(0, 1, "r"); return n.data; });
  T(k + ".deleteData", () => { const n = mk(); n.deleteData(0, 1); return n.data; });
  T(k + ".substringData", () => mk().substringData(1, 1));
  T(k + ".length", () => mk().length);
  T(k + ".data=", () => { const n = mk(); n.data = "zz"; return n.data + "/" + n.nodeValue; });
  T(k + ".cloneNode", () => { const n = mk(); const c = n.cloneNode(true); return c.nodeName + ":" + c.nodeValue; });
  T(k + ".normalize", () => { const n = mk(); n.normalize(); return "ok"; });
  T(k + ".baseURI", () => { const b = mk().baseURI; return typeof b === "string" ? new URL(b).pathname : b; });
  T(k + ".in-host", () => { const n = mk(); host.textContent = ""; host.appendChild(n); return host.innerHTML; });
  T(k + ".before/after", () => { const p = document.createElement("p"); const n = mk(); p.append(n); n.before("B"); n.after("A"); return p.innerHTML; });
  T(k + ".replaceWith", () => { const p = document.createElement("p"); const n = mk(); p.append(n); n.replaceWith("W"); return p.innerHTML; });
  T(k + ".remove", () => { const p = document.createElement("p"); const n = mk(); p.append(n); n.remove(); return p.childNodes.length; });
  T(k + ".in-script", () => { const s = scriptParent(); const n = mk(); s.appendChild(n); if (n.appendData) n.appendData(" + 1"); return s.text + "|" + s.textContent; });
  T(k + ".in-style", () => { const s = styleParent(); const n = mk(); s.appendChild(n); if (n.appendData) n.appendData(" a{background:url(/q.png)}"); document.head.appendChild(s); const t = s.textContent; s.remove(); return t; });
  T(k + ".splitText", () => { const n = mk(); host.textContent = ""; host.appendChild(n); const r = n.splitText(1); return r.nodeValue + "|" + host.childNodes.length; });
  T(k + ".wholeText", () => { const n = mk(); host.textContent = "x"; host.appendChild(n); return n.wholeText; });
}
T("document.nodeValue", () => document.nodeValue);
T("document.nodeValue=", () => { document.nodeValue = "x"; return document.nodeValue; });
T("document.textContent", () => document.textContent);
T("doctype.textContent", () => document.doctype && document.doctype.textContent);
T("attr in el nodeValue", () => { const e = document.createElement("a"); e.setAttribute("href", "/n"); const at = e.getAttributeNode("href"); at.nodeValue = "/m"; return e.getAttribute("href") + "|" + at.value + "|" + new URL(e.href).pathname; });
T("attr textContent href", () => { const e = document.createElement("a"); e.setAttribute("href", "/n"); const at = e.getAttributeNode("href"); at.textContent = "/tc"; return e.getAttribute("href") + "|" + new URL(e.href).pathname; });
T("comment in script", () => { const s = document.createElement("script"); s.type = "text/plain"; s.appendChild(document.createTextNode("a")); s.appendChild(document.createComment("c")); return s.text + "|" + s.textContent + "|" + s.innerHTML; });
for (const [k, v] of Object.entries(R)) assertConsistent(k, v);
`,
	}),
];
