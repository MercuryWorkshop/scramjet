import { basicTest, serverTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + String(e.message).replace(/https?:[^ ']*/g, "URL"); } assertConsistent(label, v === undefined ? "UNDEF" : v); };
const ca = async (label, fn) => { let v; try { v = await fn(); } catch (e) { v = "THROW " + e.name; } assertConsistent(label, v === undefined ? "UNDEF" : v); };
const div = () => { const d = document.createElement("div"); document.body.append(d); return d; };
const counter = () => { const o = { n: 0, toString() { o.n++; return "/tostr"; } }; return o; };`;

export default [
	basicTest({
		name: "rv3-idl-strings",
		js: `${C}
c("innerHTML=null", () => { const d = div(); d.innerHTML = "<b>x</b>"; d.innerHTML = null; return d.innerHTML + "|" + d.childNodes.length; });
c("innerHTML=undefined", () => { const d = div(); d.innerHTML = undefined; return d.innerHTML; });
c("outerHTML=null", () => { const w = div(); const d = document.createElement("i"); w.append(d); d.outerHTML = null; return w.innerHTML; });
c("iah-null", () => { const d = div(); d.insertAdjacentHTML("beforeend", null); return d.innerHTML; });
c("iah-undef", () => { const d = div(); d.insertAdjacentHTML("beforeend", undefined); return d.innerHTML; });
c("iah-onearg", () => { const d = div(); d.insertAdjacentHTML("beforeend"); return d.innerHTML; });
c("textContent=null", () => { const d = div(); d.textContent = "x"; d.textContent = null; return JSON.stringify(d.textContent); });
c("textContent=undef", () => { const d = div(); d.textContent = undefined; return JSON.stringify(d.textContent); });
c("script.textContent=null", () => { const s = document.createElement("script"); s.type = "x"; s.textContent = null; return JSON.stringify(s.textContent) + s.childNodes.length; });
c("script.text=null", () => { const s = document.createElement("script"); s.type = "x"; s.text = null; return JSON.stringify(s.text); });
c("script.innerText=null", () => { const s = document.createElement("script"); s.type = "x"; s.innerText = null; return JSON.stringify(s.textContent); });
c("nodeValue=null", () => { const t = document.createTextNode("x"); t.nodeValue = null; return JSON.stringify(t.data); });
c("data=null", () => { const t = document.createTextNode("x"); t.data = null; return JSON.stringify(t.data); });
c("innerText=null", () => { const d = div(); d.innerText = null; return JSON.stringify(d.innerHTML); });
c("outerText=null", () => { const w = div(); const d = document.createElement("i"); w.append(d); d.outerText = null; return JSON.stringify(w.innerHTML); });
c("setAttribute-null", () => { const d = div(); d.setAttribute("title", null); d.setAttribute("data-u", undefined); return d.getAttribute("title") + "|" + d.getAttribute("data-u"); });
c("setAttribute-href-null", () => { const a = document.createElement("a"); a.setAttribute("href", null); return a.getAttribute("href") + "|" + a.pathname; });
c("setAttribute-onearg", () => { const d = div(); d.setAttribute("x"); return d.getAttribute("x"); });
c("setAttribute-tostring", () => { const a = document.createElement("a"); const o = counter(); a.setAttribute("href", o); return o.n + " " + a.getAttribute("href"); });
c("href=tostring", () => { const a = document.createElement("a"); const o = counter(); a.href = o; return o.n + " " + a.getAttribute("href"); });
c("href=null", () => { const a = document.createElement("a"); a.href = null; return a.getAttribute("href"); });
c("img.src=null", () => { const i = new Image(); i.src = null; return i.getAttribute("src"); });
c("iframe.srcdoc=null", () => { const f = document.createElement("iframe"); f.srcdoc = null; return f.getAttribute("srcdoc"); });
c("lone-surrogate-href", () => { const a = document.createElement("a"); a.href = "/a\\uD800b"; return encodeURIComponent(a.getAttribute("href")); });
c("lone-surrogate-setAttr", () => { const a = document.createElement("a"); a.setAttribute("href", "/a\\uD800b"); return a.getAttribute("href").length + ":" + a.getAttribute("href").charCodeAt(2); });
c("lone-surrogate-title", () => { const a = document.createElement("a"); a.title = "\\uD800"; return a.title.charCodeAt(0); });
c("toggle-undef", () => { const d = div(); d.classList.toggle("a", undefined); d.classList.toggle("b"); d.classList.toggle("a", undefined); return d.className; });
c("toggle-null", () => { const d = div(); d.classList.toggle("a", null); return d.className; });
c("toggleAttribute-undef", () => { const d = div(); d.toggleAttribute("x", undefined); return d.hasAttribute("x"); });
c("classList.add-null", () => { const d = div(); d.classList.add(null, undefined); return d.className; });
c("append-null", () => { const d = div(); d.append(null, undefined, 1); return d.innerHTML; });
c("append-none", () => { const d = div(); d.append(); return d.childNodes.length; });
c("insertBefore-undef", () => { const d = div(); d.append("a"); d.insertBefore(document.createElement("b"), undefined); return d.innerHTML; });
c("insertBefore-onearg", () => { const d = div(); d.insertBefore(document.createElement("b")); return d.innerHTML; });
c("appendChild-null", () => { const d = div(); d.appendChild(null); return 1; });
c("appendChild-str", () => { const d = div(); d.appendChild("x"); return 1; });
c("cloneNode-undef", () => { const d = div(); d.innerHTML = "<b>x</b>"; return d.cloneNode(undefined).childNodes.length + ":" + d.cloneNode(1).childNodes.length + ":" + d.cloneNode("").childNodes.length; });
c("importNode-undef", () => { const d = div(); d.innerHTML = "<b>x</b>"; return document.importNode(d, undefined).childNodes.length + ":" + document.importNode(d, true).childNodes.length + ":" + document.importNode(d).childNodes.length; });
c("importNode-obj", () => { const d = div(); d.innerHTML = "<b>x</b>"; return document.importNode(d, {}).childNodes.length + ":" + document.importNode(d, {selfOnly: true}).childNodes.length; });
c("createContextualFragment-null", () => document.createRange().createContextualFragment(null).textContent);
c("domparser-null", () => new DOMParser().parseFromString(null, "text/html").body.textContent);
c("domparser-badtype", () => new DOMParser().parseFromString("<p>", "text/plain"));
c("setHTMLUnsafe-null", () => { const d = div(); d.setHTMLUnsafe(null); return d.innerHTML; });
c("parseHTMLUnsafe-undef", () => Document.parseHTMLUnsafe(undefined).body.textContent);
c("docwrite-null", () => { const doc = document.implementation.createHTMLDocument(""); doc.open(); doc.write(null, undefined); doc.close(); return doc.body.textContent; });
c("docwrite-none", () => { const doc = document.implementation.createHTMLDocument(""); doc.open(); doc.write(); doc.close(); return doc.body ? doc.body.innerHTML : "nobody"; });
c("storage-null", () => { localStorage.setItem("rv3k", null); const v = localStorage.getItem("rv3k"); localStorage.removeItem("rv3k"); return v + "|" + localStorage.getItem(null) + "|" + localStorage.key(-1) + "|" + localStorage.key(undefined); });
c("storage-onearg", () => { localStorage.setItem("rv3k"); return 1; });
c("querySelector-null", () => document.querySelector(null));
c("getAttribute-null", () => { const d = div(); d.setAttribute("null", "v"); return d.getAttribute(null) + "|" + d.hasAttribute(null) + "|" + d.getAttributeNS(undefined, "null"); });
c("matches-undef", () => { const d = document.createElement("undefined"); return d.matches(undefined); });
`,
	}),
	basicTest({
		name: "rv3-idl-numbers-css",
		js: `${C}
c("substringData-neg", () => document.createTextNode("abc").substringData(-1, 2));
c("substringData-big", () => document.createTextNode("abc").substringData(2 ** 32 + 1, 1));
c("splitText-neg", () => { const t = document.createTextNode("abc"); div().append(t); return t.splitText(-1).data; });
c("insertData-float", () => { const t = document.createTextNode("abc"); t.insertData(1.9, "X"); return t.data; });
c("setProperty-null", () => { const d = div(); d.style.color = "red"; d.style.setProperty("color", null); return d.style.cssText; });
c("setProperty-prio-null", () => { const d = div(); d.style.setProperty("color", "red", null); return d.style.cssText; });
c("setProperty-prio-undef", () => { const d = div(); d.style.setProperty("color", "red", undefined); return d.style.cssText; });
c("setProperty-url", () => { const d = div(); d.style.setProperty("background-image", "url(/x.png)"); return d.style.getPropertyValue("background-image").replace(location.origin, "O"); });
c("cssText-null", () => { const d = div(); d.style.color = "red"; d.style.cssText = null; return JSON.stringify(d.style.cssText); });
c("cssText-undef", () => { const d = div(); d.style.cssText = undefined; return JSON.stringify(d.style.cssText); });
c("style=string", () => { const d = div(); d.style = "color: red; background: url(/s.png)"; return d.getAttribute("style"); });
c("style=null", () => { const d = div(); d.style.color = "red"; d.style = null; return JSON.stringify(d.getAttribute("style")); });
c("insertRule", () => { const s = document.createElement("style"); document.head.append(s); const sh = s.sheet; return sh.insertRule("a{color:red}") + "," + sh.insertRule("b{}", undefined) + "," + sh.cssRules.length + "," + sh.cssRules[0].cssText; });
c("insertRule-neg", () => { const s = document.createElement("style"); document.head.append(s); return s.sheet.insertRule("a{}", -1); });
c("addRule-none", () => { const s = document.createElement("style"); document.head.append(s); const r = s.sheet.addRule(); return r + "|" + [...s.sheet.cssRules].map(x => x.cssText).join(";"); });
c("addRule-2", () => { const s = document.createElement("style"); document.head.append(s); const r = s.sheet.addRule("p", "color: red"); return r + "|" + s.sheet.cssRules[0].cssText; });
c("addRule-null", () => { const s = document.createElement("style"); document.head.append(s); const r = s.sheet.addRule("p", null); return r + "|" + [...s.sheet.cssRules].map(x => x.cssText).join(";"); });
c("perf-byname-null", () => performance.getEntriesByName(location.href.split("#")[0].replace(/[^/]*$/, "script.js"), null).length);
c("perf-byname-undef", () => performance.getEntriesByName(location.href.split("#")[0].replace(/[^/]*$/, "script.js"), undefined).length);
c("perf-byname-str", () => performance.getEntriesByName(location.href.split("#")[0].replace(/[^/]*$/, "script.js"), "resource").length);
c("perf-byname-null-name", () => performance.getEntriesByName(null).length);
c("perf-bytype-none", () => performance.getEntriesByType().length);
c("url-undef-base", () => new URL("https://a.com/x", undefined).href);
c("url-null-base", () => new URL("x", null).href);
c("createObjectURL-bad", () => URL.createObjectURL("x"));
c("createObjectURL-none", () => URL.createObjectURL());
c("revokeObjectURL-undef", () => URL.revokeObjectURL(undefined));
c("revokeObjectURL-null", () => URL.revokeObjectURL(null));
c("revokeObjectURL-empty", () => URL.revokeObjectURL(""));
c("revokeObjectURL-http", () => URL.revokeObjectURL("https://example.com/x"));
c("revokeObjectURL-rel", () => URL.revokeObjectURL("/x"));
c("revokeObjectURL-blobnull", () => URL.revokeObjectURL("blob:null/1234"));
c("revokeObjectURL-foreign-blob", () => URL.revokeObjectURL("blob:https://example.com/1234"));
c("revokeObjectURL-real", () => { const u = URL.createObjectURL(new Blob(["x"])); URL.revokeObjectURL(u); URL.revokeObjectURL(u); return "ok"; });
c("revokeObjectURL-none", () => URL.revokeObjectURL());
c("idb-open-0", () => indexedDB.open("rv3", 0));
c("idb-open-neg", () => indexedDB.open("rv3", -1));
c("idb-open-undef", () => typeof indexedDB.open("rv3idl", undefined));
c("idb-open-float", () => { const r = indexedDB.open("rv3idl2", 2.7); return typeof r; });
c("idb-open-str", () => typeof indexedDB.open("rv3idl3", "3"));
c("idb-open-nan", () => indexedDB.open("rv3", NaN));
c("headers-null", () => new Headers(null));
c("headers-undef", () => [...new Headers(undefined)].length);
c("headers-get-null", () => new Headers({"null": "v"}).get(null));
c("request-undef", () => new Request("/r", undefined).method);
c("request-null", () => new Request("/r", null).method);
c("response-undef", () => new Response(undefined, undefined).status);
c("response-null", () => new Response(null).status);
c("ws-close-clamp", () => { const w = new WebSocket("ws://127.0.0.1:9/"); try { w.close(70000); } finally { } return "noerr"; });
c("ws-close-1000.9", () => { const w = new WebSocket("ws://127.0.0.1:9/"); w.close(1000.9); return w.readyState; });
c("ws-close-undef", () => { const w = new WebSocket("ws://127.0.0.1:9/"); w.close(undefined, undefined); return w.readyState; });
c("ws-close-str", () => { const w = new WebSocket("ws://127.0.0.1:9/"); w.close("1000"); return w.readyState; });
c("ws-proto-undef", () => new WebSocket("ws://127.0.0.1:9/", undefined).readyState);
c("ws-proto-null", () => new WebSocket("ws://127.0.0.1:9/", null).readyState);
c("ws-proto-bad", () => new WebSocket("ws://127.0.0.1:9/", "a b").readyState);
c("ws-proto-dup", () => new WebSocket("ws://127.0.0.1:9/", ["a", "a"]).readyState);
c("es-undef", () => { const e = new EventSource("/es", undefined); const r = e.withCredentials; e.close(); return r; });
c("es-null", () => { const e = new EventSource("/es", null); const r = e.withCredentials; e.close(); return r; });
c("worker-undef", () => { const w = new Worker(URL.createObjectURL(new Blob([""], {type: "text/javascript"})), undefined); w.terminate(); return 1; });
c("worker-null", () => { const w = new Worker(URL.createObjectURL(new Blob([""], {type: "text/javascript"})), null); w.terminate(); return 1; });
c("worker-badtype", () => new Worker("/w.js", { type: "bogus" }));
c("worker-noarg", () => new Worker());
c("sharedworker-str", () => { const w = new SharedWorker(URL.createObjectURL(new Blob([""], {type: "text/javascript"})), "name1"); return typeof w.port; });
c("sharedworker-undef", () => { const w = new SharedWorker(URL.createObjectURL(new Blob([""], {type: "text/javascript"})), undefined); return typeof w.port; });
c("cookie-null", () => { document.cookie = null; const has = document.cookie.split("; ").includes("null"); document.cookie = "null=; expires=Thu, 01 Jan 1970 00:00:00 GMT"; return has; });
c("bc-undef", () => { const b = new BroadcastChannel(undefined); const n = b.name; b.close(); return n; });
c("bc-none", () => new BroadcastChannel());
`,
	}),
	basicTest({
		name: "rv3-idl-async",
		js: `${C}
await ca("fetch-undef", async () => (await fetch("/script.js", undefined)).status);
await ca("fetch-null", async () => (await fetch("/script.js", null)).status);
await ca("fetch-tostring", async () => { const o = { toString() { o.n = (o.n || 0) + 1; return "/script.js"; } }; const r = await fetch(o); return r.status + " calls=" + o.n; });
await ca("fetch-none", async () => (await fetch()).status);
await ca("fetch-bad-method", async () => (await fetch("/script.js", { method: "b a d" })).status);
await ca("timeout-undef", () => new Promise(r => setTimeout(() => r("fired"), undefined)));
await ca("timeout-str", () => new Promise(r => setTimeout(() => r("fired"), "5")));
await ca("timeout-neg", () => new Promise(r => setTimeout(() => r("fired"), -5)));
await ca("timeout-huge", () => new Promise(r => { const id = setTimeout(() => r("fired-wrapped"), 2 ** 32 + 5); setTimeout(() => { clearTimeout(id); r("not-yet"); }, 200); }));
await ca("timeout-args", () => new Promise(r => setTimeout((a, b) => r(a + "," + b), 1, "x", undefined)));
await ca("timeout-noarg-fn", () => new Promise(r => setTimeout(r)).then(() => "fired"));
c("timeout-none", () => typeof setTimeout());
c("timeout-string-code", () => typeof setTimeout("window.__rv3t = 1", 0));
await new Promise(r => setTimeout(r, 30));
c("timeout-string-ran", () => window.__rv3t);
await ca("interval-undef", () => new Promise(r => { const id = setInterval(() => { clearInterval(id); r("fired"); }, undefined); }));
c("pushState-undef", () => { const before = location.href; history.pushState({a: 1}, "", undefined); return location.href === before; });
c("pushState-null", () => { const before = location.href; history.pushState({a: 1}, "", null); return location.href === before; });
c("pushState-2args", () => { const before = location.href; history.replaceState({a: 2}, ""); return location.href === before && history.state.a; });
c("pushState-1arg", () => history.pushState({}));
c("pushState-undef-title", () => { history.replaceState(null, undefined); return history.state; });
c("addEventListener-null", () => { window.addEventListener("rv3", null); window.removeEventListener("rv3", null); return 1; });
c("addEventListener-undef-cb", () => { window.addEventListener("rv3", undefined); return 1; });
c("addEventListener-onearg", () => { window.addEventListener("rv3"); return 1; });
c("addEventListener-undef-opts", () => { let n = 0; const f = () => n++; window.addEventListener("rv3x", f, undefined); window.dispatchEvent(new Event("rv3x")); window.removeEventListener("rv3x", f, undefined); window.dispatchEvent(new Event("rv3x")); return n; });
c("addEventListener-obj", () => { let n = 0; const h = { handleEvent() { n++; } }; window.addEventListener("rv3y", h); window.dispatchEvent(new Event("rv3y")); window.removeEventListener("rv3y", h); return n; });
c("addEventListener-null-opts", () => { let n = 0; const f = () => n++; window.addEventListener("rv3z", f, null); window.dispatchEvent(new Event("rv3z")); window.removeEventListener("rv3z", f, null); window.dispatchEvent(new Event("rv3z")); return n; });
c("addEventListener-str-type", () => { let n = 0; const f = () => n++; document.addEventListener(null, f); document.dispatchEvent(new Event("null")); document.removeEventListener(null, f); return n; });
await ca("postMessage-undef", () => new Promise(r => { const h = (e) => { if (e.data === "rv3pm") { removeEventListener("message", h); r("got"); } }; addEventListener("message", h); try { postMessage("rv3pm", undefined); } catch (e) { r("THROW " + e.name); } setTimeout(() => r("none"), 300); }));
await ca("postMessage-star", () => new Promise(r => { const h = (e) => { if (e.data === "rv3pm2") { removeEventListener("message", h); r("got"); } }; addEventListener("message", h); postMessage("rv3pm2", "*"); setTimeout(() => r("none"), 300); }));
await ca("postMessage-opts", () => new Promise(r => { const h = (e) => { if (e.data === "rv3pm3") { removeEventListener("message", h); r("got"); } }; addEventListener("message", h); postMessage("rv3pm3", { targetOrigin: "*" }); setTimeout(() => r("none"), 300); }));
await ca("postMessage-onearg", () => new Promise(r => { const h = (e) => { if (e.data === "rv3pm4") { removeEventListener("message", h); r("got"); } }; addEventListener("message", h); try { postMessage("rv3pm4"); } catch (e) { r("THROW " + e.name); } setTimeout(() => r("none"), 300); }));
await ca("postMessage-null-origin", () => new Promise(r => { try { postMessage("x", null); r("ok"); } catch (e) { r("THROW " + e.name); } }));
await ca("postMessage-transfer-undef", () => new Promise(r => { const h = (e) => { if (e.data === "rv3pm5") { removeEventListener("message", h); r("got"); } }; addEventListener("message", h); try { postMessage("rv3pm5", "*", undefined); } catch (e) { r("THROW " + e.name); } setTimeout(() => r("none"), 300); }));
await ca("mp-postMessage-undef", () => new Promise(r => { const ch = new MessageChannel(); ch.port2.onmessage = (e) => r("got " + e.data); ch.port1.postMessage("m", undefined); setTimeout(() => r("none"), 300); }));
await ca("mp-postMessage-null", () => new Promise(r => { const ch = new MessageChannel(); ch.port2.onmessage = (e) => r("got " + e.data); try { ch.port1.postMessage("m", null); } catch (e) { r("THROW " + e.name); } setTimeout(() => r("none"), 300); }));
await ca("sendBeacon-undef", () => navigator.sendBeacon("/beacon", undefined));
await ca("sendBeacon-null", () => navigator.sendBeacon("/beacon", null));
await ca("caches-match-undef", async () => { const k = await caches.open("rv3"); return String(await k.match("/x", undefined)); });
await ca("caches-keys-none", async () => { const k = await caches.open("rv3"); return (await k.keys()).length; });
await ca("caches-matchAll-undef", async () => { const k = await caches.open("rv3"); return (await k.matchAll(undefined)).length; });
await ca("cookieStore-get-none", async () => typeof cookieStore === "undefined" ? "nocs" : String(await cookieStore.get()));
await ca("cookieStore-get-undef", async () => typeof cookieStore === "undefined" ? "nocs" : String(await cookieStore.get(undefined)));
await ca("cookieStore-set-2", async () => { await cookieStore.set("rv3c", "v"); const v = (await cookieStore.get("rv3c")).value; await cookieStore.delete("rv3c"); return v; });
await ca("cookieStore-set-1str", async () => { await cookieStore.set("rv3c"); return "ok"; });
await ca("cookieStore-set-null-val", async () => { await cookieStore.set("rv3c2", null); const v = (await cookieStore.get("rv3c2")).value; await cookieStore.delete("rv3c2"); return v; });
await ca("cookieStore-set-obj-maxAge", async () => { await cookieStore.set({ name: "rv3c3", value: "v", expires: null }); const v = await cookieStore.get("rv3c3"); await cookieStore.delete("rv3c3"); return v && v.value; });
await ca("cookieStore-getAll-none", async () => (await cookieStore.getAll()).length >= 0);
`,
	}),
	serverTest({
		name: "rv3-idl-xhr",
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/data") {
					res.writeHead(200, {
						"content-type": "text/plain",
					});
					res.end("DATA");
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(`<!doctype html><script>${C}
runTest(async () => {
  const run = (label, ...args) => ca(label, () => new Promise((r) => { const x = new XMLHttpRequest(); try { x.open(...args); } catch (e) { return r("OPEN-THROW " + e.name); } x.onload = () => r("async " + x.status + " " + x.responseText); x.onerror = () => r("error"); try { x.send(); } catch (e) { return r("SEND-THROW " + e.name); } if (x.readyState === 4) r("sync " + x.status + " " + x.responseText); setTimeout(() => r("timeout rs=" + x.readyState), 2000); }));
  await run("xhr-2", "GET", "/data");
  await run("xhr-true", "GET", "/data", true);
  await run("xhr-undef", "GET", "/data", undefined);
  await run("xhr-false", "GET", "/data", false);
  await run("xhr-0", "GET", "/data", 0);
  await run("xhr-null-creds", "GET", "/data", true, null, null);
  await run("xhr-undef-creds", "GET", "/data", true, undefined, undefined);
  await run("xhr-1arg", "GET");
  await run("xhr-bad-method", "G E T", "/data");
  await run("xhr-lower-method", "get", "/data");
}, true);
</script>`);
			});
		},
	}),
];
