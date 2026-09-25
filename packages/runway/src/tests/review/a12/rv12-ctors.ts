import { basicTest } from "../../../testcommon.ts";

// Behaviour of intercepted interface objects (the Proxy that Intercept puts on
// the global for a @Constructor) and of patched members under unusual
// receivers/call forms. Every value goes through assertConsistent, so run
// WITHOUT RUNWAY_FAST to compare against bare Chrome.
export default [
	basicTest({
		name: "rv12-ctors",
		js: String.raw`
const R = {};
const T = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + (e && e.constructor && e.constructor.name) + ": " + String(e && e.message).slice(0, 120); } R[label] = v; };
const blob = URL.createObjectURL(new Blob(["onmessage=()=>{}"], { type: "text/javascript" }));
const makers = {
  Headers: [() => [{ a: "1" }]],
  Request: [() => ["/x", { method: "POST", body: "b" }]],
  Response: [() => ["body", { status: 201, headers: { "x-a": "1" } }]],
  BroadcastChannel: [() => ["rv12"]],
  EventSource: [() => ["/es"]],
  FontFace: [() => ["F", "url(/f.woff)"]],
  Worker: [() => [blob]],
  URL: [() => ["/p?q", location.href]],
  XMLHttpRequest: [() => []],
  WebSocketStream: [() => ["ws://localhost:1/"]],
};
for (const name of Object.keys(makers)) {
  const X = window[name];
  if (!X) { R[name] = "absent"; continue; }
  const args = makers[name][0]();
  T(name + ".name/len", () => X.name + "/" + X.length);
  T(name + ".toString", () => Function.prototype.toString.call(X));
  T(name + ".ctorIdentity", () => X.prototype.constructor === X);
  T(name + ".protoOfCtor", () => Object.getPrototypeOf(X) === Function.prototype);
  T(name + ".ownKeys", () => Reflect.ownKeys(X).map(String).join(","));
  T(name + ".callNoNew", () => { X(...args); return "no throw"; });
  T(name + ".plain", () => { const o = new X(...args); return [Object.getPrototypeOf(o) === X.prototype, o instanceof X, Object.prototype.toString.call(o)].join(","); });
  T(name + ".subclass", () => {
    class S extends X { m() { return "m"; } static sm() { return "sm"; } }
    const s = new S(...args);
    return [Object.getPrototypeOf(s) === S.prototype, s instanceof S, s instanceof X, s.m && s.m(), S.sm(), Object.getPrototypeOf(S) === X, S.name].join(",");
  });
  T(name + ".subclassCtorField", () => {
    class S extends X { constructor(...a) { super(...a); this.tag = "t"; } }
    const s = new S(...args);
    return [s.tag, s instanceof S].join(",");
  });
  T(name + ".reflectConstructOther", () => { function O() {} O.prototype = { k: 1 }; const o = Reflect.construct(X, args, O); return [Object.getPrototypeOf(o) === O.prototype, Object.prototype.toString.call(o)].join(","); });
  T(name + ".bound", () => { const B = X.bind(null, ...args); const o = new B(); return [o instanceof X, Object.getPrototypeOf(o) === X.prototype, B.name].join(","); });
  T(name + ".hasInstanceObj", () => ({}) instanceof X);
  T(name + ".descOnGlobal", () => { const d = Object.getOwnPropertyDescriptor(window, name); return [d.writable, d.enumerable, d.configurable, typeof d.value].join(","); });
}
// statics reached through a subclass
T("Response.json via subclass", () => { class S extends Response {} const r = S.json({ a: 1 }); return [r instanceof Response, r instanceof S, r.status, r.headers.get("content-type")].join(","); });
T("Response.error via subclass", () => { class S extends Response {} const r = S.error(); return [r.type, r instanceof S].join(","); });
T("Response.redirect", () => { const r = Response.redirect("https://example.com/next", 302); return [r.status, r.headers.get("location")].join(","); });
T("Response.redirect relative", () => { const r = Response.redirect("/next", 302); return [r.status, r.headers.get("location")].join(","); });
T("URL.canParse via subclass", () => { class S extends URL {} return S.canParse("https://a/") + "," + (typeof S.parse === "function" ? String(S.parse("https://a/b") instanceof S) : "noparse"); });
T("URL.createObjectURL via subclass", () => { class S extends URL {} const u = S.createObjectURL(new Blob(["x"])); return u.slice(0, 5); });
T("Request clone subclass", () => { class S extends Request {} const s = new S("/y"); const c = s.clone(); return [c instanceof S, c instanceof Request, new URL(c.url).pathname].join(","); });
T("Request from Request", () => { const a = new Request("/a", { headers: { "x-q": "1" } }); const b = new Request(a); return [new URL(b.url).pathname, b.headers.get("x-q")].join(","); });
T("Response.clone subclass", () => { class S extends Response {} const s = new S("x"); const c = s.clone(); return [c instanceof S, c instanceof Response].join(","); });
T("Headers subclass iterate", () => { class S extends Headers {} const s = new S({ b: "2", a: "1" }); return [...s].map(p => p.join("=")).join("&") + "|" + [...s.keys()].join(","); });
T("Headers iterator identity", () => Headers.prototype[Symbol.iterator] === Headers.prototype.entries);
T("Headers iterator desc", () => { const d = Object.getOwnPropertyDescriptor(Headers.prototype, Symbol.iterator); return [d.writable, d.enumerable, d.configurable].join(","); });
T("Headers proto keys", () => Reflect.ownKeys(Headers.prototype).map(String).join(","));
// patched methods, unusual call forms
const a = document.createElement("a"); a.setAttribute("href", "/rel");
document.body.appendChild(a);
T("apply arraylike", () => { Reflect.apply(Element.prototype.setAttribute, a, { length: 2, 0: "data-x", 1: "v" }); return a.getAttribute("data-x"); });
T("new patched method", () => { new Element.prototype.setAttribute("x", "y"); return "no throw"; });
T("new patched getter", () => { new (Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").get)(); return "no throw"; });
T("proxy receiver getAttribute", () => Element.prototype.getAttribute.call(new Proxy(a, {}), "href"));
T("proxy receiver innerHTML", () => Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").get.call(new Proxy(a, {})));
T("proxy receiver href", () => Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").get.call(new Proxy(a, {})));
T("proxy receiver appendChild", () => Node.prototype.appendChild.call(new Proxy(document.body, {}), document.createElement("i")));
T("proxy receiver fetch", () => { const p = fetch.call(new Proxy(window, {}), "/x"); p.catch(() => {}); return "no throw"; });
T("proxy receiver setTimeout", () => typeof setTimeout.call(new Proxy(window, {}), () => {}, 0));
T("undefined receiver setTimeout", () => typeof setTimeout.call(undefined, () => {}, 0));
T("other receiver setTimeout", () => setTimeout.call({}, () => {}, 0) && "ok");
T("other receiver fetch", () => { const p = fetch.call({}, "/x"); p.catch(() => {}); return "no throw"; });
T("proxy receiver postMessage", () => { window.postMessage.call(new Proxy(window, {}), "x", "*"); return "ok"; });
T("other receiver postMessage", () => { window.postMessage.call({}, "x", "*"); return "ok"; });
T("proxy receiver open", () => { const r = window.open.call(new Proxy(window, {}), "about:blank", "_self_nope_" + Math.random(), "noopener"); return String(r); });
T("proxy receiver localStorage getItem", () => Storage.prototype.getItem.call(new Proxy(localStorage, {}), "k"));
T("subclass receiver", () => { class Q extends HTMLAnchorElement {} customElements.define("rv12-q", Q, { extends: "a" }); const q = document.createElement("a", { is: "rv12-q" }); q.setAttribute("href", "/sub"); return [q.getAttribute("href"), new URL(q.href).pathname, q instanceof Q].join(","); });
T("custom element super", () => { class C extends HTMLElement { setAttribute(n, v) { return super.setAttribute(n, v + "!"); } get innerHTML() { return "[" + super.innerHTML + "]"; } } customElements.define("rv12-c", C); const c = document.createElement("rv12-c"); c.setAttribute("title", "t"); c.innerHTML = "<b>x</b>"; return c.getAttribute("title") + "|" + c.innerHTML; });
// cross-realm receivers through a same-origin frame
const f = document.createElement("iframe"); document.body.appendChild(f);
const fw = f.contentWindow; const fd = f.contentDocument;
const fa = fd.createElement("a"); fa.setAttribute("href", "/framed"); fd.body.appendChild(fa);
T("xrealm getAttribute", () => Element.prototype.getAttribute.call(fa, "href"));
T("xrealm href", () => new URL(Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").get.call(fa)).pathname);
T("xrealm setAttribute", () => { Element.prototype.setAttribute.call(fa, "href", "/set"); return fa.getAttribute("href") + "," + new URL(fa.href).pathname; });
T("xrealm innerHTML", () => { Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").set.call(fd.body, '<a id=q href="/ih">x</a>'); return fd.getElementById("q").getAttribute("href") + "," + new URL(fd.getElementById("q").href).pathname; });
T("xrealm frame getter on top el", () => fw.Element.prototype.getAttribute.call(a, "href"));
T("xrealm frame appendChild top", () => { const n = fw.Node.prototype.appendChild.call(document.body, document.createElement("u")); return n.nodeName; });
T("xrealm Headers get", () => new Headers(new fw.Headers({ a: "1" })).get("a"));
T("xrealm Request", () => new URL(new Request(new fw.Request("/xr")).url).pathname);
T("xrealm Response headers", () => Object.getOwnPropertyDescriptor(Response.prototype, "headers").get.call(new fw.Response("x", { headers: { "x-a": "b" } })).get("x-a"));
T("xrealm Request url", () => new URL(Object.getOwnPropertyDescriptor(Request.prototype, "url").get.call(new fw.Request("/xu"))).pathname);
T("xrealm instanceof", () => [new fw.Headers() instanceof Headers, new fw.Request("/") instanceof Request].join(","));
for (const [k, v] of Object.entries(R)) assertConsistent(k, v);
`,
	}),
];
