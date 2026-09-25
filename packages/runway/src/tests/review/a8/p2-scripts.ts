import { serverTest, type Test } from "../../../testcommon.ts";

// Pass 2: dynamically inserted scripts. Each case records into window.__log
// [key, rewritten?] where rewritten? checks location.href matches the page's
// proxied view (an unrewritten script sees the proxy URL).
const PRE = `
window.__log = []; window.__errs = [];
window.__expect = location.href;
window.__mark = (k) => __log.push(k + ":" + (location.href === __expect ? "rw" : "RAW"));
addEventListener("error", e => __errs.push(String(e.message)));
const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));
const code = (k) => "__mark(" + JSON.stringify(k) + ")";
`;

const cases: Record<
	string,
	{
		js: string;
		expect: string[];
	}
> = {
	"append-text-before-insert": {
		js: `const s = document.createElement("script"); s.textContent = code("a"); document.head.appendChild(s);`,
		expect: ["a:rw"],
	},
	"append-text-after-insert": {
		js: `const s = document.createElement("script"); document.head.appendChild(s); s.textContent = code("a");`,
		expect: ["a:rw"],
	},
	"text-prop-before": {
		js: `const s = document.createElement("script"); s.text = code("a"); document.body.append(s);`,
		expect: ["a:rw"],
	},
	"text-prop-after": {
		js: `const s = document.createElement("script"); document.body.append(s); s.text = code("a");`,
		expect: ["a:rw"],
	},
	"innertext-after": {
		js: `const s = document.createElement("script"); document.body.prepend(s); s.innerText = code("a");`,
		expect: ["a:rw"],
	},
	"textnode-before": {
		js: `const s = document.createElement("script"); s.appendChild(document.createTextNode(code("a"))); document.body.appendChild(s);`,
		expect: ["a:rw"],
	},
	"textnode-after": {
		js: `const s = document.createElement("script"); document.body.appendChild(s); s.appendChild(document.createTextNode(code("a")));`,
		expect: ["a:rw"],
	},
	"two-textnodes-after": {
		js: `const s = document.createElement("script"); document.body.appendChild(s); s.appendChild(document.createTextNode(code("a"))); s.appendChild(document.createTextNode(";__mark('b')"));`,
		expect: ["a:rw"],
	},
	"append-string-after": {
		js: `const s = document.createElement("script"); document.body.appendChild(s); s.append(code("a"));`,
		expect: ["a:rw"],
	},
	"innerhtml-script-prop": {
		js: `const s = document.createElement("script"); s.innerHTML = code("a"); document.body.appendChild(s);`,
		expect: ["a:rw"],
	},
	insertBefore: {
		js: `const s = document.createElement("script"); s.text = code("a"); document.head.insertBefore(s, document.head.firstChild);`,
		expect: ["a:rw"],
	},
	"before-after-replaceWith": {
		js: `const d = document.createElement("div"); document.body.appendChild(d);
		const a = document.createElement("script"); a.text = code("a");
		const b = document.createElement("script"); b.text = code("b");
		const c = document.createElement("script"); c.text = code("c");
		d.before(a); d.after(b); d.replaceWith(c);`,
		expect: ["a:rw", "b:rw", "c:rw"],
	},
	replaceChildren: {
		js: `const d = document.createElement("div"); document.body.appendChild(d); const a = document.createElement("script"); a.text = code("a"); d.replaceChildren(a);`,
		expect: ["a:rw"],
	},
	insertAdjacentElement: {
		js: `const a = document.createElement("script"); a.text = code("a"); document.body.insertAdjacentElement("beforeend", a);`,
		expect: ["a:rw"],
	},
	"insertAdjacentHTML-noexec": {
		js: `document.body.insertAdjacentHTML("beforeend", "<script>__mark('a')<\\/script>");`,
		expect: [],
	},
	"innerHTML-noexec-then-clone": {
		js: `const d = document.createElement("div"); d.innerHTML = "<script>__mark('a')<\\/script>"; document.body.appendChild(d);
		const old = d.querySelector("script"); const n = document.createElement("script"); n.text = old.text; old.replaceWith(n);`,
		expect: ["a:rw"],
	},
	"jquery-style-reexec": {
		js: `const d = document.createElement("div"); d.innerHTML = "<p>x</p><script>__mark('a')<\\/script>";
		for (const old of d.querySelectorAll("script")) { const n = document.createElement("script"); n.textContent = old.textContent || old.text || old.innerHTML || ""; document.head.appendChild(n).parentNode.removeChild(n); }`,
		expect: ["a:rw"],
	},
	"range-insertNode": {
		js: `const r = document.createRange(); r.selectNodeContents(document.body); r.collapse(false); const a = document.createElement("script"); a.text = code("a"); r.insertNode(a);`,
		expect: ["a:rw"],
	},
	"range-createContextualFragment": {
		js: `const r = document.createRange(); r.selectNode(document.body); const f = r.createContextualFragment("<script>__mark('a')<\\/script>"); document.body.appendChild(f);`,
		expect: ["a:rw"],
	},
	"clone-inserted-noexec": {
		js: `const a = document.createElement("script"); a.text = code("a"); document.body.appendChild(a); document.body.appendChild(a.cloneNode(true));`,
		expect: ["a:rw"],
	},
	"clone-fresh-exec": {
		js: `const a = document.createElement("script"); a.text = code("a"); const c = a.cloneNode(true); document.body.appendChild(c);`,
		expect: ["a:rw"],
	},
	"clone-parsed-exec": {
		js: `const c = document.getElementById("parsed").cloneNode(true); document.body.appendChild(c);`,
		expect: ["p:rw"],
	},
	"importNode-template": {
		js: `const t = document.createElement("template"); t.innerHTML = "<script>__mark('a')<\\/script>"; document.body.appendChild(document.importNode(t.content, true));`,
		expect: ["a:rw"],
	},
	"template-clone": {
		js: `const t = document.createElement("template"); t.innerHTML = "<script>__mark('a')<\\/script>"; document.body.appendChild(t.content.cloneNode(true));`,
		expect: ["a:rw"],
	},
	"template-parsed-clone": {
		js: `document.body.appendChild(document.getElementById("tpl").content.cloneNode(true));`,
		expect: ["t:rw"],
	},
	"domparser-adopt": {
		js: `const doc = new DOMParser().parseFromString("<script>__mark('a')<\\/script>", "text/html"); const s = doc.querySelector("script"); document.body.appendChild(document.adoptNode(s));`,
		expect: [],
	},
	"domparser-import": {
		js: `const doc = new DOMParser().parseFromString("<script>__mark('a')<\\/script>", "text/html"); const s = doc.querySelector("script"); document.body.appendChild(document.importNode(s, true));`,
		expect: ["a:rw"],
	},
	"fragment-append": {
		js: `const f = document.createDocumentFragment(); const a = document.createElement("script"); a.text = code("a"); const b = document.createElement("script"); b.text = code("b"); f.append(a, b); document.body.appendChild(f);`,
		expect: ["a:rw", "b:rw"],
	},
	moveBefore: {
		js: `const a = document.createElement("script"); a.text = code("a"); document.body.appendChild(a); if (document.body.moveBefore) document.head.moveBefore ? document.body.moveBefore(a, document.body.firstChild) : 0;`,
		expect: ["a:rw"],
	},
	"remove-readd": {
		js: `const a = document.createElement("script"); a.text = code("a"); document.body.appendChild(a); a.remove(); document.body.appendChild(a);`,
		expect: ["a:rw"],
	},
	"type-change-json-to-js": {
		js: `const a = document.createElement("script"); a.type = "text/plain"; a.text = code("a"); document.body.appendChild(a); a.type = "text/javascript"; const b = document.createElement("script"); b.text = a.text; document.body.appendChild(b);`,
		expect: ["a:rw"],
	},
	"type-set-after-text": {
		js: `const a = document.createElement("script"); a.text = code("a"); a.type = "module"; document.body.appendChild(a); await tick(200);`,
		expect: ["a:rw"],
	},
	"type-plain-then-js-before-insert": {
		js: `const a = document.createElement("script"); a.type = "text/x-template"; a.text = code("a"); a.type = "text/javascript"; document.body.appendChild(a);`,
		expect: ["a:rw"],
	},
	"setAttribute-type-after-text": {
		js: `const a = document.createElement("script"); a.text = code("a"); a.setAttribute("type", "text/babel"); document.body.appendChild(a); assertEqual(a.text, code("a"), "text readback");`,
		expect: [],
	},
	"json-script-readback": {
		js: `const a = document.createElement("script"); a.type = "application/json"; a.textContent = '{"location":1}'; document.body.appendChild(a); assertEqual(JSON.parse(a.textContent).location, 1); assertEqual(JSON.parse(document.getElementById("ld").textContent).url, "https://x/"); `,
		expect: [],
	},
	nomodule: {
		js: `const a = document.createElement("script"); a.noModule = true; a.text = code("a"); document.body.appendChild(a);`,
		expect: [],
	},
	"module-inline": {
		js: `const a = document.createElement("script"); a.type = "module"; a.text = code("a") + "; export {}"; document.body.appendChild(a); await tick(300);`,
		expect: ["a:rw"],
	},
	"src-before-insert": {
		js: `await new Promise((res, rej) => { const a = document.createElement("script"); a.src = "/ext.js?k=a"; a.onload = res; a.onerror = () => rej(new Error("onerror")); document.head.appendChild(a); });`,
		expect: ["a:rw"],
	},
	"src-after-insert": {
		js: `await new Promise((res, rej) => { const a = document.createElement("script"); document.head.appendChild(a); a.onload = res; a.onerror = () => rej(new Error("onerror")); a.src = "/ext.js?k=a"; setTimeout(res, 1500); });`,
		expect: ["a:rw"],
	},
	"src-setAttribute": {
		js: `await new Promise((res, rej) => { const a = document.createElement("script"); a.setAttribute("src", "/ext.js?k=a"); a.addEventListener("load", res); a.onerror = () => rej(new Error("onerror")); document.head.appendChild(a); });`,
		expect: ["a:rw"],
	},
	"src-404-onerror": {
		js: `const r = await new Promise((res) => { const a = document.createElement("script"); a.src = "/nope.js"; a.onload = () => res("load"); a.onerror = () => res("error"); document.head.appendChild(a); setTimeout(() => res("none"), 3000); }); __log.push(r);`,
		expect: ["error"],
	},
	"src-async-false-order": {
		js: `await new Promise((res) => { for (const k of ["x","y","z"]) { const a = document.createElement("script"); a.src = "/ext.js?k=" + k + "&delay=" + (k === "x" ? 300 : 0); a.async = false; if (k === "z") a.onload = res; document.head.appendChild(a); } });`,
		expect: ["x:rw", "y:rw", "z:rw"],
	},
	"currentScript-inline": {
		js: `const a = document.createElement("script"); a.id = "me"; a.text = "__log.push('cs:' + (document.currentScript && document.currentScript.id) + ':' + document.currentScript.text.length)"; document.body.appendChild(a);`,
		expect: ["cs:me:81"],
	},
	"currentScript-src": {
		js: `await new Promise((res) => { const a = document.createElement("script"); a.id = "ext"; a.src = "/cs.js"; a.onload = res; document.head.appendChild(a); });`,
		expect: ["cs:ext:/cs.js"],
	},
	"syntax-error-event": {
		js: `window.onerror = (m, f, l, c, e) => { __log.push("onerror:" + (e && e.name) + ":" + (f === location.href ? "file-ok" : "file=" + f)); return true; };
		const a = document.createElement("script"); a.text = "var x = ;"; document.body.appendChild(a); window.onerror = null; __errs.length = 0;`,
		expect: ["onerror:SyntaxError:file-ok"],
	},
	"runtime-error-event": {
		js: `window.onerror = (m, f, l, c, e) => { __log.push("onerror:" + (e && e.name) + ":" + (f === location.href ? "file-ok" : "file=" + f)); return true; };
		const a = document.createElement("script"); a.text = "null.x"; document.body.appendChild(a); window.onerror = null; __errs.length = 0;`,
		expect: ["onerror:TypeError:file-ok"],
	},
	"src-error-filename": {
		js: `window.onerror = (m, f, l, c, e) => { __log.push("onerror:" + l + ":" + (f === new URL("/throw.js", location.href).href ? "file-ok" : "file=" + f)); return true; };
		await new Promise((res) => { const a = document.createElement("script"); a.src = "/throw.js"; a.onload = res; a.onerror = res; document.head.appendChild(a); }); window.onerror = null; __errs.length = 0;`,
		expect: ["onerror:2:file-ok"],
	},
	"svg-script": {
		js: `const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const s = document.createElementNS("http://www.w3.org/2000/svg", "script"); s.textContent = code("a"); svg.appendChild(s); document.body.appendChild(svg);`,
		expect: ["a:rw"],
	},
	"integrity-inline": {
		js: `const a = document.createElement("script"); a.integrity = "sha256-AAAA"; a.text = code("a"); document.body.appendChild(a);`,
		expect: ["a:rw"],
	},
	"crossorigin-src": {
		js: `await new Promise((res, rej) => { const a = document.createElement("script"); a.crossOrigin = "anonymous"; a.src = "/ext.js?k=a"; a.onload = res; a.onerror = () => rej(new Error("onerror")); document.head.appendChild(a); });`,
		expect: ["a:rw"],
	},
	nonce: {
		js: `const a = document.createElement("script"); a.nonce = "abc"; a.text = code("a"); document.body.appendChild(a); assertEqual(a.nonce, "abc", "nonce readback");`,
		expect: ["a:rw"],
	},
	"document-write-inline": {
		js: `/* see parsed doc */`,
		expect: ["w:rw", "ws:rw"],
	},
	"gtm-snippet": {
		js: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='/ext.js?k=gtm'+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-XXXX');
		await tick(800);`,
		expect: ["gtm:rw"],
	},
	"webpack-jsonp": {
		js: `await new Promise((res, rej) => { var s = document.createElement('script'); s.charset = 'utf-8'; s.timeout = 120; s.setAttribute("data-webpack", "app:chunk-1"); s.src = "/ext.js?k=chunk"; var done = (e) => { s.onerror = s.onload = null; e.type === "load" ? res() : rej(new Error("chunk failed")); }; s.onerror = done; s.onload = done; document.head.appendChild(s); });`,
		expect: ["chunk:rw"],
	},
	"script-text-readback-after-run": {
		js: `const a = document.createElement("script"); a.text = "__mark('a'); var q = location.href"; document.body.appendChild(a); assertEqual(a.text, "__mark('a'); var q = location.href"); assertEqual(a.textContent, "__mark('a'); var q = location.href"); assertEqual(a.innerHTML, "__mark('a'); var q = location.href"); assertEqual(a.firstChild.data, "__mark('a'); var q = location.href");`,
		expect: ["a:rw"],
	},
	"parsed-script-readback": {
		js: `const p = document.getElementById("parsed"); assertEqual(p.text, "__mark('p')"); assertEqual(p.textContent, "__mark('p')"); assertEqual(p.innerHTML, "__mark('p')"); assertEqual(p.outerHTML, '<script id="parsed">__mark(\\'p\\')<\\/script>'); __log.length = 0;`,
		expect: [],
	},
	"textnode-data-change-no-rerun": {
		js: `const a = document.createElement("script"); a.text = code("a"); document.body.appendChild(a); a.firstChild.data = code("b"); a.appendChild(document.createTextNode(";__mark('c')")); a.text = code("d");`,
		expect: ["a:rw"],
	},
};

const tests: Test[] = [];
for (const [name, c] of Object.entries(cases)) {
	tests.push(
		serverTest({
			name: `rv8p2-script-${name}`,
			async start(server) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					if (u.pathname === "/") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<!DOCTYPE html><html><head>
<script type="application/ld+json" id="ld">{"url":"https://x/"}</script>
</head><body>
<script>${PRE}</script>
<template id="tpl"><script>__mark('t')</script></template>
<script id="parsed">__mark('p')</script>
<script>__log.length = 0;</script>
${name === "document-write-inline" ? `<script>document.write("<script>__mark('w')<\\/script>"); document.write('<script src="/ext.js?k=ws"><\\/script>');</script>` : ""}
<script>
runTest(async () => {
  ${name === "document-write-inline" ? "" : "__log.length = 0;"}
  ${c.js}
  await tick(300);
  assertDeepEqual(__errs, [], "errors: " + __errs.join(" | "));
  assertDeepEqual(__log, ${JSON.stringify(c.expect)}, "log: " + JSON.stringify(__log));
  pass();
}, false);
</script></body></html>`);
					} else if (u.pathname === "/ext.js") {
						const k = u.searchParams.get("k");
						const delay = +(u.searchParams.get("delay") || 0);
						setTimeout(() => {
							res.writeHead(200, {
								"Content-Type": "application/javascript",
							});
							res.end(`__mark(${JSON.stringify(k)})`);
						}, delay);
					} else if (u.pathname === "/cs.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							`__log.push("cs:" + document.currentScript.id + ":" + document.currentScript.getAttribute("src"))`
						);
					} else if (u.pathname === "/throw.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(`var a = 1;\nnull.boom;\n`);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
			},
		})
	);
}
export default tests;
