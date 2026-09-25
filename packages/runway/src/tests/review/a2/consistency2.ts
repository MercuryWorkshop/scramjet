import { basicTest } from "../../../testcommon.ts";

const probe = (name: string, js: string) =>
	basicTest({
		name: `rv2-cons2-${name}`,
		js: `
			const R = {};
			const rec = async (k, f) => { try { R[k] = await f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message; } };
			${js}
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" || typeof R[k] === "number" || typeof R[k] === "boolean" || R[k] === null ? R[k] : JSON.stringify(R[k]));
		`,
	});

export default [
	probe(
		"iframes",
		`
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const d = f.contentDocument;
		await rec("blank url", () => [d.URL, d.baseURI, f.contentWindow.location.href]);
		d.body.innerHTML = "<a href='/in'>x</a><img src='p.png'><script>window.__ifr = location.host + '|' + document.baseURI;<\/script>";
		await rec("blank a", () => [d.querySelector("a").href, d.querySelector("img").src, d.body.innerHTML]);
		const s = d.createElement("script");
		s.textContent = "window.__ifr2 = location.host";
		d.body.appendChild(s);
		await rec("blank script", () => f.contentWindow.__ifr2);
		const a = d.createElement("a"); a.href = "rel";
		await rec("blank rel", () => a.href);
		d.open(); d.write("<a id=w href='/w'>w</a><script>window.__w = document.getElementById('w').href<\/script>"); d.close();
		await rec("written", () => [f.contentWindow.__w, f.contentDocument.getElementById("w").href]);
		const g = document.createElement("iframe");
		g.srcdoc = "<a id=s href='/sd'>s</a><script>window.__sd = document.getElementById('s').href + '|' + document.baseURI + '|' + location.href<\/script>";
		document.body.appendChild(g);
		await new Promise(r => g.onload = r);
		await rec("srcdoc", () => [g.contentWindow.__sd, g.contentDocument.getElementById("s").href, g.srcdoc]);
		const h = document.createElement("iframe");
		h.src = "/sub?x=1";
		document.body.appendChild(h);
		await new Promise(r => h.onload = r);
		await rec("sub", () => [h.src, h.getAttribute("src"), h.contentWindow.location.href, h.contentDocument.URL]);
		// element from another realm moved into this doc
		const foreign = d.createElement("img");
		foreign.setAttribute("src", "/fx.png");
		document.body.appendChild(foreign);
		await rec("adopted", () => [foreign.src, foreign.getAttribute("src"), foreign.outerHTML]);
		const fa = d.createElement("a");
		document.body.appendChild(fa);
		fa.href = "/fa";
		await rec("adopted set", () => [fa.href, fa.getAttribute("href"), Element.prototype.getAttribute.call(fa, "href")]);
		// cross-realm setAttribute via this realm's method on iframe element
		const fe = d.createElement("img");
		Element.prototype.setAttribute.call(fe, "src", "/cr.png");
		await rec("xrealm", () => [fe.src, fe.getAttribute("src"), fe.outerHTML]);
		const at = d.createAttribute("src"); at.value = "/attr.png";
		const img2 = document.createElement("img");
		img2.setAttributeNode(at);
		await rec("xrealm attr", () => [img2.src, img2.getAttribute("src"), img2.outerHTML]);
		`
	),
	probe(
		"custom",
		`
		const log = [];
		class XEl extends HTMLElement {
			static get observedAttributes() { return ["src", "href", "nonce", "style", "onclick", "data-x"]; }
			attributeChangedCallback(n, o, v) { log.push(n + ":" + o + "->" + v + "|" + this.getAttribute(n)); }
			connectedCallback() { log.push("conn"); }
		}
		customElements.define("x-el-rv2", XEl);
		const x = document.createElement("x-el-rv2");
		x.setAttribute("src", "/s");
		x.setAttribute("nonce", "n");
		x.setAttribute("style", "color:red");
		x.setAttribute("onclick", "f()");
		x.setAttribute("data-x", "1");
		x.removeAttribute("nonce");
		document.body.appendChild(x);
		await rec("log", () => log);
		const y = document.createElement("div");
		y.innerHTML = "<x-el-rv2 src='/p' nonce='q' style='color:blue'></x-el-rv2>";
		await rec("log2", () => log.slice());
		class YImg extends HTMLImageElement {
			static get observedAttributes() { return ["src"]; }
			attributeChangedCallback(n, o, v) { log.push("img " + n + ":" + v); }
		}
		customElements.define("y-img-rv2", YImg, { extends: "img" });
		const yi = document.createElement("img", { is: "y-img-rv2" });
		yi.src = "/yi.png";
		await rec("log3", () => [log.slice(-1)[0], yi.src, yi.getAttribute("src")]);
		`
	),
	probe(
		"shadow",
		`
		const host = document.createElement("div");
		document.body.appendChild(host);
		const sr = host.attachShadow({ mode: "open" });
		sr.innerHTML = "<style>:host{background:url(/h.png)}</style><a href='/s'>s</a><slot></slot><img src='/i.png'>";
		await rec("sr ih", () => sr.innerHTML);
		await rec("sr a", () => sr.querySelector("a").href);
		await rec("sr qs", () => [sr.querySelectorAll("a[href='/s']").length, sr.querySelectorAll("[href^='/']").length]);
		await rec("sr style", () => sr.querySelector("style").textContent);
		await rec("sr gethtml", () => sr.getHTML());
		const t = document.createElement("template");
		t.innerHTML = "<div><template shadowrootmode=open><b>in</b><a href='/d'>d</a></template></div>";
		await rec("dsd", () => t.innerHTML);
		const d = document.createElement("div");
		d.setHTMLUnsafe("<div><template shadowrootmode=open><a href='/dd'>d</a></template></div>");
		await rec("dsd unsafe", () => [d.firstChild.shadowRoot && d.firstChild.shadowRoot.innerHTML, d.getHTML({ serializableShadowRoots: true })]);
		const sheet = new CSSStyleSheet();
		await rec("adopted", () => typeof sheet.replaceSync);
		`
	),
	probe(
		"scripts-exec",
		`
		window.__log = [];
		const cs = document.currentScript;
		await rec("currentScript", () => cs && [cs.src, cs.getAttribute("src"), cs.outerHTML]);
		// webpack public path detection
		const scripts = document.getElementsByTagName("script");
		await rec("last script src", () => scripts[scripts.length - 1].src);
		// jsonp-ish injection
		const s = document.createElement("script");
		s.src = "/nope.js?cb=x";
		s.async = true;
		s.onerror = () => window.__log.push("err");
		await rec("script src", () => [s.src, s.getAttribute("src")]);
		document.head.appendChild(s);
		await new Promise(r => setTimeout(r, 300));
		await rec("script error fired", () => window.__log);
		const m = document.createElement("script");
		m.type = "module";
		m.textContent = "window.__log.push('mod:' + import.meta.url.split('#')[0]);";
		document.head.appendChild(m);
		await new Promise(r => setTimeout(r, 300));
		await rec("module", () => window.__log);
		const tpl = document.createElement("script");
		tpl.type = "text/html";
		tpl.innerHTML = "<div class='x'>{{a}}</div><script>no<\/script>";
		document.body.appendChild(tpl);
		await rec("tpl", () => [tpl.innerHTML, tpl.text, tpl.textContent]);
		const js = document.createElement("script");
		js.textContent = "window.__log.push('twice')";
		document.head.appendChild(js);
		js.textContent = "window.__log.push('again')";
		await rec("no rerun", () => window.__log);
		const cp = document.createElement("script");
		cp.textContent = "window.__log.push('cloned')";
		const cl = cp.cloneNode(true);
		document.head.appendChild(cl);
		await rec("clone exec", () => [window.__log, cl.textContent]);
		const im = document.createElement("script");
		im.type = "importmap";
		im.textContent = JSON.stringify({ imports: { "lodash-x": "/lodash.js" } });
		document.head.appendChild(im);
		await rec("importmap", () => [im.textContent, JSON.parse(im.textContent).imports["lodash-x"]]);
		const ev = document.createElement("div");
		ev.innerHTML = "<img src=x onerror='window.__log.push(\\"onerror:\\" + location.host)'>";
		document.body.appendChild(ev);
		await new Promise(r => setTimeout(r, 400));
		await rec("onerror", () => window.__log);
		`
	),
];
