import { serverTest } from "../../../testcommon.ts";

// URL reflection when the element's node document is not the document of the
// realm whose setter runs: adopted nodes, child frames at another path, inert
// documents with their own <base>. Compared with bare Chrome.

function server(s: any) {
	s.on("request", (req: any, res: any) => {
		if (req.url === "/" || req.url === "/script.js") return;
		if (req.url.startsWith("/sub/dir/child")) {
			res.writeHead(200, {
				"content-type": "text/html",
			});
			res.end(
				`<!doctype html><body><script>parent.postMessage("ready","*")</script></body>`
			);
			return;
		}
		if (req.url.startsWith("/basechild")) {
			res.writeHead(200, {
				"content-type": "text/html",
			});
			res.end(
				`<!doctype html><head><base href="/other/base/"></head><body><script>parent.postMessage("ready","*")</script></body>`
			);
			return;
		}
		res.writeHead(404);
		res.end("nf");
	});
}

const PRE = `
	const K = async (k, f) => {
		let v;
		try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
		if (v === undefined) v = "undefined";
		if (typeof v === "string") v = v.split(location.origin).join("O");
		assertConsistent(k, v);
	};
	const load = (src) => new Promise((res) => { const f = document.createElement("iframe"); const h = (e) => { if (e.data === "ready" && e.source === f.contentWindow) { removeEventListener("message", h); res(f); } }; addEventListener("message", h); f.src = src; document.body.appendChild(f); });
`;

export default [
	serverTest({
		name: "rv17-nodebase",
		autoPass: true,
		start: async (s) => server(s),
		js: `${PRE}
			const f = await load("/sub/dir/child");
			const W = f.contentWindow, D = f.contentDocument;
			// parent-realm element living in the child document
			await K("parentElInChild.src", () => { const i = document.createElement("img"); D.body.append(i); i.src = "x.png"; return [i.src, i.getAttribute("src")].join("|"); });
			await K("parentElInChild.setAttr", () => { const i = document.createElement("img"); D.body.append(i); i.setAttribute("src", "y.png"); return [i.src, i.getAttribute("src")].join("|"); });
			await K("parentElInChild.aHref", () => { const a = document.createElement("a"); D.body.append(a); a.href = "z"; return [a.href, a.pathname, a.getAttribute("href")].join("|"); });
			await K("parentElInChild.before", () => { const a = document.createElement("a"); a.href = "z"; D.body.append(a); return [a.href, a.getAttribute("href")].join("|"); });
			await K("parentElInChild.innerHTML", () => { const d = document.createElement("div"); D.body.append(d); d.innerHTML = "<a href='q'>x</a>"; return [d.firstChild.href, d.innerHTML].join("|"); });
			await K("childElInParent.src", () => { const i = D.createElement("img"); document.body.append(i); i.src = "x.png"; return [i.src, i.getAttribute("src")].join("|"); });
			await K("childElInParent.aHref", () => { const a = D.createElement("a"); document.body.append(a); a.href = "z"; return [a.href, a.getAttribute("href")].join("|"); });
			await K("childElMoved", () => { const a = D.createElement("a"); a.href = "z"; document.body.append(a); return [a.href, a.getAttribute("href")].join("|"); });
			await K("childElInChild", () => { const a = D.createElement("a"); D.body.append(a); a.href = "z"; return [a.href, a.getAttribute("href")].join("|"); });
			await K("childParentSetterCall", () => { const a = D.createElement("a"); D.body.append(a); Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").set.call(a, "pz"); return [a.href, a.getAttribute("href")].join("|"); });
			await K("childBaseURI", () => [D.baseURI, D.URL].join("|"));
			await K("childElBaseURI", () => document.createElement("b").baseURI + "|" + D.createElement("b").baseURI);
			await K("parentFetchChildRel", async () => (await W.fetch("rel")).status);
			const fb = await load("/basechild");
			const DB = fb.contentDocument;
			await K("baseChild.childEl", () => { const a = DB.createElement("a"); a.href = "z"; return [a.href, a.getAttribute("href")].join("|"); });
			await K("baseChild.parentEl", () => { const a = document.createElement("a"); DB.body.append(a); a.href = "z"; return [a.href, a.getAttribute("href")].join("|"); });
			await K("baseChild.baseHref", () => DB.querySelector("base").href);
			// inert documents with their own base
			const hd = document.implementation.createHTMLDocument("t");
			const b = hd.createElement("base"); b.href = "http://other.test/dir/"; hd.head.append(b);
			await K("inert.base", () => [b.href, b.getAttribute("href"), hd.baseURI].join("|"));
			await K("inert.aHref", () => { const a = hd.createElement("a"); a.href = "z"; return [a.href, a.getAttribute("href")].join("|"); });
			await K("inert.aHrefAttr", () => { const a = hd.createElement("a"); a.setAttribute("href", "z2"); hd.body.append(a); return [a.href, a.getAttribute("href"), hd.body.innerHTML].join("|"); });
			await K("inert.innerHTML", () => { const d = hd.createElement("div"); d.innerHTML = "<a href='z3'>x</a>"; return [d.firstChild.href, d.innerHTML].join("|"); });
			await K("inert.adopted", () => { const a = hd.createElement("a"); a.setAttribute("href", "z4"); document.body.append(a); return [a.href, a.getAttribute("href")].join("|"); });
			const dp = new DOMParser().parseFromString("<head><base href='/pbase/'></head><body><a href='k'>x</a><img src='i.png'></body>", "text/html");
			await K("parsed.base", () => [dp.querySelector("base").href, dp.baseURI].join("|"));
			await K("parsed.a", () => [dp.querySelector("a").href, dp.querySelector("a").getAttribute("href"), dp.body.innerHTML].join("|"));
			await K("parsed.imgMoved", () => { const i = dp.querySelector("img"); document.body.append(i); return [i.src, i.getAttribute("src")].join("|"); });
			const t = document.createElement("template");
			t.innerHTML = "<a href='tk'>x</a><img src='t.png'>";
			await K("template.a", () => [t.content.firstChild.href, t.content.firstChild.getAttribute("href"), t.innerHTML].join("|"));
			await K("template.clone", () => { const c = document.importNode(t.content, true); document.body.append(c); const a = document.body.lastChild.previousSibling; return [a.href, a.getAttribute("href")].join("|"); });
		`,
	}),
];
