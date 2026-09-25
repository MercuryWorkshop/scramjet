import { serverTest } from "../../../testcommon.ts";

// Mirror lifecycle: <base href> changes after mirrors were written, iframes that
// navigate after their src mirror was written, elements moved across
// documents / realms / templates, values set before vs after insertion.

type Routes = Record<string, string>;
function routesTest(name: string, routes: Routes, timeoutMs = 60000) {
	const t = serverTest({
		name,
		async start(server) {
			server.on("request", (req, res) => {
				const path = (req.url || "/").split("?")[0];
				const body = routes[path];
				if (body === undefined) {
					res.writeHead(404, {
						"Content-Type": "text/html",
					});
					res.end("<!doctype html><title>404</title>404 " + path);
					return;
				}
				const ct = path.endsWith(".png")
					? "image/png"
					: path.endsWith(".js")
						? "text/javascript"
						: "text/html";
				res.writeHead(200, {
					"Content-Type": ct,
					"Cache-Control": "no-store",
				});
				res.end(ct === "image/png" ? Buffer.from(PNG, "base64") : body);
			});
		},
	});
	t.timeoutMs = timeoutMs;
	return t;
}
const PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const leaf = (label: string) =>
	`<!doctype html><title>${label}</title><script>window.LEAF=${JSON.stringify(label)}</script>${label}`;
const HELPERS = String.raw`
const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loaded = (f) => new Promise((r) => { f.addEventListener("load", () => r(), { once: true }); setTimeout(() => r("TIMEOUT"), 3000); });
const path = (u) => { try { const x = new URL(u); return x.pathname + x.search + x.hash; } catch { return u; } };
const framePath = (f) => T(() => path(f.contentWindow.location.href) + " leaf=" + f.contentWindow.LEAF);
`;

export default [
	// 1. <base href> changed after links/images were written.
	routesTest("rv13-life-base-change", {
		"/": `<!doctype html><html><head><base href="/app/"></head><body>
<a id=a1 href="next.html" target=t>a1</a>
<img id=i1 src="pic.png">
<form id=f1 action="submit.html" target=t><button id=b1>go</button></form>
<iframe name=t id=t></iframe>
<script>${HELPERS}
runTest(async () => {
	const base = document.querySelector("base"), a1 = document.getElementById("a1"), i1 = document.getElementById("i1"), t = document.getElementById("t"), f1 = document.getElementById("f1");
	assertConsistent("before", [a1.href, i1.src, f1.action, document.baseURI].map(path).join(" "));
	base.setAttribute("href", "/other/");
	assertConsistent("after-set", [a1.href, i1.src, f1.action, document.baseURI, a1.getAttribute("href")].map(path).join(" "));
	let p = loaded(t); a1.click(); await p;
	assertConsistent("click-parsed-after-base-change", framePath(t));
	const a2 = document.createElement("a"); a2.href = "next.html"; a2.target = "t"; document.body.append(a2);
	base.href = "/third/";
	assertConsistent("a2-after-base-prop", path(a2.href));
	p = loaded(t); a2.click(); await p;
	assertConsistent("click-created-after-base-change", framePath(t));
	p = loaded(t); f1.requestSubmit(); await p;
	assertConsistent("form-submit-after-base-change", framePath(t));
	base.remove();
	assertConsistent("after-remove", [a1.href, i1.src, document.baseURI].map(path).join(" "));
	p = loaded(t); a1.click(); await p;
	assertConsistent("click-after-base-remove", framePath(t));
	// a base added after the fact
	const nb = document.createElement("base"); nb.href = "/late/"; document.head.prepend(nb);
	const a3 = document.createElement("a"); a3.setAttribute("href", "next.html"); a3.target = "t"; document.body.append(a3);
	assertConsistent("late-base", [a1.href, a3.href].map(path).join(" "));
	p = loaded(t); a1.click(); await p;
	assertConsistent("click-parsed-after-late-base", framePath(t));
	// innerHTML round trip after the base change re-resolves everything
	const wrap = document.createElement("div"); wrap.innerHTML = '<a href="next.html" target="t">x</a>'; document.body.append(wrap);
	nb.href = "/later/";
	wrap.innerHTML = wrap.innerHTML;
	p = loaded(t); wrap.firstChild.click(); await p;
	assertConsistent("click-roundtrip-after-base-change", framePath(t));
}, true);
</script></body></html>`,
		"/app/next.html": leaf("app-next"),
		"/other/next.html": leaf("other-next"),
		"/third/next.html": leaf("third-next"),
		"/next.html": leaf("root-next"),
		"/late/next.html": leaf("late-next"),
		"/later/next.html": leaf("later-next"),
		"/app/submit.html": leaf("app-submit"),
		"/third/submit.html": leaf("third-submit"),
		"/app/pic.png": "",
		"/other/pic.png": "",
		"/pic.png": "",
	}),

	// 2. An iframe that navigates after its src mirror was written.
	routesTest("rv13-life-iframe-nav", {
		"/": `<!doctype html><body><iframe id=f src="/a.html"></iframe>
<script>${HELPERS}
runTest(async () => {
	const f = document.getElementById("f");
	await loaded(f);
	assertConsistent("initial", [f.src, f.getAttribute("src")].map(path).join(" ") + " " + framePath(f));
	let p = loaded(f); f.contentWindow.location.href = "/b.html"; assertConsistent("w1", String(await p));
	assertConsistent("after-inner-nav", [f.src, f.getAttribute("src")].map(path).join(" ") + " " + framePath(f));
	p = loaded(f); f.src = f.src; assertConsistent("w2", String(await p));
	assertConsistent("self-assign", framePath(f));
	f.contentWindow.MARK = 1;
	f.src = "/a.html#x"; await sleep(300);
	assertConsistent("fragment-only", framePath(f) + " mark=" + T(() => f.contentWindow.MARK));
	p = loaded(f); f.setAttribute("src", f.getAttribute("src")); assertConsistent("w3", String(await p));
	assertConsistent("setattr-same", framePath(f));
	p = loaded(f); f.contentWindow.history.pushState(null, "", "/c.html"); f.contentWindow.location.reload(); assertConsistent("w4", String(await p));
	assertConsistent("after-push-reload", [f.getAttribute("src")].map(path).join(" ") + " " + framePath(f));
	// a src swapped while an earlier navigation is still in flight
	f.src = "/b.html"; f.src = "/a.html?2"; assertConsistent("w5", String(await loaded(f)));
	assertConsistent("rapid", framePath(f) + " attr=" + path(f.getAttribute("src")));
	// removing src: Chrome keeps the current document
	f.removeAttribute("src"); await sleep(300);
	assertConsistent("removed", framePath(f) + " has=" + f.hasAttribute("src") + " prop=" + f.src);
}, true);
</script></body>`,
		"/a.html": leaf("a"),
		"/b.html": leaf("b"),
		"/c.html": leaf("c"),
	}),

	// 3. Elements moved between documents, realms and templates.
	routesTest("rv13-life-move", {
		"/": `<!doctype html><body><iframe id=f src="/sub/frame.html"></iframe><template id=tpl></template>
<script>${HELPERS}
runTest(async () => {
	const f = document.getElementById("f");
	await loaded(f);
	const fd = f.contentDocument, fw = f.contentWindow;
	// created here, set before insertion into the frame
	const a = document.createElement("a"); a.href = "x.html"; fd.body.append(a);
	assertConsistent("parent-made set-before", [a.href, a.getAttribute("href")].map(path).join(" "));
	// created here, set after insertion into the frame
	const b = document.createElement("a"); fd.body.append(b); b.href = "x.html";
	assertConsistent("parent-made set-after", [b.href, b.getAttribute("href")].map(path).join(" "));
	// created in the frame's realm, moved here
	const c = fd.createElement("a"); c.href = "x.html"; document.body.append(c);
	assertConsistent("frame-made moved-here", [c.href, c.getAttribute("href"), c.pathname].map(path).join(" "));
	// frame realm's setter on a parent element
	const d = document.createElement("a"); document.body.append(d);
	fw.HTMLAnchorElement.prototype.__lookupSetter__("href").call(d, "x.html");
	assertConsistent("frame-setter parent-el", [d.href, d.getAttribute("href")].map(path).join(" "));
	const e = document.createElement("a"); document.body.append(e);
	fw.Element.prototype.setAttribute.call(e, "href", "x.html");
	assertConsistent("frame-setAttribute parent-el", [e.href, e.getAttribute("href")].map(path).join(" "));
	// images: the one Chrome actually loads after adoption
	const img = document.createElement("img"); img.src = "pic.png";
	await new Promise((r) => { img.onload = img.onerror = r; });
	fd.body.append(img);
	await new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 1000); });
	assertConsistent("img adopted", [img.src, img.currentSrc, img.getAttribute("src")].map(path).join(" ") + " w=" + img.naturalWidth);
	const img2 = fd.createElement("img"); img2.src = "pic.png";
	await new Promise((r) => { img2.onload = img2.onerror = r; });
	document.body.append(img2);
	await new Promise((r) => { img2.onload = img2.onerror = r; setTimeout(r, 1000); });
	assertConsistent("frame img adopted here", [img2.src, img2.currentSrc].map(path).join(" ") + " w=" + img2.naturalWidth);
	// template content (inert document)
	const tpl = document.getElementById("tpl");
	const t1 = document.createElement("a"); t1.href = "x.html"; tpl.content.append(t1);
	assertConsistent("in-template", [t1.href, t1.getAttribute("href")].map(path).join(" "));
	const t2 = tpl.content.ownerDocument.createElement("a"); t2.setAttribute("href", "y.html"); tpl.content.append(t2);
	assertConsistent("template-doc-made", [t2.href, t2.getAttribute("href")].map(path).join(" "));
	const clone = document.importNode(tpl.content, true); document.body.append(clone);
	assertConsistent("template-imported", Array.from(document.body.querySelectorAll("a")).slice(-2).map((x) => path(x.href) + "|" + x.getAttribute("href")).join(" "));
	// createHTMLDocument / DOMParser documents (no URL of their own)
	const hd = document.implementation.createHTMLDocument("");
	const h = hd.createElement("a"); h.href = "x.html"; hd.body.append(h);
	assertConsistent("createHTMLDocument", [h.href, h.getAttribute("href")].map(path).join(" "));
	const hb = hd.createElement("base"); hb.href = "http://example.test/dir/"; hd.head.append(hb);
	assertConsistent("createHTMLDocument+base", [h.href, h.getAttribute("href")].map(path).join(" "));
	document.body.append(h);
	assertConsistent("createHTMLDocument moved here", [h.href, h.getAttribute("href")].map(path).join(" "));
	const pd = new DOMParser().parseFromString('<base href="http://example.test/b/"><a href="x.html">x</a><img src="i.png">', "text/html");
	assertConsistent("domparser+base", [pd.querySelector("a").href, pd.querySelector("img").src, pd.querySelector("a").getAttribute("href")].join(" "));
	const moved = document.adoptNode(pd.querySelector("a")); document.body.append(moved);
	assertConsistent("domparser moved here", [moved.href, moved.getAttribute("href")].map(path).join(" "));
	// srcdoc / about:blank frames inherit the parent's base
	const sd = document.createElement("iframe"); sd.srcdoc = '<a href="x.html">x</a><base href="/sd/"><a href="y.html">y</a>'; document.body.append(sd); await loaded(sd);
	assertConsistent("srcdoc", Array.from(sd.contentDocument.links).map((x) => path(x.href) + "|" + x.getAttribute("href")).join(" "));
	const ab = document.createElement("iframe"); document.body.append(ab);
	const aa = ab.contentDocument.createElement("a"); aa.href = "x.html"; ab.contentDocument.body.append(aa);
	assertConsistent("about:blank", [aa.href, aa.getAttribute("href")].map(path).join(" "));
}, true);
</script></body>`,
		"/sub/frame.html": leaf("frame"),
		"/pic.png": "",
		"/sub/pic.png": "",
	}),
];
