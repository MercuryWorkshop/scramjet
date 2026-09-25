import { serverTest, type Test } from "../../../testcommon.ts";

const PRE = `
window.__errs = [];
addEventListener("error", e => __errs.push(String(e.message)));
const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));
const loaded = (f) => new Promise(r => f.addEventListener("load", r, { once: true }));
const origin = location.origin;
`;

const cases: Record<string, string> = {
	"blank-sync-access": `const f = document.createElement("iframe"); document.body.appendChild(f);
		const w = f.contentWindow; assert(w, "contentWindow"); assertEqual(w.location.href, "about:blank"); assert(f.contentDocument, "contentDocument");
		assertEqual(f.contentDocument.readyState, "complete");
		w.eval("window.__v = location.href"); assertEqual(w.__v, "about:blank");
		assertEqual(w.parent, window, "parent"); assertEqual(w.top, window.top, "top");
		assertEqual(w.origin, origin, "origin"); assertEqual(f.contentDocument.URL, "about:blank");`,
	"blank-load-event-sync": `const f = document.createElement("iframe"); let fired = 0; f.onload = () => fired++; document.body.appendChild(f); assertEqual(fired, 1, "about:blank load fires synchronously on insert");`,
	"blank-document-write": `const f = document.createElement("iframe"); document.body.appendChild(f); const d = f.contentDocument; d.open(); d.write("<!doctype html><body><p id=x>hi</p><script>parent.__w = document.getElementById('x').textContent + ':' + location.href<\\/script></body>"); d.close(); assertEqual(window.__w, "hi:about:blank"); assertEqual(d.getElementById("x").textContent, "hi");`,
	"blank-steal-globals": `const f = document.createElement("iframe"); f.style.display = "none"; document.body.appendChild(f); const w = f.contentWindow; const L = w.location; assertEqual(typeof w.fetch, "function"); const r = await w.fetch("/data.txt").then(r => r.text()); assertEqual(r, "data"); document.body.removeChild(f);`,
	"src-property": `const f = document.createElement("iframe"); f.src = "/child.html"; const p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.contentWindow.location.href, origin + "/child.html"); assertEqual(f.src, origin + "/child.html"); assertEqual(f.getAttribute("src"), "/child.html"); assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"src-attribute-after-insert": `const f = document.createElement("iframe"); document.body.appendChild(f); const p = loaded(f); f.setAttribute("src", "/child.html"); await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"src-change": `const f = document.createElement("iframe"); f.src = "/child.html"; let p = loaded(f); document.body.appendChild(f); await p; p = loaded(f); f.src = "/child.html?2"; await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html?2");`,
	"src-about-blank": `const f = document.createElement("iframe"); f.src = "/child.html"; let p = loaded(f); document.body.appendChild(f); await p; p = loaded(f); f.src = "about:blank"; await p; assertEqual(f.contentWindow.location.href, "about:blank"); assertEqual(f.src, "about:blank"); f.contentWindow.eval("window.__q = typeof location.href"); assertEqual(f.contentWindow.__q, "string");`,
	"srcdoc-property": `const f = document.createElement("iframe"); f.srcdoc = "<p id=s>sd</p><script>window.__sd = location.href + '|' + document.getElementById('s').textContent<\\/script>"; const p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.contentWindow.__sd, "about:srcdoc|sd"); assertEqual(f.srcdoc, "<p id=s>sd</p><script>window.__sd = location.href + '|' + document.getElementById('s').textContent<\\/script>");`,
	"srcdoc-attribute": `const f = document.createElement("iframe"); f.setAttribute("srcdoc", "<script>window.__sd = location.href<\\/script>"); const p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.contentWindow.__sd, "about:srcdoc"); assertEqual(f.getAttribute("srcdoc"), "<script>window.__sd = location.href<\\/script>");`,
	"srcdoc-relative-base": `const f = document.createElement("iframe"); f.srcdoc = "<a id=a href='/x'>x</a>"; const p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.contentDocument.getElementById("a").href, origin + "/x"); assertEqual(f.contentDocument.baseURI, location.href);`,
	"name-property": `const f = document.createElement("iframe"); f.name = "rv8frame"; f.src = "/child.html"; const p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.name, "rv8frame"); assertEqual(f.getAttribute("name"), "rv8frame"); assertEqual(f.contentWindow.name, "rv8frame"); assertEqual(window.frames["rv8frame"], f.contentWindow); assertEqual(f.contentWindow.__name, "rv8frame");`,
	"name-target-link": `const f = document.createElement("iframe"); f.name = "tgt"; document.body.appendChild(f); const p = loaded(f); const a = document.createElement("a"); a.href = "/child.html"; a.target = "tgt"; document.body.appendChild(a); a.click(); await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"window-open-name": `const f = document.createElement("iframe"); f.name = "tgt2"; document.body.appendChild(f); const p = loaded(f); const w = window.open("/child.html", "tgt2"); await p; assertEqual(w, f.contentWindow); assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"sandbox-scripts": `const f = document.createElement("iframe"); f.sandbox = "allow-scripts allow-same-origin"; f.src = "/child.html"; const p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html"); assertEqual(f.getAttribute("sandbox"), "allow-scripts allow-same-origin"); assertEqual(f.sandbox.value, "allow-scripts allow-same-origin");`,
	"sandbox-noscripts-srcdoc": `const f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-same-origin"); f.srcdoc = "<p id=p>static</p>"; const p = loaded(f); document.body.appendChild(f); await Promise.race([p, tick(3000)]); assertEqual(f.contentDocument && f.contentDocument.getElementById("p") && f.contentDocument.getElementById("p").textContent, "static");`,
	"allow-attr": `const f = document.createElement("iframe"); f.allow = "fullscreen; autoplay"; f.allowFullscreen = true; document.body.appendChild(f); assertEqual(f.allow, "fullscreen; autoplay"); assertEqual(f.getAttribute("allow"), "fullscreen; autoplay"); assertEqual(f.allowFullscreen, true);`,
	"moved-iframe-reloads": `const f = document.createElement("iframe"); f.src = "/child.html"; let p = loaded(f); document.body.appendChild(f); await p; f.contentWindow.__marker = 1; p = loaded(f); const d = document.createElement("div"); document.body.appendChild(d); d.appendChild(f); await p; assertEqual(f.contentWindow.__marker, undefined, "reloaded"); assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"removed-readded": `const f = document.createElement("iframe"); f.src = "/child.html"; let p = loaded(f); document.body.appendChild(f); await p; f.remove(); assertEqual(f.contentWindow, null); p = loaded(f); document.body.appendChild(f); await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"moveBefore-keeps-state": `if (!document.body.moveBefore) return; const f = document.createElement("iframe"); f.src = "/child.html"; let p = loaded(f); document.body.appendChild(f); await p; f.contentWindow.__marker = 1; const d = document.createElement("div"); document.body.appendChild(d); d.moveBefore(f, null); await tick(300); assertEqual(f.contentWindow.__marker, 1, "state kept");`,
	"javascript-src-void": `const f = document.createElement("iframe"); f.src = "javascript:void(0)"; document.body.appendChild(f); await tick(300); assert(f.contentDocument, "doc"); f.contentDocument.body.innerHTML = "<b>x</b>"; assertEqual(f.contentDocument.body.textContent, "x"); assertEqual(f.src, "javascript:void(0)");`,
	"javascript-src-false": `const f = document.createElement("iframe"); f.setAttribute("src", "javascript:false"); document.body.appendChild(f); await tick(300); assert(f.contentDocument, "doc");`,
	"javascript-src-string-attr": `const f = document.createElement("iframe"); f.setAttribute("src", "javascript:'<p>js</p>'"); document.body.appendChild(f); await tick(600); assertEqual(f.contentDocument.body.textContent, "js");`,
	"javascript-src-code": `const f = document.createElement("iframe"); f.src = "javascript:parent.__jr = 1; void 0"; document.body.appendChild(f); await tick(600); assertEqual(window.__jr, 1);`,
	"detached-doc-iframe": `const doc = document.implementation.createHTMLDocument("x"); const f = doc.createElement("iframe"); f.src = "/child.html"; const p = loaded(f); document.body.appendChild(document.adoptNode(f)); await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html");`,
	"innerHTML-iframe": `const d = document.createElement("div"); d.innerHTML = "<iframe src='/child.html' name='ih'></iframe>"; const f = d.firstChild; const p = loaded(f); document.body.appendChild(d); await p; assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html"); assertEqual(d.innerHTML, '<iframe src="/child.html" name="ih"></iframe>');`,
	"parsed-iframe": `const f = document.getElementById("pf"); if (!f.contentWindow.__child) await loaded(f); assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html"); assertEqual(f.src, origin + "/child.html"); assertEqual(f.getAttribute("src"), "/child.html");`,
	"nested-frame-parent": `const f = document.createElement("iframe"); f.src = "/nest.html"; const p = loaded(f); document.body.appendChild(f); await p; await tick(500); assertEqual(window.__nested, "ok");`,
	"child-postmessage-to-parent": `const f = document.createElement("iframe"); const got = new Promise(r => addEventListener("message", e => { if (e.data && e.data.rv8) r(e); })); f.src = "/pm.html"; document.body.appendChild(f); const e = await got; assertEqual(e.source, f.contentWindow); assertEqual(e.origin, origin); assertEqual(e.data.rv8, origin + "/pm.html");`,
	"yt-iframe-api-pattern": `window.onYouTubeIframeAPIReady = () => { window.__ytready = 1 }; const tag = document.createElement("script"); tag.src = "/ytapi.js"; const first = document.getElementsByTagName("script")[0]; first.parentNode.insertBefore(tag, first); await tick(800); assertEqual(window.__ytready, 1); const f = document.createElement("iframe"); f.id = "player"; f.src = "/child.html?enablejsapi=1&origin=" + encodeURIComponent(origin); const p = loaded(f); document.body.appendChild(f); await p; f.contentWindow.postMessage(JSON.stringify({event:"listening"}), "*"); assertEqual(f.contentWindow.__child, "child:" + origin + "/child.html?enablejsapi=1&origin=" + encodeURIComponent(origin));`,
	"touch-before-load": `const f = document.createElement("iframe"); f.src = "/child.html"; const p = loaded(f); document.body.appendChild(f); const w = f.contentWindow; void f.contentDocument; await p; assertEqual(f.contentWindow, w, "same window"); assertEqual(w.__child, "child:" + origin + "/child.html", "child script saw its own URL"); assertEqual(w.location.href, origin + "/child.html"); const r = await w.fetch("/data.txt").then(r => r.text()); assertEqual(r, "data", "child fetch proxied");`,
	"touch-before-load-noerr": `const f = document.createElement("iframe"); f.src = "/child.html"; const p = loaded(f); document.body.appendChild(f); void f.contentWindow.document; await p; await tick(300);`,
	"contentWindow-before-insert": `const f = document.createElement("iframe"); assertEqual(f.contentWindow, null); assertEqual(f.contentDocument, null);`,
	"object-data": `const o = document.createElement("object"); o.data = "/child.html"; o.type = "text/html"; const p = loaded(o); document.body.appendChild(o); await p; assertEqual(o.contentWindow.__child, "child:" + origin + "/child.html"); assertEqual(o.data, origin + "/child.html");`,
};

const tests: Test[] = [];
for (const [name, js] of Object.entries(cases)) {
	tests.push(
		serverTest({
			name: `rv8p2-frame-${name}`,
			async start(server) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					const html = (b: string) => {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(b);
					};
					if (u.pathname === "/") {
						html(`<!DOCTYPE html><html><head></head><body>
${name === "parsed-iframe" ? `<iframe id="pf" src="/child.html"></iframe>` : ""}
<script>${PRE}</script>
<script>
runTest(async () => {
  await (async () => { ${js} })();
  assertDeepEqual(__errs, [], "errors: " + __errs.join(" | "));
  pass();
}, false);
</script></body></html>`);
					} else if (u.pathname === "/child.html") {
						html(
							`<!DOCTYPE html><body>child<script>window.__child = "child:" + location.href; window.__name = window.name;</script></body>`
						);
					} else if (u.pathname === "/nest.html") {
						html(
							`<!DOCTYPE html><body><iframe src="/nest2.html"></iframe></body>`
						);
					} else if (u.pathname === "/nest2.html") {
						html(
							`<!DOCTYPE html><body><script>top.__nested = (parent.parent === top && top.location.href === top.__expectTop) ? "ok" : "bad:" + top.location.href; if (top.__nested !== "ok" && top.location.href === parent.parent.location.href) top.__nested = "ok";</script></body>`
						);
					} else if (u.pathname === "/pm.html") {
						html(
							`<!DOCTYPE html><body><script>parent.postMessage({ rv8: location.href }, "*");</script></body>`
						);
					} else if (u.pathname === "/ytapi.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							`window.YT = { Player: function(){} }; if (window.onYouTubeIframeAPIReady) onYouTubeIframeAPIReady();`
						);
					} else if (u.pathname === "/data.txt") {
						res.writeHead(200, {
							"Content-Type": "text/plain",
						});
						res.end("data");
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
