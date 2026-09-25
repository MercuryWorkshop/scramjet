import { htmlTest, serverTest } from "../../../testcommon.ts";

// Assorted mirror-layer probes: meta refresh through reflected setters,
// native (editing) writes behind the layer's back, page-authored
// scramjet-attr-* names, case/namespace quirks of the *NS members.

const PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
function routesTest(
	name: string,
	routes: Record<string, string>,
	timeoutMs = 60000
) {
	const t = serverTest({
		name,
		async start(server) {
			server.on("request", (req, res) => {
				const path = (req.url || "/").split("?")[0];
				if (path.endsWith(".png")) {
					res.writeHead(200, {
						"Content-Type": "image/png",
					});
					res.end(Buffer.from(PNG, "base64"));
					return;
				}
				const body = routes[path];
				res.writeHead(body === undefined ? 404 : 200, {
					"Content-Type": "text/html",
				});
				res.end(
					body ??
						`<!doctype html><title>404</title><script>window.LEAF="404:${"${path}"}"</script>404`
				);
			});
		},
	});
	t.timeoutMs = timeoutMs;
	return t;
}
const T = String.raw`const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));`;
const leaf = (l: string) =>
	`<!doctype html><title>${l}</title><script>window.LEAF=${JSON.stringify(l)}</script>${l}`;

const REFRESH: Record<string, string> = {
	a: `m.httpEquiv = "refresh"; m.content = "0;url=/landed-a.html"; document.head.append(m);`,
	b: `m.setAttribute("http-equiv", "refresh"); m.setAttribute("content", "0;url=/landed-b.html"); document.head.append(m);`,
	c: `m.setAttribute("content", "0;url=/landed-c.html"); m.setAttribute("http-equiv", "refresh"); document.head.append(m);`,
	d: `m.setAttribute("content", "0;url=/landed-d.html"); document.head.append(m); m.httpEquiv = "refresh";`,
	e: `m.setAttribute("http-equiv", "refresh"); m.content = "0;url=/landed-e.html"; document.head.append(m);`,
	f: `m.setAttribute("content", "0;url=/landed-f.html"); m.httpEquiv = "refresh"; document.head.append(m);`,
	g: `document.head.insertAdjacentHTML("beforeend", '<meta http-equiv="refresh" content="0;url=/landed-g.html">');`,
	h: `m.setAttribute("http-equiv", "refresh"); m.setAttribute("content", "5;url=/landed-h.html"); document.head.append(m); m.setAttribute("content", "0;url=/landed-h2.html");`,
	i: `m.setAttribute("http-equiv", "refresh"); document.head.append(m); m.attributes.setNamedItem(Object.assign(document.createAttribute("content"), { value: "0;url=/landed-i.html" }));`,
	j: `m.setAttribute("http-equiv", "refresh"); m.content = "0;url=" + location.origin + "/landed-j.html"; document.head.append(m);`,
	k: `m.httpEquiv = "refresh"; m.setAttribute("content", "0;url=" + location.origin + "/landed-k.html"); document.head.append(m);`,
};

export default [
	routesTest("rv13-misc-meta-refresh", {
		"/": `<!doctype html><body>${Object.keys(REFRESH)
			.map((k) => `<iframe id="f${k}" src="/r-${k}.html"></iframe>`)
			.join("")}
<script>${T}
runTest(async () => {
	await sleep(2500);
	for (const k of ${JSON.stringify(Object.keys(REFRESH))}) {
		const f = document.getElementById("f" + k);
		assertConsistent("refresh-" + k, T(() => new URL(f.contentWindow.location.href).pathname + " leaf=" + f.contentWindow.LEAF));
	}
}, true);
</script></body>`,
		...Object.fromEntries(
			Object.entries(REFRESH).map(([k, js]) => [
				`/r-${k}.html`,
				`<!doctype html><head></head><body>r-${k}<script>window.LEAF="r-${k}"; const m = document.createElement("meta"); ${js}</script></body>`,
			])
		),
		...Object.fromEntries(
			["a", "b", "c", "d", "e", "f", "g", "h", "h2", "i", "j", "k"].map((k) => [
				`/landed-${k}.html`,
				leaf("landed-" + k),
			])
		),
	}),

	// Native editing commands write attributes without going through the layer.
	routesTest("rv13-misc-editing", {
		"/": `<!doctype html><body><div id=ed contenteditable><p id=p1>hello <span id=s1 style="color: red">world</span> end</p></div>
<script>${T}
runTest(async () => {
	const ed = document.getElementById("ed");
	const sel = getSelection();
	const put = (node, a, b) => { const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b); sel.removeAllRanges(); sel.addRange(r); };
	// style change on an element whose style was mirrored by the parser
	document.execCommand("styleWithCSS", false, true);
	const s1 = document.getElementById("s1");
	put(s1.firstChild, 0, 5);
	document.execCommand("foreColor", false, "#0000ff");
	assertConsistent("foreColor", [T(() => ed.querySelector("span").getAttribute("style")), T(() => ed.innerHTML)].join(" || "));
	assertConsistent("foreColor-sel", T(() => ed.querySelectorAll('[style*="rgb(0, 0, 255)"]').length));
	// links and images created by the browser
	ed.innerHTML = "<p id=p2>abc def</p>";
	const p2 = document.getElementById("p2");
	put(p2.firstChild, 0, 3);
	document.execCommand("createLink", false, "/lnk?x=1");
	const a = ed.querySelector("a");
	assertConsistent("createLink", [T(() => a.getAttribute("href")), T(() => a.href), T(() => ed.innerHTML), T(() => a.matches('[href="/lnk?x=1"]'))].join(" || "));
	put(p2.lastChild, 1, 2);
	document.execCommand("insertImage", false, "/ins.png");
	const img = ed.querySelector("img");
	await new Promise((r) => { if (img.complete) r(); img.onload = img.onerror = r; setTimeout(r, 2000); });
	assertConsistent("insertImage", [T(() => img.getAttribute("src")), T(() => img.src), T(() => img.naturalWidth), T(() => new URL(img.currentSrc).pathname)].join(" || "));
	// insertHTML: the browser parses the markup itself
	window.RAWLOC = "unset";
	ed.innerHTML = "<p id=p3>x</p>";
	put(document.getElementById("p3").firstChild, 0, 1);
	document.execCommand("insertHTML", false, '<a href="/h">h</a><img id=ih src="/h.png"><img src="/nope" onerror="window.RAWLOC = location.href">');
	await sleep(1500);
	const ih = document.getElementById("ih");
	assertConsistent("insertHTML-a", T(() => { const x = ed.querySelector("a"); return [x.getAttribute("href"), x.href].join(" "); }));
	assertConsistent("insertHTML-img", T(() => [ih.getAttribute("src"), ih.naturalWidth, new URL(ih.currentSrc).pathname].join(" ")));
	assertConsistent("insertHTML-onerror-location", T(() => window.RAWLOC));
}, true);
</script></body>`,
	}),

	htmlTest({
		name: "rv13-misc-authored-internal",
		html: `<!doctype html><body>
<div id=pa1 title="real" scramjet-attr-title="fake"></div>
<img id=pa2 src="/r.png" scramjet-attr-src="/fake.png">
<a id=pa3 scramjet-attr-href="/fake">x</a>
<div id=pa4 scramjet-attr-nonce="n1"></div>
<meta id=pa5 name=x content="real" scramjet-attr-content="fake">
<script>${T}
runTest(async () => {
	for (const id of ["pa1", "pa2", "pa3", "pa4", "pa5"]) {
		const el = document.getElementById(id);
		assertConsistent(id, [T(() => el.getAttributeNames().join(",")), T(() => el.getAttribute("title")), T(() => el.getAttribute("src")), T(() => el.getAttribute("href")), T(() => el.getAttribute("nonce")), T(() => el.getAttribute("content")), T(() => el.outerHTML)].join(" | "));
	}
	const d = document.createElement("div");
	d.innerHTML = '<div title="real" scramjet-attr-title="fake"></div><a scramjet-attr-href="/fake">x</a>';
	assertConsistent("inner", [T(() => d.firstChild.getAttribute("title")), T(() => d.lastChild.getAttribute("href")), T(() => d.lastChild.href), T(() => d.innerHTML)].join(" | "));
	const e = document.createElement("div");
	e.setAttribute("scramjet-attr-title", "x");
	assertConsistent("set-internal", [T(() => e.getAttribute("scramjet-attr-title")), T(() => e.getAttributeNames().join()), T(() => e.hasAttributes()), T(() => e.outerHTML)].join(" | "));
	e.setAttribute("scramjet-attribute", "y");
	e.setAttribute("SCRAMJET-ATTRX", "z");
	assertConsistent("set-prefix-lookalike", [T(() => e.getAttribute("scramjet-attribute")), T(() => e.getAttribute("scramjet-attrx")), T(() => e.getAttributeNames().join()), T(() => e.outerHTML)].join(" | "));
	const f = document.createElement("div");
	f.dataset.scramjetAttrFoo = "1";
	assertConsistent("dataset", [T(() => f.getAttributeNames().join()), T(() => f.outerHTML)].join(" | "));
}, true);
</script></body>`,
	}),

	htmlTest({
		name: "rv13-misc-ns-case",
		html: `<!doctype html><body><div id=host></div>
<script>${T}
runTest(async () => {
	const host = document.getElementById("host");
	const R = (label, el) => assertConsistent(label, [T(() => el.getAttributeNames().join(",")), T(() => el.getAttribute("src")), T(() => el.getAttributeNS(null, "SRC")), T(() => el.src), T(() => el.outerHTML), T(() => el.getAttribute("style")), T(() => el.getAttribute("nonce")), T(() => el.nonce)].join(" | "));
	const i1 = document.createElement("img"); host.append(i1);
	i1.setAttribute("src", "/a.png"); i1.setAttributeNS(null, "SRC", "/b.png");
	R("setAttributeNS-upper-after", i1);
	const i2 = document.createElement("img"); host.append(i2);
	i2.setAttributeNS(null, "SRC", "/b.png");
	R("setAttributeNS-upper-only", i2);
	const i3 = document.createElement("img"); host.append(i3);
	i3.setAttribute("src", "/a.png"); const at = document.createAttributeNS(null, "SRC"); at.value = "/c.png"; i3.setAttributeNode(at);
	R("createAttributeNS-upper", i3);
	const i4 = document.createElement("img"); host.append(i4);
	i4.setAttribute("src", "/a.png"); i4.removeAttributeNS(null, "SRC");
	R("removeAttributeNS-upper", i4);
	const d1 = document.createElement("div"); host.append(d1);
	d1.setAttribute("style", "color: red"); d1.setAttributeNS(null, "Style", "color: blue");
	R("style-mixed-case", d1);
	const d2 = document.createElement("div"); host.append(d2);
	d2.setAttributeNS(null, "NONCE", "x1");
	R("nonce-upper-ns", d2);
	assertConsistent("nonce-upper-ns-has", [d2.hasAttribute("nonce"), d2.hasAttributeNS(null, "NONCE"), d2.hasAttributeNS(null, "nonce")].join());
	const d3 = document.createElement("div"); host.append(d3);
	d3.setAttribute("nonce", "x2"); d3.setAttributeNS(null, "NONCE", "x3");
	R("nonce-both", d3);
	// SVG: case-sensitive names
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); host.append(svg);
	const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); svg.append(u);
	u.setAttribute("HREF", "/u.svg#a");
	assertConsistent("svg-upper-href", [T(() => u.getAttributeNames().join()), T(() => u.getAttribute("HREF")), T(() => u.getAttribute("href")), T(() => u.href.baseVal), T(() => u.outerHTML)].join(" | "));
	u.setAttribute("xlink:href", "/v.svg#b");
	assertConsistent("svg-xlink-no-ns", [T(() => u.getAttributeNames().join()), T(() => u.getAttribute("xlink:href")), T(() => u.getAttributeNS("http://www.w3.org/1999/xlink", "href")), T(() => u.href.baseVal), T(() => u.outerHTML)].join(" | "));
	// an attribute that is prefixed but not XLink
	const u2 = document.createElementNS("http://www.w3.org/2000/svg", "use"); svg.append(u2);
	u2.setAttributeNS("urn:x", "p:href", "/w.svg#c");
	assertConsistent("svg-other-ns-href", [T(() => u2.getAttributeNames().join()), T(() => u2.getAttribute("p:href")), T(() => u2.getAttributeNS("urn:x", "href")), T(() => u2.href.baseVal), T(() => u2.outerHTML)].join(" | "));
	// MathML / unknown elements with rule-named attributes
	const mi = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi"); host.append(mi);
	mi.setAttribute("href", "/m.html"); mi.setAttribute("style", "color: red");
	assertConsistent("mathml-href", [T(() => mi.getAttribute("href")), T(() => mi.outerHTML)].join(" | "));
	const x = document.createElementNS("urn:atom", "link"); host.append(x);
	x.setAttribute("href", "https://example.test/post");
	assertConsistent("foreign-ns-link", [T(() => x.getAttribute("href")), T(() => x.getAttributeNames().join()), T(() => x.outerHTML), T(() => new XMLSerializer().serializeToString(x))].join(" | "));
	const xd = document.implementation.createDocument("http://www.w3.org/2005/Atom", "feed");
	const xl = xd.createElementNS("http://www.w3.org/2005/Atom", "link"); xl.setAttribute("href", "https://example.test/post"); xd.documentElement.append(xl);
	assertConsistent("atom-doc", [T(() => xl.getAttribute("href")), T(() => new XMLSerializer().serializeToString(xd))].join(" | "));
}, true);
</script></body>`,
	}),
];
