import { basicTest, htmlTest } from "../../../testcommon.ts";

// Broad consistency probes for the element & attribute layer. Every value is
// compared against bare Chrome; run without RUNWAY_FAST.

const probe = (name: string, js: string) =>
	basicTest({
		name: `rv2-cons-${name}`,
		js: `
			const R = {};
			const rec = (k, f) => { try { R[k] = f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message; } };
			${js}
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" || typeof R[k] === "number" || typeof R[k] === "boolean" || R[k] === null ? R[k] : JSON.stringify(R[k]));
		`,
	});

export default [
	probe(
		"anchor",
		`
		const vals = ["/x", "x?y#z", "#h", "", "javascript:void(0)", "mailto:a@b.c", "//cdn.example.com/a.js", "https://other.test/p?q", "data:text/plain,hi", "  /sp  ", "http://[bad", "?only", "tel:+1"];
		for (const v of vals) {
			const a = document.createElement("a");
			a.href = v;
			rec("href " + v, () => a.href);
			rec("attr " + v, () => a.getAttribute("href"));
			rec("parts " + v, () => [a.protocol, a.host, a.hostname, a.port, a.pathname, a.search, a.hash, a.origin, a.username].join("|"));
			rec("str " + v, () => String(a));
			document.body.appendChild(a);
			rec("conn " + v, () => a.href);
			rec("outer " + v, () => a.outerHTML);
			a.remove();
		}
		const a = document.createElement("a");
		rec("nohref", () => [a.href, a.protocol, a.host, a.pathname, a.origin, String(a)].join("|"));
		a.href = "https://ex.test/a/b?c#d";
		a.pathname = "/z"; rec("set pathname", () => a.href);
		a.search = "q=1"; rec("set search", () => a.href);
		a.hash = "h2"; rec("set hash", () => a.href);
		a.host = "other.test:81"; rec("set host", () => a.href);
		a.protocol = "http"; rec("set protocol", () => a.href);
		rec("attr after", () => a.getAttribute("href"));
		`
	),
	probe(
		"urls",
		`
		const cases = [
			["img", "src"], ["script", "src"], ["iframe", "src"], ["embed", "src"], ["video", "src"], ["audio", "src"],
			["source", "src"], ["track", "src"], ["input", "src"], ["link", "href"], ["area", "href"],
			["object", "data"], ["video", "poster"], ["form", "action"], ["button", "formAction"], ["input", "formAction"],
			["blockquote", "cite"], ["img", "longDesc"],
		];
		for (const [tag, prop] of cases) {
			for (const v of ["/r/x.bin", "", "https://e.test/y", "data:,x", "about:blank"]) {
				const el = document.createElement(tag);
				rec(tag + "." + prop + " unset", () => el[prop]);
				el[prop] = v;
				rec(tag + "." + prop + "=" + v, () => el[prop]);
				rec(tag + "." + prop + "=" + v + " attr", () => el.getAttribute(prop.toLowerCase()));
				rec(tag + "." + prop + "=" + v + " outer", () => el.outerHTML);
			}
		}
		const img = document.createElement("img");
		img.srcset = "/a.png 1x, /b.png 2x";
		rec("srcset", () => img.srcset);
		rec("srcset attr", () => img.getAttribute("srcset"));
		const link = document.createElement("link");
		link.imageSrcset = "/a.png 1x";
		rec("imageSrcset", () => link.imageSrcset);
		const ifr = document.createElement("iframe");
		ifr.srcdoc = "<p>hi <a href='/x'>x</a></p>";
		rec("srcdoc", () => ifr.srcdoc);
		rec("srcdoc attr", () => ifr.getAttribute("srcdoc"));
		const s = document.createElement("script");
		s.integrity = "sha384-abc"; s.nonce = "n1"; s.crossOrigin = "anonymous";
		rec("integrity", () => s.integrity);
		rec("nonce", () => s.nonce);
		rec("nonce attr", () => s.getAttribute("nonce"));
		s.setAttribute("nonce", "n2");
		rec("nonce2", () => [s.nonce, s.getAttribute("nonce"), s.hasAttribute("nonce")].join("|"));
		rec("script outer", () => s.outerHTML);
		rec("script names", () => s.getAttributeNames());
		`
	),
	probe(
		"attributes",
		`
		const el = document.createElement("img");
		el.setAttribute("id", "i");
		el.setAttribute("src", "/a.png");
		el.setAttribute("alt", "x");
		el.setAttribute("style", "background:url(/b.png)");
		el.setAttribute("nonce", "zz");
		el.setAttribute("onclick", "return 1");
		rec("names", () => el.getAttributeNames());
		rec("len", () => el.attributes.length);
		rec("list", () => Array.from(el.attributes).map(a => a.name + "=" + a.value));
		rec("idx", () => { const o = []; for (let i = 0; i < el.attributes.length; i++) o.push(el.attributes[i].name + "=" + el.attributes[i].value); return o; });
		rec("named", () => el.attributes.src.value + "|" + el.attributes["src"].nodeValue + "|" + el.attributes.getNamedItem("src").textContent);
		rec("keys", () => Object.keys(el.attributes));
		rec("in", () => ["src" in el.attributes, "scramjet-attr-src" in el.attributes, "0" in el.attributes, "6" in el.attributes]);
		rec("hasAttributes", () => el.hasAttributes());
		rec("outer", () => el.outerHTML);
		rec("style", () => el.getAttribute("style"));
		rec("onclick", () => el.getAttribute("onclick"));
		rec("onclick prop typeof", () => typeof el.onclick);
		const node = el.getAttributeNode("src");
		node.value = "/c.png";
		rec("after node set", () => [el.getAttribute("src"), el.src, node.value]);
		el.removeAttribute("src");
		rec("after remove", () => [el.getAttribute("src"), el.hasAttribute("src"), el.src, node.value, node.ownerElement]);
		rec("toggle1", () => el.toggleAttribute("hidden"));
		rec("toggle2", () => el.toggleAttribute("hidden"));
		rec("toggle3", () => el.toggleAttribute("src", true));
		rec("toggle3b", () => [el.getAttribute("src"), el.src]);
		rec("upper", () => { el.setAttribute("SRC", "/U.png"); return [el.getAttribute("src"), el.getAttribute("SRC"), el.src, el.getAttributeNames()]; });
		rec("objval", () => { el.setAttribute("src", { toString() { return "/obj.png"; } }); return el.src; });
		rec("nullval", () => { el.setAttribute("src", null); return [el.getAttribute("src"), el.src]; });
		rec("numval", () => { el.setAttribute("src", 42); return [el.getAttribute("src"), el.src]; });
		rec("undef", () => { el.setAttribute("alt", undefined); return el.getAttribute("alt"); });
		rec("missing arg", () => { el.setAttribute("alt"); return "noerr"; });
		rec("bad name", () => { el.setAttribute("a b", "x"); return "noerr"; });
		rec("internal", () => { el.setAttribute("scramjet-attr-foo", "x"); return [el.getAttribute("scramjet-attr-foo"), el.getAttributeNames()]; });
		const d = document.createElement("div");
		d.dataset.fooBar = "1";
		d.classList.add("a", "b");
		rec("dataset", () => [d.getAttribute("data-foo-bar"), d.className, d.outerHTML]);
		`
	),
	probe(
		"markup",
		`
		const inputs = [
			"<img src='/a.png' srcset='/a.png 1x' onerror='x()'>",
			"<a href=\\"/p?a=1&amp;b=2\\">t</a>",
			"<div style=\\"background:url('/q.png')\\">s</div>",
			"<script>var a = 1 < 2 && location.href;<\/script>",
			"<style>body{background:url(/z.png)}</style>",
			"<svg viewBox='0 0 10 10'><use href='#a'/><image href='/i.png'/><a xlink:href='/l'>x</a></svg>",
			"<table><tr><td>1</td></tr></table>",
			"<template><img src='/t.png'></template>",
			"<p>unclosed <b>bold",
			"<",
			"<!-- c --><p>x</p>",
			"<noscript><img src='/n.png'></noscript>",
			"<iframe srcdoc=\\"<b>x</b>\\"></iframe>",
			"<form action='/f'><button formaction='/g'>b</button></form>",
			"<meta http-equiv='refresh' content='0;url=/r'>",
			"<math><mi>x</mi></math>",
			"<textarea><a href='/x'></textarea>",
			"<select><option value='/x'>x</option></select>",
			"<input value='&quot;x&quot;'>",
			"<div data-src='/d.png' data-href='/e'></div>",
			"text &amp; &lt;b&gt; &nbsp; &copy;",
			"<custom-el src='/c' href='/d'></custom-el>",
			"<a href='javascript:alert(1)'>j</a>",
			"<object data='/o.swf'><param name=movie value='/m.swf'></object>",
			"<video poster='/p.jpg'><source src='/s.mp4'></video>",
			"<link rel=stylesheet href='/s.css' integrity='sha-x' crossorigin>",
		];
		inputs.forEach((h, i) => {
			const d = document.createElement("div");
			rec("in " + i, () => { d.innerHTML = h; return d.innerHTML; });
			rec("q " + i, () => Array.from(d.querySelectorAll("*")).map(e => e.localName + ":" + e.getAttributeNames().map(n => n + "=" + e.getAttribute(n)).join(",")).join(";"));
			rec("tc " + i, () => d.textContent);
			rec("outer " + i, () => d.outerHTML);
			const d2 = document.createElement("div");
			rec("iah " + i, () => { d2.insertAdjacentHTML("beforeend", h); return d2.innerHTML; });
			rec("range " + i, () => { const r = document.createRange(); r.selectNodeContents(document.body); const f = r.createContextualFragment(h); const w = document.createElement("div"); w.appendChild(f); return w.innerHTML; });
			rec("dp " + i, () => new DOMParser().parseFromString(h, "text/html").body.innerHTML);
			rec("unsafe " + i, () => { const d3 = document.createElement("div"); d3.setHTMLUnsafe(h); return d3.innerHTML; });
			rec("clone " + i, () => d.cloneNode(true).innerHTML);
		});
		const d = document.createElement("div");
		rec("null", () => { d.innerHTML = null; return JSON.stringify(d.innerHTML); });
		rec("undef", () => { d.innerHTML = undefined; return d.innerHTML; });
		rec("num", () => { d.innerHTML = 5; return d.innerHTML; });
		rec("obj", () => { d.innerHTML = { toString() { return "<i>o</i>"; } }; return d.innerHTML; });
		`
	),
	probe(
		"selectors",
		`
		document.body.insertAdjacentHTML("beforeend", "<div id=selroot><a href='/foo/bar' target=_blank>1</a><a href='https://x.test/y'>2</a><img src='/img/a.png'><script src='/js/app.js' type='x-no'><\/script><link rel=stylesheet href='/s.css'><div style='color:red'></div><details open></details><div onclick='x()'></div></div>");
		const root = document.getElementById("selroot");
		const sels = ["a[href]", "a[href^='/foo']", "a[href*='x.test']", "a[href$='bar']", "a[href='/foo/bar']", "img[src*='a.png']", "script[src*='app']", "link[href$='.css']", "[style*=red]", "details[open]", "[onclick]", "a[target=_blank]", "[scramjet-attr-href]", "[class]", ":is(a[href^='/foo'], img)", "a:not([href^='http'])", "div:has(> a[href^='/foo'])", "[HREF^='/foo']", "a[href^='/FOO' i]"];
		for (const s of sels) {
			rec("qsa " + s, () => root.querySelectorAll(s).length);
			rec("dqsa " + s, () => document.querySelectorAll("#selroot " + s).length);
			rec("qs " + s, () => { const e = root.querySelector(s); return e && e.outerHTML; });
		}
		const a = root.querySelector("a");
		rec("matches", () => [a.matches("a[href^='/foo']"), a.matches("[href='/foo/bar']"), a.closest("[id=selroot]") === root, a.webkitMatchesSelector("a[href^='/foo']")]);
		rec("bad", () => root.querySelector("a[href"));
		rec("bad2", () => root.querySelector("[[x]"));
		`
	),
	probe(
		"text",
		`
		const s = document.createElement("script");
		s.type = "text/x-template";
		s.textContent = "<div>{{ location.href }}</div>";
		rec("tpl tc", () => s.textContent);
		rec("tpl ih", () => s.innerHTML);
		rec("tpl text", () => s.text);
		const j = document.createElement("script");
		j.type = "application/ld+json";
		j.textContent = '{"url":"https://e.test/x","a":"<b>"}';
		document.head.appendChild(j);
		rec("json", () => JSON.parse(j.textContent).url);
		const st = document.createElement("style");
		st.textContent = "a{background:url(/q.png)} @import url('/i.css');";
		document.head.appendChild(st);
		rec("style tc", () => st.textContent);
		rec("style ih", () => st.innerHTML);
		rec("style rules", () => st.sheet.cssRules.length);
		const st2 = document.createElement("style");
		st2.appendChild(document.createTextNode("b{color:red}"));
		st2.appendChild(document.createTextNode("i{background:url(/w.png)}"));
		document.head.appendChild(st2);
		rec("style2 tc", () => st2.textContent);
		rec("style2 rules", () => st2.sheet.cssRules.length);
		rec("style2 firstChild", () => st2.firstChild.data + "|" + st2.lastChild.data + "|" + st2.childNodes.length);
		window.__r = [];
		const x = document.createElement("script");
		x.text = "window.__r.push('text:' + location.host)";
		document.head.appendChild(x);
		const y = document.createElement("script");
		y.appendChild(document.createTextNode("window.__r.push('node:' + location.host)"));
		document.head.appendChild(y);
		const z = document.createElement("script");
		document.head.appendChild(z);
		z.appendChild(document.createTextNode("window.__r.push('late:' + location.host)"));
		const w = document.createElement("script");
		document.head.appendChild(w);
		w.textContent = "window.__r.push('latetc:' + location.host)";
		const v = document.createElement("script");
		v.innerHTML = "window.__r.push('ih:' + location.host)";
		document.head.appendChild(v);
		const u = document.createElement("script");
		u.append("window.__r.push('append:' + location.host)");
		document.head.appendChild(u);
		rec("ran", () => window.__r);
		rec("x text", () => x.text + "|" + x.textContent + "|" + x.innerHTML + "|" + x.firstChild.data + "|" + x.firstChild.length);
		rec("y text", () => y.text);
		const p = document.createElement("p");
		p.textContent = "hello";
		p.firstChild.appendData(" world");
		rec("p", () => [p.textContent, p.firstChild.data, p.firstChild.length, p.innerText]);
		const t = document.createTextNode("abc");
		rec("t", () => [t.data, t.nodeValue, t.textContent, t.length, t.wholeText]);
		rec("body tc len", () => typeof document.body.textContent);
		rec("doc tc", () => document.textContent);
		rec("range tostring", () => { const r = document.createRange(); r.selectNodeContents(s); return r.toString(); });
		`
	),
	probe(
		"svg",
		`
		const NS = "http://www.w3.org/2000/svg", XL = "http://www.w3.org/1999/xlink";
		const svg = document.createElementNS(NS, "svg");
		document.body.appendChild(svg);
		const use = document.createElementNS(NS, "use");
		use.setAttribute("href", "#icon");
		svg.appendChild(use);
		rec("use href", () => [use.href.baseVal, use.href.animVal, use.getAttribute("href")]);
		const use2 = document.createElementNS(NS, "use");
		use2.setAttributeNS(XL, "xlink:href", "/sprite.svg#i");
		svg.appendChild(use2);
		rec("use2", () => [use2.href.baseVal, use2.getAttributeNS(XL, "href"), use2.getAttribute("xlink:href"), use2.outerHTML]);
		const img = document.createElementNS(NS, "image");
		img.href.baseVal = "/pic.png";
		rec("image", () => [img.href.baseVal, img.getAttribute("href"), img.outerHTML]);
		const a = document.createElementNS(NS, "a");
		a.setAttribute("href", "/link");
		rec("svg a", () => [a.href.baseVal, a.getAttribute("href")]);
		rec("viewBox", () => { svg.setAttribute("viewBox", "0 0 1 1"); return [svg.getAttribute("viewBox"), svg.getAttribute("viewbox"), svg.getAttributeNames(), svg.viewBox.baseVal.width]; });
		rec("className", () => { svg.setAttribute("class", "c"); return svg.className.baseVal; });
		rec("svg innerHTML", () => { svg.innerHTML = "<circle r='1' style='fill:red'/><use href='/s.svg#a'/>"; return svg.innerHTML; });
		rec("svg outer", () => svg.outerHTML);
		`
	),
	probe(
		"base",
		`
		rec("doc baseURI", () => document.baseURI);
		rec("body baseURI", () => document.body.baseURI);
		const b = document.createElement("base");
		rec("base href unset", () => b.href);
		b.href = "/sub/dir/";
		document.head.appendChild(b);
		rec("base href", () => b.href);
		rec("doc baseURI2", () => document.baseURI);
		const a = document.createElement("a");
		a.setAttribute("href", "rel/x");
		rec("a rel", () => a.href);
		const img = new Image();
		img.src = "p.png";
		rec("img rel", () => img.src);
		b.href = "https://cdn.test/root/";
		rec("abs base", () => [document.baseURI, a.href, img.src]);
		b.remove();
		rec("after remove", () => [document.baseURI, a.href]);
		const doc = document.implementation.createHTMLDocument("x");
		const a2 = doc.createElement("a");
		a2.setAttribute("href", "/q");
		rec("impl doc", () => [doc.baseURI, a2.href, doc.URL]);
		const pdoc = new DOMParser().parseFromString("<a href='/pp'>x</a><img src='i.png'>", "text/html");
		rec("dp doc", () => [pdoc.baseURI, pdoc.URL, pdoc.querySelector("a").href, pdoc.querySelector("img").src, pdoc.querySelector("a").getAttribute("href")]);
		`
	),
	probe(
		"xml-domparser",
		`
		const x1 = '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A &amp; B</title><link rel="alternate" href="https://ex.test/post"/><entry><content type="html">&lt;p&gt;hi&lt;/p&gt;</content><link href="/rel"/></entry></feed>';
		const d1 = new DOMParser().parseFromString(x1, "application/xml");
		rec("atom err", () => !!d1.querySelector("parsererror"));
		rec("atom root", () => d1.documentElement.nodeName);
		rec("atom link", () => d1.querySelector("link").getAttribute("href"));
		rec("atom links", () => Array.from(d1.getElementsByTagName("link")).map(l => l.getAttribute("href") + "/" + l.attributes.length));
		rec("atom ser", () => new XMLSerializer().serializeToString(d1));
		rec("atom title", () => d1.querySelector("title").textContent);
		const x2 = '<rss version="2.0"><channel><item><title><![CDATA[Hello <b>World</b>]]></title><link>https://ex.test/a</link><enclosure url="https://ex.test/a.mp3"/><description>x &lt; y</description></item></channel></rss>';
		const d2 = new DOMParser().parseFromString(x2, "text/xml");
		rec("rss err", () => !!d2.querySelector("parsererror"));
		rec("rss title", () => d2.querySelector("title").textContent);
		rec("rss ser", () => new XMLSerializer().serializeToString(d2));
		const x3 = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><path d="M0 0L24 24" fill="url(#g)"/><use xlink:href="#p"/><image href="/i.png"/><style>.a{fill:red}</style><script>var q=1;</script></svg>';
		const d3 = new DOMParser().parseFromString(x3, "image/svg+xml");
		rec("svg err", () => !!d3.querySelector("parsererror"));
		rec("svg vb", () => d3.documentElement.getAttribute("viewBox"));
		rec("svg lg", () => d3.getElementsByTagName("linearGradient").length);
		rec("svg ser", () => new XMLSerializer().serializeToString(d3));
		rec("svg outer", () => d3.documentElement.outerHTML);
		const x4 = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY e "ENT">]><r a="&e;"><?pi data?><CamelCase Attr="1">&e;</CamelCase><empty/></r>';
		const d4 = new DOMParser().parseFromString(x4, "text/xml");
		rec("dtd err", () => !!d4.querySelector("parsererror") && d4.querySelector("parsererror").textContent);
		rec("dtd ser", () => new XMLSerializer().serializeToString(d4));
		const x5 = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><m:R xmlns:m="urn:x"><m:src>/a</m:src></m:R></soap:Body></soap:Envelope>';
		const d5 = new DOMParser().parseFromString(x5, "text/xml");
		rec("soap", () => new XMLSerializer().serializeToString(d5));
		const x6 = '<html xmlns="http://www.w3.org/1999/xhtml"><body><a href="/x">x</a><img src="/i.png"/></body></html>';
		const d6 = new DOMParser().parseFromString(x6, "application/xhtml+xml");
		rec("xhtml", () => [!!d6.querySelector("parsererror"), d6.querySelector("a").href, d6.querySelector("a").getAttribute("href"), new XMLSerializer().serializeToString(d6)]);
		const bad = new DOMParser().parseFromString("<a><b></a>", "text/xml");
		rec("bad xml", () => !!bad.querySelector("parsererror"));
		`
	),
	probe(
		"xmlserializer-html",
		`
		const d = document.createElement("div");
		d.innerHTML = "<a href='/x'>x</a><img src='/i.png' nonce=n>";
		rec("ser", () => new XMLSerializer().serializeToString(d));
		const a = document.createElement("a"); a.href = "/y";
		rec("ser a", () => new XMLSerializer().serializeToString(a));
		`
	),
	probe(
		"clone-import",
		`
		const t = document.createElement("template");
		t.innerHTML = "<a href='/x'>x</a><script>var q = location.href;<\/script><style>a{background:url(/b.png)}</style>";
		const c = document.importNode(t.content, true);
		rec("imp a", () => c.querySelector("a").href);
		rec("imp script", () => c.querySelector("script").textContent);
		rec("imp style", () => c.querySelector("style").textContent);
		const c2 = t.content.cloneNode(true);
		rec("clone script", () => c2.querySelector("script").textContent);
		rec("tpl content", () => t.content.firstChild.getAttribute("href"));
		rec("tpl ih", () => t.innerHTML);
		const a = document.createElement("a"); a.href = "/z";
		const a2 = a.cloneNode();
		rec("clone a", () => [a2.href, a2.getAttribute("href"), a2.outerHTML]);
		`
	),
	probe(
		"mo",
		`
		const el = document.createElement("img");
		document.body.appendChild(el);
		const mo = new MutationObserver(() => {});
		mo.observe(el, { attributes: true, attributeOldValue: true });
		el.setAttribute("alt", "a");
		el.setAttribute("src", "/x.png");
		el.setAttribute("onclick", "f()");
		el.setAttribute("style", "color:red");
		el.id = "q";
		const recs = mo.takeRecords();
		rec("records", () => recs.map(r => r.attributeName + ":" + r.oldValue));
		mo.disconnect();
		`
	),
	probe(
		"onattr",
		`
		const a = document.createElement("a");
		a.href = "#";
		rec("set rf", () => { a.setAttribute("onclick", "window.__c = (window.__c||0)+1; return false;"); return "ok"; });
		document.body.appendChild(a);
		rec("click", () => { const ev = new MouseEvent("click", { cancelable: true, bubbles: true }); a.dispatchEvent(ev); return [window.__c, ev.defaultPrevented]; });
		rec("get", () => a.getAttribute("onclick"));
		const b = document.createElement("div");
		rec("invalid", () => { b.setAttribute("onclick", "{{ foo }} ) ("); return b.getAttribute("onclick"); });
		rec("tpl", () => { b.setAttribute("onload", "\${handler}"); return b.getAttribute("onload"); });
		rec("event param", () => { b.setAttribute("onclick", "window.__ev = event.type"); document.body.appendChild(b); b.click(); return window.__ev; });
		rec("this", () => { b.setAttribute("onclick", "window.__th = this.tagName"); b.click(); return window.__th; });
		rec("ret handler", () => { b.setAttribute("onmouseover", "return;"); return typeof b.onmouseover; });
		rec("with scope", () => { const f = document.createElement("form"); f.innerHTML = "<input name=qq value=v><button type=button onclick='window.__qq = qq.value'>b</button>"; document.body.appendChild(f); f.querySelector("button").click(); return window.__qq; });
		rec("setattr scope", () => { const f = document.createElement("form"); f.innerHTML = "<input name=zz value=w><button type=button>b</button>"; document.body.appendChild(f); const btn = f.querySelector("button"); btn.setAttribute("onclick", "window.__zz = zz.value + ':' + (typeof form)"); btn.click(); return window.__zz; });
		`
	),
];
