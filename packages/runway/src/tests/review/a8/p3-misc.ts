import { serverTest, type Test } from "../../../testcommon.ts";

const PRE = `
window.__errs = [];
addEventListener("error", e => __errs.push(String(e.message)));
const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));
const origin = location.origin;
const blobWorker = (src, opts) => new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })), opts);
`;

const cases: Record<string, string> = {
	"worker-postMessage-transfer-list": `const w = blobWorker("onmessage = e => postMessage(e.data.byteLength + ':' + (e.data instanceof ArrayBuffer))");
		const buf = new ArrayBuffer(8); const got = new Promise(r => w.onmessage = e => r(e.data)); w.postMessage(buf, [buf]); assertEqual(buf.byteLength, 0, "transferred"); assertEqual(await got, "8:true");`,
	"worker-postMessage-transfer-options": `const w = blobWorker("onmessage = e => postMessage(e.data.byteLength)");
		const buf = new ArrayBuffer(4); const got = new Promise(r => w.onmessage = e => r(e.data)); w.postMessage(buf, { transfer: [buf] }); assertEqual(buf.byteLength, 0); assertEqual(await got, 4);`,
	"worker-self-postMessage-transfer": `const w = blobWorker("const b = new ArrayBuffer(16); postMessage(b, [b]); self.postMessage({n:1}, { transfer: [] });");
		const msgs = []; await new Promise(r => w.onmessage = e => { msgs.push(e.data instanceof ArrayBuffer ? e.data.byteLength : e.data.n); if (msgs.length === 2) r(); }); assertDeepEqual(msgs, [16, 1]);`,
	"worker-postMessage-no-second-arg": `const w = blobWorker("onmessage = e => postMessage(e.data)"); const got = new Promise(r => w.onmessage = e => r(e.data)); w.postMessage({a:1}); assertDeepEqual(await got, {a:1});`,
	"worker-postMessage-undefined-second": `const w = blobWorker("onmessage = e => postMessage(e.data)"); const got = new Promise(r => w.onmessage = e => r(e.data)); w.postMessage(5, undefined); assertEqual(await got, 5);`,
	"messageport-transfer": `const ch = new MessageChannel(); const buf = new ArrayBuffer(3); const got = new Promise(r => ch.port2.onmessage = e => r(e.data.byteLength)); ch.port1.postMessage(buf, [buf]); assertEqual(await got, 3);`,
	"messageport-transfer-port": `const ch = new MessageChannel(); const ch2 = new MessageChannel(); const got = new Promise(r => ch.port2.onmessage = e => { e.ports[0].postMessage("via"); }); const via = new Promise(r => ch2.port1.onmessage = e => r(e.data)); ch.port1.postMessage("p", [ch2.port2]); assertEqual(await via, "via");`,
	"window-postMessage-legacy-transfer": `const buf = new ArrayBuffer(5); const got = new Promise(r => addEventListener("message", e => { if (e.data instanceof ArrayBuffer) r(e.data.byteLength); })); window.postMessage(buf, "*", [buf]); assertEqual(await got, 5);`,
	"window-postMessage-options": `const got = new Promise(r => addEventListener("message", e => { if (e.data === "opt") r(e.origin); })); window.postMessage("opt", { targetOrigin: "*" }); assertEqual(await got, origin);`,
	"window-postMessage-port-transfer": `const ch = new MessageChannel(); const got = new Promise(r => addEventListener("message", e => { if (e.data === "port") r(e.ports.length); })); window.postMessage("port", "*", [ch.port2]); assertEqual(await got, 1);`,
	"settimeout-args-this": `const r = await new Promise(res => setTimeout(function (a, b) { res([a, b, this === window]); }, 0, 1, 2)); assertDeepEqual(r, [1, 2, true]); const id = setInterval((x) => { clearInterval(id); window.__iv = x; }, 0, "iv"); await tick(100); assertEqual(window.__iv, "iv"); assertEqual(typeof setTimeout(() => {}), "number"); window.setTimeout.call(window, () => { window.__c = 1 }, 0); await tick(50); assertEqual(window.__c, 1);`,
	"settimeout-string-extra-args": `setTimeout("window.__s = location.host", 0, "ignored"); await tick(100); assertEqual(window.__s, location.host);`,
	"importScripts-multiple": `const w = new Worker("/w.js"); const got = await new Promise((r, j) => { w.onmessage = e => r(e.data); w.onerror = e => j(new Error("worker error " + e.message)); }); assertEqual(got, "a,b");`,
	"sandbox-tokenlist-multi": `const f = document.createElement("iframe"); f.sandbox.add("allow-scripts", "allow-forms"); assertEqual(f.getAttribute("sandbox"), "allow-scripts allow-forms"); f.sandbox.remove("allow-forms", "allow-scripts"); assertEqual(f.getAttribute("sandbox"), ""); f.sandbox.add("allow-same-origin"); assertEqual(f.sandbox.contains("allow-same-origin"), true);`,
	"stylepropertymap-set-multi": `if (!window.StylePropertyMap) return; const d = document.createElement("div"); document.body.appendChild(d); d.attributeStyleMap.set("background-image", "url(img.png)"); assert(String(d.attributeStyleMap.get("background-image")).includes("img.png")); d.attributeStyleMap.set("transition-property", "opacity", "color"); assertEqual(d.style.transitionProperty, "opacity, color"); d.attributeStyleMap.append("transition-property", "width"); assertEqual(d.style.transitionProperty, "opacity, color, width");`,
	"headers-roundtrip": `const h = new Headers([["X-A", "1"], ["x-a", "2"], ["Content-Type", "text/plain"]]); const req = new Request("/echo", { method: "POST", headers: h, body: "x" }); assertEqual(req.headers.get("x-a"), "1, 2"); const res = await fetch(req); const j = await res.json(); assertEqual(j["x-a"], "1, 2"); assertEqual(j["content-type"], "text/plain"); const r2 = new Response("b", { headers: { "X-B": "y" } }); assertEqual(r2.headers.get("x-b"), "y"); assertDeepEqual([...new Headers(req.headers).keys()], ["content-type", "x-a"]);`,
	"fetch-response-headers-setcookie": `const res = await fetch("/sc"); assertEqual(res.headers.get("x-thing"), "t"); assertEqual(res.headers.get("set-cookie"), null); assertEqual(document.cookie.includes("sc1=1"), true, "cookie applied: " + document.cookie); assertEqual(document.cookie.includes("sc2=2"), true, "second cookie: " + document.cookie);`,
	"cache-addAll": `const c = await caches.open("rv8p3"); await c.addAll(["/echo?a", "/echo?b"]); const keys = await c.keys(); assertDeepEqual(keys.map(k => k.url).sort(), [origin + "/echo?a", origin + "/echo?b"]); const m = await c.match("/echo?a"); assert(m, "match"); await caches.delete("rv8p3");`,
	"referrer-meta": `const m = document.createElement("meta"); m.name = "referrer"; m.content = "no-referrer"; document.head.appendChild(m); const r = await fetch("/ref").then(r => r.text()); assertEqual(r, "none");`,
	"execCommand-iframe-selection": `const f = document.createElement("iframe"); document.body.appendChild(f); const d = f.contentDocument; d.designMode = "on"; d.body.innerHTML = "<p>hello</p>"; const range = d.createRange(); range.selectNodeContents(d.body.firstChild); const sel = f.contentWindow.getSelection(); sel.removeAllRanges(); sel.addRange(range); d.execCommand("createLink", false, "/lnk"); const a = d.querySelector("a"); assert(a, "link created"); assertEqual(a.getAttribute("href"), "/lnk"); assertEqual(a.href, origin + "/lnk");`,
	"module-src-before-type": `await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/mod.js"; s.type = "module"; s.onload = res; s.onerror = () => rej(new Error("module load error")); document.head.appendChild(s); }); await tick(200); assertEqual(window.__mod, "dep-ok");`,
	"meta-refresh-attr": `const m = document.createElement("meta"); m.httpEquiv = "refresh"; m.content = "999; url=/x"; document.head.appendChild(m); assertEqual(m.content, "999; url=/x"); assertEqual(m.getAttribute("content"), "999; url=/x");`,
	"link-modulepreload": `const l = document.createElement("link"); l.rel = "modulepreload"; l.href = "/mod.js"; const ok = await new Promise(r => { l.onload = () => r(true); l.onerror = () => r(false); document.head.appendChild(l); }); assertEqual(ok, true); assertEqual(l.href, origin + "/mod.js");`,
	"Promise-all-thenables": `const r = await Promise.all([1, Promise.resolve(2), { then(res) { res(3) } }]); assertDeepEqual(r, [1, 2, 3]);`,
	"indexeddb-databases": `const req = indexedDB.open("rv8p3db"); await new Promise(r => req.onsuccess = r); req.result.close(); const dbs = await indexedDB.databases(); assert(dbs.some(d => d.name === "rv8p3db"), JSON.stringify(dbs)); indexedDB.deleteDatabase("rv8p3db");`,
	"localStorage-keys": `localStorage.clear(); localStorage.setItem("a", "1"); localStorage.b = "2"; assertDeepEqual(Object.keys(localStorage).sort(), ["a", "b"]); assertEqual(localStorage.length, 2); localStorage.clear(); assertEqual(localStorage.length, 0);`,
	"attributes-iteration": `const d = document.createElement("div"); d.setAttribute("href", "x"); d.setAttribute("data-a", "1"); const a = document.createElement("a"); a.setAttribute("href", "/p"); a.setAttribute("id", "i"); assertDeepEqual([...a.attributes].map(x => x.name + "=" + x.value), ["href=/p", "id=i"]); assertDeepEqual(Array.from(d.attributes, x => x.name), ["href", "data-a"]); assertDeepEqual(a.getAttributeNames(), ["href", "id"]); assertDeepEqual(Object.keys(a.attributes), ["0", "1"]);`,
	"xhr-getAllResponseHeaders": `const x = new XMLHttpRequest(); x.open("GET", "/sc"); await new Promise(r => { x.onload = r; x.send(); }); const all = x.getAllResponseHeaders(); assert(all.includes("x-thing: t"), all); assert(!all.includes("set-cookie"), all);`,
};

const tests: Test[] = [];
for (const [name, js] of Object.entries(cases)) {
	tests.push(
		serverTest({
			name: `rv8p3-${name}`,
			async start(server) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					const send = (ct: string, b: string, h: Record<string, any> = {}) => {
						res.writeHead(200, {
							"Content-Type": ct,
							...h,
						});
						res.end(b);
					};
					if (u.pathname === "/") {
						send(
							"text/html",
							`<!DOCTYPE html><html><head></head><body>
<script>${PRE}</script>
<script>
runTest(async () => {
  await (async () => { ${js} })();
  assertDeepEqual(__errs, [], "errors: " + __errs.join(" | "));
  pass();
}, false);
</script></body></html>`
						);
					} else if (u.pathname === "/echo") {
						let body = "";
						req.on("data", (c) => (body += c));
						req.on("end", () =>
							send("application/json", JSON.stringify(req.headers))
						);
					} else if (u.pathname === "/sc") {
						res.writeHead(200, {
							"Content-Type": "text/plain",
							"X-Thing": "t",
							"Set-Cookie": ["sc1=1; Path=/", "sc2=2; Path=/"],
						});
						res.end("ok");
					} else if (u.pathname === "/ref") {
						send(
							"text/plain",
							req.headers.referer ? "ref:" + req.headers.referer : "none"
						);
					} else if (u.pathname === "/w.js") {
						send(
							"application/javascript",
							`importScripts("/a.js", "/b.js"); postMessage([self.A, self.B].join());`
						);
					} else if (u.pathname === "/a.js") {
						send("application/javascript", `self.A = "a";`);
					} else if (u.pathname === "/b.js") {
						send("application/javascript", `self.B = "b";`);
					} else if (u.pathname === "/mod.js") {
						send(
							"application/javascript",
							`import { v } from "./dep.js"; window.__mod = v;`
						);
					} else if (u.pathname === "/dep.js") {
						send("application/javascript", `export const v = "dep-ok";`);
					} else if (u.pathname === "/img.png") {
						res.writeHead(404);
						res.end();
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
