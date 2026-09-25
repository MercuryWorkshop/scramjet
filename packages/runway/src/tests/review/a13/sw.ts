import { serverTest } from "../../../testcommon.ts";

// Mirrors written by the SW-side HTML rewriter: duplicate attributes, case,
// attribute merging on html/body, noscript/template/foreignObject content,
// and the "deferred styles" noscript pattern.

const PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
function page(
	name: string,
	html: string,
	extra: Record<string, [string, string]> = {}
) {
	const t = serverTest({
		name,
		async start(server) {
			server.on("request", (req, res) => {
				const path = (req.url || "/").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(html);
				} else if (extra[path]) {
					res.writeHead(200, {
						"Content-Type": extra[path][0],
					});
					res.end(extra[path][1]);
				} else if (path.endsWith(".png")) {
					res.writeHead(200, {
						"Content-Type": "image/png",
					});
					res.end(Buffer.from(PNG, "base64"));
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	});
	t.timeoutMs = 60000;
	return t;
}
const T = String.raw`const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const path = (u) => { try { const x = new URL(u); return x.pathname + x.search + x.hash; } catch { return u; } };`;

export default [
	page(
		"rv13-sw-duplicates",
		`<!doctype html><html style="color: green" data-h=1><head></head><body style="margin: 1px" onload="window.BL=1">
<a id=a1 href="/first" href="/second">dup</a>
<a id=a2 HREF="/upper" href="/lower">case</a>
<img id=i1 src="/one.png" SRC="/two.png">
<a id=a3 href="/x" scramjet-attr-href="/y">pre-mirrored</a>
<div id=d1 style="color: red" style="color: blue">dup style</div>
<body style="padding: 2px" onclick="window.BC=1" class=second>
<html style="font-size: 20px" lang=xx>
<script>${T}
runTest(async () => {
	await sleep(300);
	for (const id of ["a1", "a2", "i1", "a3", "d1"]) {
		const el = document.getElementById(id);
		assertConsistent(id, [T(() => el.getAttributeNames().join()), T(() => el.getAttribute("href") ?? el.getAttribute("src") ?? el.getAttribute("style")), T(() => path(el.href ?? el.src ?? "")), T(() => el.outerHTML)].join(" | "));
	}
	assertConsistent("body", [T(() => document.body.getAttributeNames().join()), T(() => document.body.getAttribute("style")), T(() => document.body.getAttribute("onclick")), T(() => document.body.style.cssText), T(() => window.BL)].join(" | "));
	assertConsistent("html", [T(() => document.documentElement.getAttributeNames().join()), T(() => document.documentElement.getAttribute("style")), T(() => document.documentElement.getAttribute("lang"))].join(" | "));
	document.body.click();
	assertConsistent("body-onclick-ran", T(() => window.BC));
}, true);
</script></body></html>`
	),

	page(
		"rv13-sw-containers",
		`<!doctype html><html><head>
<noscript id=ds><link rel="stylesheet" href="/deferred.css"><img src="/ns.png"></noscript>
</head><body>
<template id=tp><a href="/in-template" style="color: red">t</a><img src="/tp.png"></template>
<svg><foreignObject><a id=fo href="/fo" xmlns="http://www.w3.org/1999/xhtml">fo</a></foreignObject></svg>
<math><mi><a id=mm href="/mm">m</a></mi></math>
<iframe id=sd srcdoc="<a id=in href='/in-srcdoc' target=_top>i</a><img src='/sd.png'><iframe srcdoc='&lt;a href=&quot;/deep&quot;&gt;d&lt;/a&gt;'></iframe>"></iframe>
<div id=target></div>
<p id=probe>probe</p>
<script>${T}
runTest(async () => {
	await sleep(500);
	const ds = document.getElementById("ds");
	assertConsistent("noscript textContent", T(() => ds.textContent));
	assertConsistent("noscript innerHTML", T(() => ds.innerHTML));
	// the PageSpeed / web.dev "deferred styles" idiom
	const r = document.createElement("div");
	r.innerHTML = ds.textContent;
	document.body.appendChild(r);
	await sleep(800);
	assertConsistent("deferred-styles applied", T(() => getComputedStyle(document.getElementById("probe")).color));
	assertConsistent("deferred link", T(() => { const l = r.querySelector("link"); return [l.getAttribute("href"), path(l.href), !!l.sheet].join(" "); }));
	const tp = document.getElementById("tp").content;
	assertConsistent("template", T(() => Array.from(tp.children).map((e) => e.getAttributeNames().join() + "=" + (e.getAttribute("href") ?? e.getAttribute("src"))).join(" ; ")));
	assertConsistent("template innerHTML", T(() => document.getElementById("tp").innerHTML));
	const clone = document.importNode(tp, true);
	document.getElementById("target").append(clone);
	assertConsistent("template clone", T(() => { const a = document.querySelector("#target a"); return [a.getAttribute("href"), path(a.href), a.getAttribute("style")].join(" "); }));
	assertConsistent("foreignObject", T(() => { const a = document.getElementById("fo"); return [a.getAttribute("href"), path(a.href), a.getAttributeNames().join()].join(" "); }));
	assertConsistent("mathml", T(() => { const a = document.getElementById("mm"); return [a.getAttribute("href"), path(a.href), a.getAttributeNames().join()].join(" "); }));
	const sd = document.getElementById("sd");
	assertConsistent("srcdoc attr", T(() => sd.getAttribute("srcdoc")));
	assertConsistent("srcdoc prop", T(() => sd.srcdoc));
	assertConsistent("srcdoc inner", T(() => { const a = sd.contentDocument.getElementById("in"); return [a.getAttribute("href"), path(a.href), a.getAttribute("target"), a.target].join(" "); }));
	assertConsistent("srcdoc nested", T(() => { const f = sd.contentDocument.querySelector("iframe"); return [f.getAttribute("srcdoc"), f.contentDocument.querySelector("a").getAttribute("href"), path(f.contentDocument.querySelector("a").href)].join(" | "); }));
}, true);
</script></body></html>`,
		{
			"/deferred.css": ["text/css", "#probe { color: rgb(1, 2, 3) }"],
		}
	),
];
