import { basicTest } from "../../../testcommon.ts";

const probe = (name: string, js: string) =>
	basicTest({
		name: `rv2-cons3-${name}`,
		js: `
			const R = {};
			const rec = async (k, f) => { try { R[k] = await f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message; } };
			${js}
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" || typeof R[k] === "number" || typeof R[k] === "boolean" || R[k] === null ? R[k] : JSON.stringify(R[k]));
		`,
	});

export default [
	probe(
		"rcdata",
		`
		for (const tag of ["textarea", "title", "noscript", "xmp", "iframe", "noembed", "noframes", "option"]) {
			const el = document.createElement(tag);
			await rec(tag + " set", () => { el.innerHTML = "<a href='/x'>&lt;b&gt; &amp;</a><img src=/i.png>"; return [el.innerHTML, el.textContent, el.childNodes.length, tag === "textarea" ? el.value : ""]; });
		}
		`
	),
	probe(
		"sandbox",
		`
		const f = document.createElement("iframe");
		await rec("empty", () => [f.sandbox.length, f.sandbox.value, f.getAttribute("sandbox")]);
		f.setAttribute("sandbox", "allow-scripts allow-forms");
		await rec("set", () => [f.sandbox.length, f.sandbox.value, f.sandbox.contains("allow-forms"), f.getAttribute("sandbox"), f.hasAttribute("sandbox")]);
		f.sandbox.add("allow-popups");
		await rec("add", () => [f.sandbox.value, f.getAttribute("sandbox")]);
		f.sandbox = "allow-same-origin";
		await rec("assign", () => [f.sandbox.value, f.getAttribute("sandbox")]);
		f.removeAttribute("sandbox");
		await rec("remove", () => [f.sandbox.value, f.getAttribute("sandbox"), f.sandbox.length]);
		await rec("supports", () => f.sandbox.supports("allow-scripts"));
		const g = document.createElement("div");
		g.innerHTML = "<iframe sandbox='allow-scripts'></iframe>";
		await rec("parsed", () => [g.firstChild.sandbox.value, g.firstChild.getAttribute("sandbox"), g.innerHTML]);
		const l = document.createElement("div");
		l.classList.add("a"); l.classList.toggle("b"); l.classList.replace("a", "c"); l.classList.remove("b");
		await rec("classList", () => [l.className, l.classList.value]);
		const rl = document.createElement("link"); rl.relList.add("preload");
		await rec("relList", () => rl.rel);
		`
	),
	probe(
		"meta-script-type",
		`
		const m = document.createElement("meta");
		m.setAttribute("content", "0;url=/r");
		m.setAttribute("http-equiv", "refresh");
		await rec("meta", () => [m.content, m.getAttribute("content"), m.httpEquiv, m.outerHTML]);
		const m2 = document.createElement("meta");
		m2.name = "description"; m2.content = "hello";
		await rec("meta2", () => [m2.content, m2.getAttribute("content"), m2.getAttributeNames()]);
		window.__st = [];
		const s = document.createElement("script");
		s.textContent = "export const x = 1; window.__st.push(typeof import.meta);";
		s.type = "module";
		document.head.appendChild(s);
		await new Promise(r => setTimeout(r, 300));
		await rec("module after type", () => [window.__st, s.type, s.getAttributeNames(), s.textContent]);
		const s2 = document.createElement("script");
		s2.src = "/x.js";
		s2.type = "text/javascript";
		await rec("names", () => [s2.getAttributeNames(), s2.attributes.length, s2.outerHTML, s2.hasAttributes()]);
		const s3 = document.createElement("script");
		s3.type = "text/plain";
		s3.text = "a < b";
		s3.type = "";
		await rec("retype", () => [s3.text, s3.textContent]);
		`
	),
	probe(
		"range-select",
		`
		const p = document.createElement("p");
		p.innerHTML = "Hello <b>world</b> <a href='/x'>link</a>";
		document.body.appendChild(p);
		const r = document.createRange();
		r.selectNodeContents(p);
		await rec("range", () => [r.toString(), r.startOffset, r.endOffset]);
		const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
		await rec("sel", () => [sel.toString(), sel.anchorOffset, sel.focusOffset]);
		const frag = r.cloneContents();
		await rec("clone", () => frag.querySelector("a").getAttribute("href") + "|" + frag.querySelector("a").href);
		const s = document.createElement("script");
		s.type = "text/plain";
		s.textContent = "abc def";
		document.body.appendChild(s);
		const r2 = document.createRange(); r2.setStart(s.firstChild, 2); r2.setEnd(s.firstChild, 5);
		await rec("script range", () => [r2.toString(), r2.startOffset, r2.endOffset]);
		const sr = new StaticRange({ startContainer: p.firstChild, startOffset: 1, endContainer: p.firstChild, endOffset: 3 });
		await rec("static", () => [sr.startOffset, sr.endOffset]);
		`
	),
	probe(
		"text-edits",
		`
		const p = document.createElement("div");
		p.contentEditable = "true";
		document.body.appendChild(p);
		p.textContent = "abc";
		const t = p.firstChild;
		t.insertData(1, "X"); t.deleteData(0, 1); t.replaceData(0, 1, "YY");
		await rec("edits", () => [t.data, t.length, p.textContent]);
		const t2 = t.splitText(2);
		await rec("split", () => [t.data, t2.data, p.childNodes.length, t.wholeText]);
		p.normalize();
		await rec("normalize", () => [p.childNodes.length, p.firstChild.data]);
		await rec("substring", () => t.substringData(0, 2));
		await rec("oob", () => t.substringData(99, 1));
		p.innerText = "line1\\nline2";
		await rec("innerText", () => [p.innerHTML, p.innerText, p.outerText]);
		const c = document.createComment("<a href='/x'>");
		p.appendChild(c);
		await rec("comment", () => [c.data, c.nodeValue, c.textContent, p.innerHTML]);
		const cd = document.createElement("div");
		cd.append("a", document.createElement("br"), "b");
		cd.prepend("0"); cd.lastChild.after("c"); cd.firstChild.before("-"); cd.childNodes[1].replaceWith("R");
		await rec("childnode", () => [cd.innerHTML, cd.childNodes.length]);
		cd.replaceChildren("x", "y");
		await rec("replaceChildren", () => cd.innerHTML);
		await rec("appendChild str", () => { cd.appendChild("str"); return "noerr"; });
		await rec("appendChild null", () => { cd.appendChild(null); return "noerr"; });
		await rec("insertBefore bad", () => { cd.insertBefore(document.createElement("i"), document.body); return "noerr"; });
		await rec("removeChild bad", () => { cd.removeChild(document.body); return "noerr"; });
		await rec("append doc", () => { cd.append(document); return "noerr"; });
		`
	),
];
