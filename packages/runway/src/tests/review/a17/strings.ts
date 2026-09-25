import { basicTest } from "../../../testcommon.ts";

// Unusual string *content* (lone surrogates, NUL, BOM, CR) flowing through the
// rewriters behind markup, script and style sinks. Compared with bare Chrome.

export default [
	basicTest({
		name: "rv17-strings-content",
		js: `
			const K = async (k, f) => {
				let v;
				try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
				if (v === undefined) v = "undefined";
				if (typeof v === "string") v = escape(v);
				assertConsistent(k, v);
			};
			const LS = "a\\uD83D" + "b\\uDE00c";   // two lone surrogates
			const PAIR = "\\uD83D\\uDE00";
			const NUL = "x\\u0000y";
			const BOM = "\\uFEFFz";
			const holder = document.createElement("div");
			document.body.append(holder);
			for (const [name, s] of Object.entries({ LS, PAIR, NUL, BOM, LSEP: "p\\u2028q\\u2029r" })) {
				await K(name + ".innerHTML", () => { holder.innerHTML = "<p title='" + s + "'>" + s + "</p>"; return holder.firstChild.textContent + "|" + holder.firstChild.title; });
				await K(name + ".innerHTMLread", () => { holder.innerHTML = "<p>" + s + "</p>"; return holder.innerHTML; });
				await K(name + ".innerHTMLlink", () => { holder.innerHTML = "<a href='/x?" + s + "'>" + s + "</a>"; return holder.firstChild.getAttribute("href") + "|" + holder.firstChild.textContent; });
				await K(name + ".outerHTML", () => { holder.innerHTML = "<i></i>"; holder.firstChild.outerHTML = "<b>" + s + "</b>"; return holder.firstChild.textContent; });
				await K(name + ".insertAdjacentHTML", () => { holder.textContent = ""; holder.insertAdjacentHTML("beforeend", "<u>" + s + "</u>"); return holder.firstChild.textContent; });
				await K(name + ".setHTMLUnsafe", () => { holder.setHTMLUnsafe("<s>" + s + "</s>"); return holder.firstChild.textContent; });
				await K(name + ".range", () => { const r = document.createRange(); r.selectNode(document.body); return r.createContextualFragment("<q>" + s + "</q>").firstChild.textContent; });
				await K(name + ".domparser", () => new DOMParser().parseFromString("<p>" + s + "</p>", "text/html").body.firstChild.textContent);
				await K(name + ".domparserXml", () => { const d = new DOMParser().parseFromString("<r>" + s + "</r>", "application/xml"); return d.documentElement.textContent || d.documentElement.nodeName; });
				await K(name + ".srcdoc", () => { const f = document.createElement("iframe"); f.srcdoc = "<p>" + s + "</p>"; return f.srcdoc + "|" + f.getAttribute("srcdoc"); });
				await K(name + ".docWrite", () => { const f = document.createElement("iframe"); document.body.append(f); const d = f.contentDocument; d.open(); d.write("<p>" + s + "</p>"); d.close(); const r = d.body.firstChild.textContent; f.remove(); return r; });
				await K(name + ".eval", () => eval("'" + s + "'"));
				await K(name + ".evalLen", () => eval("'" + s + "'").length);
				await K(name + ".Function", () => new Function("return '" + s + "'")());
				await K(name + ".scriptText", () => { window.__rvs = null; const sc = document.createElement("script"); sc.textContent = "window.__rvs = '" + s + "'"; document.body.append(sc); sc.remove(); return window.__rvs; });
				await K(name + ".scriptTextRead", () => { const sc = document.createElement("script"); sc.textContent = "void '" + s + "'"; return sc.textContent; });
				await K(name + ".setTimeoutStr", () => new Promise(r => { window.__rvt = null; setTimeout("window.__rvt = '" + s + "'", 0); setTimeout(() => r(window.__rvt), 30); }));
				await K(name + ".onclickAttr", () => { const b = document.createElement("b"); b.setAttribute("onclick", "window.__rvc = '" + s + "'"); b.click(); return window.__rvc + "|" + b.getAttribute("onclick"); });
				await K(name + ".styleText", () => { const st = document.createElement("style"); st.textContent = "b::after{content:'" + s + "'}"; document.head.append(st); const r = st.textContent + "|" + st.sheet.cssRules[0].style.content; st.remove(); return r; });
				await K(name + ".styleAttr", () => { const b = document.createElement("b"); b.setAttribute("style", "font-family:'" + s + "'"); return b.getAttribute("style") + "|" + b.style.fontFamily; });
				await K(name + ".cssom", () => { const b = document.createElement("b"); b.style.fontFamily = "'" + s + "'"; return b.style.fontFamily + "|" + b.getAttribute("style"); });
				await K(name + ".insertRule", () => { const sh = new CSSStyleSheet(); sh.insertRule("b::after{content:'" + s + "'}"); return sh.cssRules[0].style.content; });
				await K(name + ".replaceSync", () => { const sh = new CSSStyleSheet(); sh.replaceSync("b::after{content:'" + s + "'}"); return sh.cssRules[0].style.content; });
				await K(name + ".setAttrHref", () => { const a = document.createElement("a"); a.setAttribute("href", "/p?" + s); return a.getAttribute("href"); });
				await K(name + ".setAttrTitle", () => { const a = document.createElement("a"); a.setAttribute("title", s); return a.getAttribute("title"); });
				await K(name + ".setAttrSrcset", () => { const a = document.createElement("img"); a.setAttribute("srcset", "/i" + s + ".png 1x"); return a.getAttribute("srcset"); });
				await K(name + ".blobScript", async () => { window.__rvb = null; const u = URL.createObjectURL(new Blob(["window.__rvb = '" + s + "'"], { type: "text/javascript" })); const sc = document.createElement("script"); sc.src = u; const p = new Promise(r => { sc.onload = r; sc.onerror = r; }); document.body.append(sc); await p; return window.__rvb; });
				await K(name + ".blobHtmlFrame", async () => { const u = URL.createObjectURL(new Blob(["<p>" + s + "</p>"], { type: "text/html" })); const f = document.createElement("iframe"); f.src = u; const p = new Promise(r => f.onload = r); document.body.append(f); await p; const t = f.contentDocument.body.textContent; f.remove(); return t; });
				await K(name + ".textNodeInScript", () => { const sc = document.createElement("script"); sc.type = "text/x-template"; sc.append(s); document.body.append(sc); const r = sc.text + "|" + sc.innerHTML; sc.remove(); return r; });
				await K(name + ".templateJSON", () => { const sc = document.createElement("script"); sc.type = "application/json"; sc.textContent = JSON.stringify({ s }); document.body.append(sc); const r = JSON.parse(sc.textContent).s; sc.remove(); return r; });
			}
		`,
	}),
];
