import { serverTest } from "../../../testcommon.ts";

// Subclasses, Proxy-wrapped, frozen and side-effecting values, and nodes from
// non-window documents, fed to intercepted members. Compared with bare Chrome
// through assertConsistent (run WITHOUT RUNWAY_FAST).

function echoServer(server: any) {
	server.on("request", (req: any, res: any) => {
		if (!req.url.startsWith("/echo")) {
			if (req.url !== "/" && req.url !== "/script.js") {
				res.writeHead(404);
				res.end("nf");
			}
			return;
		}
		const chunks: Buffer[] = [];
		req.on("data", (c: Buffer) => chunks.push(c));
		req.on("end", () => {
			const body = Buffer.concat(chunks).toString();
			res.writeHead(200, {
				"content-type": "application/json",
			});
			res.end(
				JSON.stringify({
					method: req.method,
					path: req.url,
					ct: (req.headers["content-type"] || "").split(";")[0],
					xa: req.headers["x-a"] || null,
					mode: req.headers["sec-fetch-mode"] || null,
					body: body.replace(/-{2,}[-\w]+/g, "B").slice(0, 200),
				})
			);
		});
	});
}

const PRELUDE = `
	const R = {};
	const K = async (k, f) => {
		let v;
		try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
		if (v === undefined) v = "undefined";
		R[k] = v;
		assertConsistent(k, v);
	};
	const ABS = location.origin + "/echo";
	const holder = document.createElement("div");
	document.body.appendChild(holder);
	const html = (fn) => { holder.textContent = ""; holder.appendChild(document.createElement("span")); fn(holder.firstChild); return holder.innerHTML; };
	const echo = async (p) => { const r = await p; const j = await r.json(); return JSON.stringify(j); };
`;

export default [
	serverTest({
		name: "rv17-exotic-subclass",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			class MyBlob extends Blob { tag() { return "b"; } }
			class MyFile extends File {}
			class MyReq extends Request { tag() { return "r"; } }
			class MyResp extends Response { tag() { return "s"; } }
			class MyHeaders extends Headers { tag() { return "h"; } }
			class MyFD extends FormData {}
			class MyUSP extends URLSearchParams {}
			class MyRS extends ReadableStream {}
			class MyURL extends URL {}
			class MyAC extends AbortController {}
			class MyET extends EventTarget {}
			class MyEvent extends Event {}
			class MyWorker extends Worker {}
			class MyBC extends BroadcastChannel {}
			class MyES extends EventSource {}
			class MyXHR extends XMLHttpRequest { tag() { return "x"; } }
			class MyMO extends MutationObserver {}
			class MyImage extends Image {}
			class MyAudio extends Audio {}
			class MyFontFace extends FontFace {}
			class MyCSS extends CSSStyleSheet {}
			class MyDOMParser extends DOMParser {}
			class MyEl extends HTMLElement { connectedCallback() { this.dataset.c = "1"; } }
			customElements.define("rv-el", MyEl);
			class MyAnchor extends HTMLAnchorElement {}
			customElements.define("rv-a", MyAnchor, { extends: "a" });

			await K("blob.text", async () => [new MyBlob(["x"]).tag(), await new Response(new MyBlob(["x"])).text()].join());
			await K("file.body", async () => await new Response(new MyFile(["x"], "f")).text());
			await K("req.proto", () => { const r = new MyReq(ABS); return [r instanceof MyReq, r.tag && r.tag(), r.url.replace(location.origin, "O")].join(); });
			await K("req.fetch", () => echo(fetch(new MyReq(ABS + "?sub"))));
			await K("req.fetchInit", () => echo(fetch(new MyReq(ABS + "?sub", { method: "POST", body: "y", headers: { "x-a": "1" } }))));
			await K("req.clone", () => { const r = new MyReq(ABS).clone(); return [r instanceof MyReq, r.url.replace(location.origin, "O")].join(); });
			await K("req.fromReq", () => new Request(new MyReq(ABS + "?q")).url.replace(location.origin, "O"));
			await K("resp.proto", async () => { const r = new MyResp("z", { status: 201, headers: { "x-a": "1" } }); return [r instanceof MyResp, r.tag && r.tag(), r.status, r.headers.get("x-a"), await r.text()].join(); });
			await K("resp.clone", () => new MyResp("z").clone() instanceof MyResp);
			await K("resp.json", async () => { const r = MyResp.json({ a: 1 }); return [r instanceof MyResp, await r.text()].join(); });
			await K("resp.redirect", () => { const r = MyResp.redirect(ABS, 302); return [r instanceof MyResp, r.headers.get("location")].join(); });
			await K("resp.error", () => MyResp.error() instanceof MyResp);
			await K("headers.proto", () => { const h = new MyHeaders({ "x-a": "1" }); return [h instanceof MyHeaders, h.tag && h.tag(), h.get("x-a")].join(); });
			await K("headers.init", () => new Headers(new MyHeaders({ "x-a": "1" })).get("x-a"));
			await K("headers.fetch", () => echo(fetch(ABS, { headers: new MyHeaders({ "x-a": "3" }) })));
			await K("headers.fromResponse", async () => { const r = await fetch(ABS); return [...new MyHeaders(r.headers)].map(x => x[0]).filter(k => k.startsWith("x-")).join(); });
			await K("fd.body", async () => { const f = new MyFD(); f.append("a", "1"); return (await new Response(f).text()).includes('name="a"'); });
			await K("fd.fetch", () => echo(fetch(ABS, { method: "POST", body: (() => { const f = new MyFD(); f.append("a", "1"); return f; })() })));
			await K("usp.body", async () => { const r = new Response(new MyUSP("a=1")); return [await r.text(), r.headers.get("content-type")].join("|"); });
			await K("usp.fetch", () => echo(fetch(ABS, { method: "POST", body: new MyUSP("a=1") })));
			await K("rs.body", async () => await new Response(new MyRS({ start(c) { c.enqueue(new Uint8Array([104])); c.close(); } })).text());
			await K("url.proto", () => { const u = new MyURL("/p?x", location.href); return [u instanceof MyURL, u.href.replace(location.origin, "O")].join(); });
			await K("url.fetch", () => echo(fetch(new MyURL(ABS + "?url"))));
			await K("url.anchor", () => { const a = document.createElement("a"); a.href = new MyURL("/zz", location.href); return a.href.replace(location.origin, "O"); });
			await K("ac.signal", async () => { const ac = new MyAC(); ac.abort(); try { await fetch(ABS, { signal: ac.signal }); return "resolved"; } catch (e) { return e.name; } });
			await K("et.listener", () => { const t = new MyET(); let n = 0; t.addEventListener("x", () => n++); t.dispatchEvent(new MyEvent("x")); return [n, t instanceof MyET].join(); });
			await K("event.window", () => { let got; const h = (e) => got = e; addEventListener("rvx", h); dispatchEvent(new MyEvent("rvx")); removeEventListener("rvx", h); return [got instanceof MyEvent, got.constructor.name].join(); });
			await K("event.doc", () => { let got; const h = (e) => got = e; document.addEventListener("rvx", h); document.dispatchEvent(new MyEvent("rvx")); return [got instanceof MyEvent, got.isTrusted].join(); });
			await K("xhr.proto", () => { const x = new MyXHR(); return [x instanceof MyXHR, x.tag && x.tag()].join(); });
			await K("xhr.send", () => new Promise(res => { const x = new MyXHR(); x.open("POST", ABS + "?xhr"); x.onload = () => res(x.responseText); x.onerror = () => res("err"); x.send("q"); }));
			await K("xhr.responseURL", () => new Promise(res => { const x = new MyXHR(); x.open("GET", ABS + "?ru"); x.onload = () => res(x.responseURL.replace(location.origin, "O")); x.onerror = () => res("err"); x.send(); }));
			await K("worker.proto", async () => { const w = new MyWorker(URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" }))); const v = await new Promise(r => { w.onmessage = e => r(e.data); setTimeout(() => r("timeout"), 2000); }); w.terminate(); return [w instanceof MyWorker, v].join(); });
			await K("bc.proto", () => { const b = new MyBC("x"); b.close(); return b instanceof MyBC; });
			await K("es.proto", () => { const e = new MyES(ABS + "?es"); e.close(); return [e instanceof MyES, e.url.replace(location.origin, "O")].join(); });
			await K("mo.proto", () => new MyMO(() => {}) instanceof MyMO);
			await K("image.proto", () => { const i = new MyImage(); i.src = "/i.png"; return [i instanceof MyImage, i.src.replace(location.origin, "O"), i.getAttribute("src")].join(); });
			await K("audio.proto", () => { const a = new MyAudio("/a.mp3"); return [a instanceof MyAudio, a.src.replace(location.origin, "O")].join(); });
			await K("fontface.proto", () => new MyFontFace("f", "url(/f.woff)") instanceof MyFontFace);
			await K("css.proto", () => { const s = new MyCSS(); s.replaceSync("b{background:url(/x.png)}"); return [s instanceof MyCSS, s.cssRules[0].cssText.replace(location.origin, "O")].join(); });
			await K("css.adopt", () => { const s = new MyCSS(); document.adoptedStyleSheets = [s]; const n = document.adoptedStyleSheets.length; document.adoptedStyleSheets = []; return n; });
			await K("domparser.proto", () => { const p = new MyDOMParser(); const d = p.parseFromString("<a href='/x'>x</a>", "text/html"); return [p instanceof MyDOMParser, d.querySelector("a").getAttribute("href")].join(); });
			await K("ce.append", () => { const e = new MyEl(); holder.textContent = ""; holder.append(e); return [e.dataset.c, holder.innerHTML].join(); });
			await K("ce.createElement", () => { const e = document.createElement("rv-el"); holder.textContent = ""; holder.append(e); return [e instanceof MyEl, e.dataset.c].join(); });
			await K("ce.customizedBuiltin", () => { const a = new MyAnchor(); a.href = "/cb"; holder.textContent = ""; holder.append(a); return [a instanceof MyAnchor, a.href.replace(location.origin, "O"), a.getAttribute("href"), holder.innerHTML.includes("scramjet")].join(); });
			await K("ce.innerHTML", () => { holder.innerHTML = '<a is="rv-a" href="/cb2">x</a><rv-el></rv-el>'; return [holder.firstChild instanceof MyAnchor, holder.firstChild.href.replace(location.origin, "O"), holder.lastChild.dataset.c].join(); });
			await K("cache.subclass", async () => { const c = await caches.open("rv17s"); await c.put(new MyReq(ABS + "?cs"), new MyResp("cs")); const m = await c.match(new MyReq(ABS + "?cs")); const ks = await c.keys(); await caches.delete("rv17s"); return [m && await m.text(), ks.length, ks[0] && ks[0].url.replace(location.origin, "O")].join(); });
		`,
	}),
	serverTest({
		name: "rv17-exotic-proxy",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			const P = (o) => new Proxy(o, {});
			await K("px.append", () => html(s => holder.append(P(document.createElement("b")))));
			await K("px.after", () => html(s => s.after(P(document.createElement("b")))));
			await K("px.appendChild", () => html(s => { try { holder.appendChild(P(document.createElement("b"))); } catch (e) { holder.append(e.name); } }));
			await K("px.fetchReq", async () => { try { const r = await fetch(P(new Request(ABS + "?px"))); return r.status + " " + (await r.text()).slice(0, 30); } catch (e) { return "THROW " + e.name; } });
			await K("px.newReq", () => new Request(P(new Request(ABS + "?px"))).url.replace(location.origin, "O"));
			await K("px.fetchURL", async () => (await (await fetch(P(new URL(ABS + "?pu")))).json()).path);
			await K("px.headersInit", () => new Headers(P(new Headers({ "x-a": "1" }))).get("x-a"));
			await K("px.headersFetch", () => echo(fetch(ABS, { headers: P(new Headers({ "x-a": "1" })) })));
			await K("px.blobBody", async () => await new Response(P(new Blob(["pb"]))).text());
			await K("px.init", () => echo(fetch(ABS, P({ method: "POST", body: "pi", headers: { "x-a": "2" } }))));
			await K("px.initDeep", () => echo(fetch(ABS, P({ method: "POST", body: "pi", headers: P({ "x-a": "2" }) }))));
			await K("px.reqInit", async () => { const r = new Request(ABS, P({ method: "PUT", headers: { "x-a": "4" }, mode: "same-origin" })); return [r.method, r.headers.get("x-a"), r.mode].join(); });
			await K("px.respInit", () => { const r = new Response("x", P({ status: 202, statusText: "S", headers: { "x-a": "1" } })); return [r.status, r.statusText, r.headers.get("x-a")].join(); });
			await K("px.aelOptions", () => { let n = 0; const t = new EventTarget(); t.addEventListener("x", () => n++, P({ once: true })); t.dispatchEvent(new Event("x")); t.dispatchEvent(new Event("x")); return n; });
			await K("px.handleEvent", () => { let n = 0; const t = new EventTarget(); t.addEventListener("x", P({ handleEvent() { n++; } })); t.dispatchEvent(new Event("x")); return n; });
			await K("px.listenerFn", () => { let n = 0; const t = new EventTarget(); const f = P(() => n++); t.addEventListener("x", f); t.dispatchEvent(new Event("x")); t.removeEventListener("x", f); t.dispatchEvent(new Event("x")); return n; });
			await K("px.pmTransfer", () => new Promise(res => { const ab = new ArrayBuffer(8); addEventListener("message", function h(e) { if (e.data?.k !== "px") return; removeEventListener("message", h); res(ab.byteLength); }); postMessage({ k: "px", ab }, "*", P([ab])); setTimeout(() => res("timeout"), 1000); }));
			await K("px.pmOpts", () => new Promise(res => { addEventListener("message", function h(e) { if (e.data !== "pxo") return; removeEventListener("message", h); res("got"); }); postMessage("pxo", P({ targetOrigin: "*" })); setTimeout(() => res("timeout"), 1000); }));
			await K("px.pmData", () => new Promise(res => { addEventListener("message", function h(e) { if (e.data?.k !== "pxd") return; removeEventListener("message", h); res(JSON.stringify(e.data)); }); try { postMessage(P({ k: "pxd" }), "*"); } catch (e) { res("THROW " + e.name); } setTimeout(() => res("timeout"), 1000); }));
			await K("px.moOptions", async () => { const b = document.createElement("b"); holder.textContent = ""; holder.appendChild(b); const recs = []; const mo = new MutationObserver(r => recs.push(...r)); mo.observe(b, P({ attributes: true, attributeOldValue: true })); b.setAttribute("x", "1"); await new Promise(r => setTimeout(r, 10)); mo.disconnect(); return recs.length; });
			await K("px.moFilter", async () => { const b = document.createElement("a"); holder.textContent = ""; holder.appendChild(b); const recs = []; const mo = new MutationObserver(r => recs.push(...r.map(x => x.attributeName))); mo.observe(b, { attributeFilter: P(["href"]) }); b.setAttribute("href", "/1"); b.setAttribute("title", "t"); await new Promise(r => setTimeout(r, 10)); mo.disconnect(); return recs.join(); });
			await K("px.moFilterSet", async () => { const b = document.createElement("a"); holder.textContent = ""; holder.appendChild(b); const recs = []; const mo = new MutationObserver(r => recs.push(...r.map(x => x.attributeName + "=" + x.oldValue))); mo.observe(b, { attributeFilter: new Set(["href", "src"]), attributeOldValue: true }); b.setAttribute("href", "/1"); b.href = "/2"; b.setAttribute("title", "t"); await new Promise(r => setTimeout(r, 10)); mo.disconnect(); return recs.join(); });
			await K("px.innerHTML", () => html(s => { s.innerHTML = P({ toString() { return "<i>p</i>"; } }); }));
			await K("px.setAttribute", () => { const a = document.createElement("a"); a.setAttribute("href", P({ toString() { return "/pa"; } })); return [a.getAttribute("href"), a.href.replace(location.origin, "O")].join(); });
			await K("px.style", () => { const d = document.createElement("div"); d.style.backgroundImage = P({ toString() { return "url(/s.png)"; } }); return d.style.backgroundImage.replace(location.origin, "O"); });
			await K("px.nodeInsertBefore", () => html(s => { try { holder.insertBefore(document.createElement("i"), P(s)); } catch (e) { holder.append(e.name); } }));
			await K("px.urlBase", () => new URL("x", P(new URL("http://a.test/b/"))).href);
			await K("px.usp", () => new URLSearchParams(P(new URLSearchParams("a=1"))).toString());
			await K("px.uspRecord", () => new URLSearchParams(P({ a: "1", b: "2" })).toString());
			await K("px.headersRecord", () => new Headers(P({ "x-a": "1" })).get("x-a"));
			await K("px.headersSeq", () => new Headers(P([["x-a", "1"]])).get("x-a"));
			await K("px.cacheAddAll", async () => { const c = await caches.open("rv17p"); try { await c.addAll(P([ABS + "?aa"])); const k = await c.keys(); return k.length; } catch (e) { return "THROW " + e.name; } finally { await caches.delete("rv17p"); } });
			await K("px.windowOpenFeat", () => { const w = open("", "_blank", P({ toString() { return "noopener"; } })); return w === null; });
			await K("px.historyState", () => { try { history.replaceState(P({ a: 1 }), ""); return "ok"; } catch (e) { return e.name; } });
			await K("px.workerOptions", async () => { const w = new Worker(URL.createObjectURL(new Blob(["postMessage(self.name)"], { type: "text/javascript" })), P({ name: "pn" })); const v = await new Promise(r => { w.onmessage = e => r(e.data); setTimeout(() => r("timeout"), 2000); }); w.terminate(); return v; });
			await K("px.cookieStore", async () => { if (!self.cookieStore) return "none"; await cookieStore.set(P({ name: "rv17p", value: "v" })); const c = await cookieStore.get(P({ name: "rv17p" })); await cookieStore.delete(P({ name: "rv17p" })); return c && c.value; });
		`,
	}),
	serverTest({
		name: "rv17-exotic-frozen",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			const F = Object.freeze;
			await K("fz.req", () => echo(fetch(F(new Request(ABS + "?fz")))));
			await K("fz.init", () => echo(fetch(ABS, F({ method: "POST", body: "f", headers: F({ "x-a": "1" }), mode: "same-origin", credentials: "include" }))));
			await K("fz.initHeaders", () => echo(fetch(ABS, F({ headers: F(new Headers({ "x-a": "5" })) }))));
			await K("fz.reqStrInit", () => { const r = new Request(ABS, F({ mode: "cors", credentials: "omit", headers: F([["x-a", "1"]]) })); return [r.mode, r.credentials, r.headers.get("x-a")].join(); });
			await K("fz.reqReqInit", async () => { const r = new Request(new Request(ABS + "?rr"), F({ method: "POST", body: "b", headers: { "x-a": "1" } })); return [r.method, r.headers.get("x-a"), await r.text()].join(); });
			await K("fz.respInit", () => { const r = new Response("x", F({ status: 203, headers: F({ "x-a": "1" }) })); return [r.status, r.headers.get("x-a")].join(); });
			await K("fz.respFromResp", async () => { const src = await fetch(ABS); const r = new Response("x", src); return [r.status, r.headers.get("content-type")].join(); });
			await K("fz.respFromRespFrozen", async () => { const src = await fetch(ABS); try { const r = new Response("x", F({ status: 200, headers: src.headers })); return r.headers.get("content-type"); } catch (e) { return "THROW " + e.name; } });
			await K("fz.reqFromFetchedHeaders", async () => { const src = await fetch(ABS); const r = new Request(ABS, { headers: src.headers }); return [...r.headers.keys()].join(); });
			await K("fz.fetchFromFetchedHeaders", async () => { const src = await fetch(ABS); return echo(fetch(ABS, { headers: src.headers })); });
			await K("fz.aelOpts", () => { let n = 0; const t = new EventTarget(); t.addEventListener("x", () => n++, F({ once: true, capture: false })); t.dispatchEvent(new Event("x")); t.dispatchEvent(new Event("x")); return n; });
			await K("fz.moOpts", async () => { const b = document.createElement("b"); holder.textContent = ""; holder.appendChild(b); const recs = []; const mo = new MutationObserver(r => recs.push(...r)); mo.observe(b, F({ attributes: true, attributeFilter: F(["x"]) })); b.setAttribute("x", "1"); await new Promise(r => setTimeout(r, 10)); mo.disconnect(); return recs.length; });
			await K("fz.pmOpts", () => new Promise(res => { addEventListener("message", function h(e) { if (e.data !== "fzo") return; removeEventListener("message", h); res("got"); }); postMessage("fzo", F({ targetOrigin: "*", transfer: F([]) })); setTimeout(() => res("timeout"), 1000); }));
			await K("fz.pmData", () => new Promise(res => { addEventListener("message", function h(e) { if (e.data?.k !== "fzd") return; removeEventListener("message", h); res([Object.isFrozen(e.data), JSON.stringify(e.data)].join()); }); postMessage(F({ k: "fzd", n: F([1]) }), "*"); setTimeout(() => res("timeout"), 1000); }));
			await K("fz.workerOpts", async () => { const w = new Worker(URL.createObjectURL(new Blob(["postMessage(self.name)"], { type: "text/javascript" })), F({ name: "fzn", type: "classic" })); const v = await new Promise(r => { w.onmessage = e => r(e.data); setTimeout(() => r("timeout"), 2000); }); w.terminate(); return v; });
			await K("fz.headersRecord", () => new Headers(F({ "x-a": "1" })).get("x-a"));
			await K("fz.wsProtocols", () => { try { const w = new WebSocket("ws://" + location.host + "/ws", F(["a", "b"])); w.close(); return "ok"; } catch (e) { return e.name; } });
			await K("fz.cookieInit", async () => { if (!self.cookieStore) return "none"; await cookieStore.set(F({ name: "rv17f", value: "v", path: "/" })); const c = await cookieStore.get("rv17f"); await cookieStore.delete("rv17f"); return c && c.value; });
			await K("fz.esInit", () => { const e = new EventSource(ABS + "?es", F({ withCredentials: true })); e.close(); return e.withCredentials; });
		`,
	}),
	serverTest({
		name: "rv17-exotic-sidefx",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			let c = 0;
			const T = (s) => ({ toString() { c++; return s; } });
			const cnt = async (k, f) => { c = 0; let r; try { r = await f(); } catch (e) { r = "THROW " + e.name; } await K(k, () => [c, typeof r === "string" ? r.replace(location.origin, "O").slice(0, 60) : r].join("|")); };
			await cnt("se.fetch", async () => (await fetch(T(ABS + "?se"))).status);
			await cnt("se.request", () => new Request(T(ABS + "?se")).url);
			await cnt("se.initMode", () => new Request(ABS, { mode: T("same-origin") }).mode);
			await cnt("se.initCred", () => new Request(ABS, { credentials: T("include") }).credentials);
			await cnt("se.initMethod", () => new Request(ABS, { method: T("PUT") }).method);
			await cnt("se.fetchInitMode", async () => (await fetch(ABS, { mode: T("same-origin") })).status);
			await cnt("se.getterInit", async () => { const init = {}; let g = 0; for (const k of ["body", "cache", "credentials", "headers", "integrity", "keepalive", "method", "mode", "priority", "redirect", "referrer", "referrerPolicy", "signal", "window", "duplex"]) Object.defineProperty(init, k, { get() { c++; return undefined; }, enumerable: true }); await fetch(ABS, init); return "ok"; });
			await cnt("se.getterReqInit", () => { const init = {}; for (const k of ["body", "cache", "credentials", "headers", "integrity", "keepalive", "method", "mode", "priority", "redirect", "referrer", "referrerPolicy", "signal", "window", "duplex"]) Object.defineProperty(init, k, { get() { c++; return undefined; }, enumerable: true }); new Request(ABS, init); return "ok"; });
			await cnt("se.getterRespInit", () => { const init = {}; for (const k of ["headers", "status", "statusText"]) Object.defineProperty(init, k, { get() { c++; return undefined; }, enumerable: true }); new Response("x", init); return "ok"; });
			await cnt("se.getterOrderReq", () => { const order = []; const init = {}; for (const k of ["body", "cache", "credentials", "headers", "integrity", "keepalive", "method", "mode", "priority", "redirect", "referrer", "referrerPolicy", "signal", "window"]) Object.defineProperty(init, k, { get() { order.push(k); return undefined; } }); new Request(ABS, init); return order.join(" "); });
			await cnt("se.append", () => html(s => holder.append(T("a"), T("b"))));
			await cnt("se.after", () => html(s => s.after(T("a"))));
			await cnt("se.setAttribute", () => { const a = document.createElement("a"); a.setAttribute("href", T("/x")); return a.getAttribute("href"); });
			await cnt("se.setAttributeName", () => { const a = document.createElement("a"); a.setAttribute(T("href"), "/x"); return a.getAttribute("href"); });
			await cnt("se.hrefSet", () => { const a = document.createElement("a"); a.href = T("/x"); return a.getAttribute("href"); });
			await cnt("se.srcSet", () => { const a = document.createElement("img"); a.src = T("/x"); return a.getAttribute("src"); });
			await cnt("se.innerHTML", () => html(s => { s.innerHTML = T("<b>x</b>"); }));
			await cnt("se.insertAdjacentHTML", () => html(s => s.insertAdjacentHTML(T("afterend"), T("<b>x</b>"))));
			await cnt("se.docWrite", () => { const f = document.createElement("iframe"); document.body.appendChild(f); const d = f.contentDocument; d.open(); d.write(T("<p>w</p>")); d.close(); const r = d.body.innerHTML; f.remove(); return r; });
			await cnt("se.open", () => { const w = open(T("about:blank"), T("_blank"), T("noopener")); return String(w); });
			await cnt("se.pushState", () => { history.pushState(null, "", T(location.pathname + "#se")); return location.hash; });
			await cnt("se.locAssign", () => { location.hash = T("#se2"); return location.hash; });
			await cnt("se.urlCtor", () => new URL(T("/x"), T(location.href)).href);
			await cnt("se.worker", async () => { const w = new Worker(T(URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" })))); w.terminate(); return "ok"; });
			await cnt("se.importScripts", () => "skip");
			await cnt("se.styleProp", () => { const d = document.createElement("div"); d.style.setProperty(T("background-image"), T("url(/q.png)")); return d.style.backgroundImage; });
			await cnt("se.styleSet", () => { const d = document.createElement("div"); d.style.backgroundImage = T("url(/q.png)"); return d.style.backgroundImage; });
			await cnt("se.cssText", () => { const d = document.createElement("div"); d.style.cssText = T("background:url(/q.png)"); return d.getAttribute("style"); });
			await cnt("se.insertRule", () => { const s = new CSSStyleSheet(); s.insertRule(T("b{background:url(/q.png)}")); return s.cssRules[0].cssText; });
			await cnt("se.replaceSync", () => { const s = new CSSStyleSheet(); s.replaceSync(T("b{background:url(/q.png)}")); return s.cssRules[0].cssText; });
			await cnt("se.qs", () => String(document.querySelector(T("a[href]"))));
			await cnt("se.matches", () => document.body.matches(T("body")));
			await cnt("se.createObjectURLrevoke", () => { URL.revokeObjectURL(T("blob:" + location.origin + "/nope")); return "ok"; });
			await cnt("se.sendBeacon", () => navigator.sendBeacon(T(ABS + "?bc"), T("d")));
			await cnt("se.xhrOpen", () => { const x = new XMLHttpRequest(); x.open(T("GET"), T(ABS + "?xo")); x.abort(); return "ok"; });
			await cnt("se.xhrHeader", () => { const x = new XMLHttpRequest(); x.open("GET", ABS); x.setRequestHeader(T("x-a"), T("1")); x.abort(); return "ok"; });
			await cnt("se.headersAppend", () => { const h = new Headers(); h.append(T("x-a"), T("1")); return h.get("x-a"); });
			await cnt("se.cacheMatch", async () => { const r = await caches.match(T(ABS + "?cm")); return String(r); });
			await cnt("se.localStorage", () => { localStorage.setItem(T("rvk"), T("v")); const v = localStorage.getItem(T("rvk")); localStorage.removeItem(T("rvk")); return v; });
			await cnt("se.cookie", () => { document.cookie = T("rvse=1"); const v = document.cookie.includes("rvse=1"); document.cookie = "rvse=; max-age=0"; return v; });
			await cnt("se.es", () => { const e = new EventSource(T(ABS + "?es2")); e.close(); return "ok"; });
			await cnt("se.ws", () => { try { const w = new WebSocket(T("ws://" + location.host + "/ws"), T("p")); w.close(); return "ok"; } catch (e) { return e.name; } });
			await cnt("se.setTimeoutStr", () => new Promise(r => { window.__rvst = 0; setTimeout(T("window.__rvst = 1"), 0); setTimeout(() => r(window.__rvst), 30); }));
			await cnt("se.eval", () => eval(T("1+1")));
			await cnt("se.Function", () => new Function(T("return 2"))());
			await cnt("se.domparser", () => new DOMParser().parseFromString(T("<p>d</p>"), "text/html").body.innerHTML);
			await cnt("se.createContextualFragment", () => { const r = document.createRange(); r.selectNode(document.body); return r.createContextualFragment(T("<i>c</i>")).firstChild.nodeName; });
			await cnt("se.outerHTML", () => html(s => { s.outerHTML = T("<u>o</u>"); }));
			await cnt("se.srcdoc", () => { const f = document.createElement("iframe"); f.srcdoc = T("<p>s</p>"); return f.getAttribute("srcdoc"); });
			await cnt("se.textContentScript", () => { const s = document.createElement("script"); s.textContent = T("window.__rvtc=1"); document.body.append(s); s.remove(); return window.__rvtc; });
			await cnt("se.textScript", () => { const s = document.createElement("script"); s.text = T("window.__rvtt=1"); document.body.append(s); s.remove(); return window.__rvtt; });
			await cnt("se.appendScriptText", () => { const s = document.createElement("script"); s.append(T("window.__rvta=1")); document.body.append(s); s.remove(); return window.__rvta; });
		`,
	}),
	serverTest({
		name: "rv17-exotic-docs",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			const docs = {
				html: document.implementation.createHTMLDocument("t"),
				xml: document.implementation.createDocument("http://www.w3.org/1999/xhtml", "html"),
				parsed: new DOMParser().parseFromString("<p></p>", "text/html"),
				xmlParsed: new DOMParser().parseFromString("<r xmlns='http://www.w3.org/1999/xhtml'/>", "application/xhtml+xml"),
				template: document.createElement("template").content.ownerDocument,
			};
			for (const [k, D] of Object.entries(docs)) {
				await K(k + ".append", () => html(s => holder.append(D.createElement("b"))));
				await K(k + ".after", () => html(s => s.after(D.createElement("b"), D.createTextNode("t"))));
				await K(k + ".img", () => { const i = D.createElement("img"); i.src = "/d.png"; holder.textContent = ""; holder.append(i); return [i.src.replace(location.origin, "O"), i.getAttribute("src"), holder.innerHTML.replace(location.origin, "O")].join("|"); });
				await K(k + ".imgBefore", () => { const i = D.createElement("img"); i.setAttribute("src", "/d2.png"); holder.textContent = ""; holder.append(i); return [i.src.replace(location.origin, "O"), i.getAttribute("src")].join("|"); });
				await K(k + ".aHref", () => { const a = D.createElement("a"); a.href = "/dh"; return [a.href.replace(location.origin, "O"), a.getAttribute("href")].join("|"); });
				await K(k + ".innerHTML", () => { const d = D.createElement("div"); d.innerHTML = "<a href='/ih'>x</a><img src='/ih.png'>"; holder.textContent = ""; holder.append(d); return [d.innerHTML, d.firstChild.href.replace(location.origin, "O")].join("|"); });
				await K(k + ".script", () => { window.__rvds = 0; const s = D.createElement("script"); s.textContent = "window.__rvds = typeof location.href === 'string' && location.host === " + JSON.stringify(location.host); holder.textContent = ""; holder.append(s); return window.__rvds; });
				await K(k + ".style", () => { const s = D.createElement("style"); s.textContent = "b{background:url(/st.png)}"; holder.textContent = ""; holder.append(s); return [s.textContent, s.sheet && s.sheet.cssRules[0].cssText.replace(location.origin, "O")].join("|"); });
				await K(k + ".importNode", () => { const i = D.createElement("img"); i.setAttribute("src", "/imp.png"); const n = document.importNode(i); return [n.getAttribute("src"), n.src.replace(location.origin, "O")].join("|"); });
				await K(k + ".adoptNode", () => { const i = D.createElement("img"); i.setAttribute("src", "/adp.png"); const n = document.adoptNode(i); return [n.getAttribute("src"), n.src.replace(location.origin, "O")].join("|"); });
				await K(k + ".querySel", () => { const a = D.createElement("a"); a.setAttribute("href", "/qs"); (D.body || D.documentElement).append(a); return String(!!D.querySelector("a[href='/qs']")); });
				await K(k + ".docURL", () => [D.URL.replace(location.origin, "O"), D.baseURI && D.baseURI.replace(location.origin, "O"), D.documentURI.replace(location.origin, "O")].join("|"));
				await K(k + ".docLocation", () => String(D.location));
				await K(k + ".docCookie", () => { try { return JSON.stringify(D.cookie); } catch (e) { return e.name; } });
				await K(k + ".docDomain", () => { try { return D.domain; } catch (e) { return e.name; } });
				await K(k + ".docReferrer", () => D.referrer);
				await K(k + ".title", () => D.title);
				await K(k + ".write", () => { try { D.open(); D.write("<p>w</p>"); D.close(); return (D.body && D.body.innerHTML) || "nobody"; } catch (e) { return e.name; } });
				await K(k + ".range", () => { const b = D.createElement("b"); b.textContent = "r"; (D.body || D.documentElement).append(b); const r = D.createRange(); r.selectNodeContents(b); r.insertNode(D.createElement("img")); return b.innerHTML; });
				await K(k + ".frag", () => { const r = D.createRange(); r.selectNodeContents(D.body || D.documentElement); const f = r.createContextualFragment("<a href='/cf'>x</a>"); return f.firstChild && f.firstChild.getAttribute("href"); });
			}
		`,
	}),
];
