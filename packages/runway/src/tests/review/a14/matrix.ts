// A battery of observations run *inside* child realms of every kind, compared
// across main / develop / bare Chrome. Prints one JSON line per kind via fail().
const BATTERY = String.raw`
window.__battery = async (kind) => {
  const r = {};
  const T = (k, f) => { try { const v = f(); r[k] = v; } catch (e) { r[k] = "throw " + e.name + ": " + e.message; } };
  const A = async (k, f, ms = 2500) => {
    let to;
    try { r[k] = await Promise.race([f(), new Promise((_, j) => { to = setTimeout(() => j(new Error("timeout")), ms); })]); }
    catch (e) { r[k] = "err " + e.name + ": " + e.message; }
    clearTimeout(to);
  };
  const strip = (s) => typeof s === "string" ? s.replace(/localhost:\d+/g, "HOST") : s;
  T("href", () => strip(location.href));
  T("url", () => strip(document.URL));
  T("baseURI", () => strip(document.baseURI));
  T("origin", () => strip(self.origin));
  T("locOrigin", () => strip(location.origin));
  T("domain", () => document.domain);
  T("referrer", () => strip(document.referrer));
  T("ahref", () => { const a = document.createElement("a"); a.href = "rel?x"; return strip(a.href); });
  T("inner", () => { const d = document.createElement("div"); d.innerHTML = '<a href="rel2"></a><img src="i.gif">'; return strip(d.firstChild.href) + " " + strip(d.lastChild.src) + " " + d.innerHTML; });
  T("setattr", () => { const a = document.createElement("a"); a.setAttribute("href", "/sa"); return strip(a.href) + " " + a.getAttribute("href"); });
  T("ls", () => { localStorage.setItem("rv14_" + kind, "v"); return localStorage.getItem("rv14_" + kind) + " len>0:" + (localStorage.length > 0); });
  T("ss", () => { sessionStorage.setItem("rv14s_" + kind, "v"); return sessionStorage.getItem("rv14s_" + kind); });
  T("cookie", () => { document.cookie = "rv14c_" + kind + "=1; path=/"; return document.cookie.includes("rv14c_" + kind + "=1"); });
  T("cookieParent", () => document.cookie.includes("rv14parent=1"));
  await A("fetch", async () => { const x = await fetch("/data.txt"); return x.status + " " + (await x.text()) + " " + strip(x.url); });
  await A("fetchRel", async () => { const x = await fetch("data.txt"); return x.status + " " + strip(x.url); });
  await A("xhr", () => new Promise((res) => { const x = new XMLHttpRequest(); x.open("GET", "/data.txt"); x.onload = () => res(x.status + " " + x.responseText + " " + strip(x.responseURL)); x.onerror = () => res("error"); x.send(); }));
  await A("import", async () => (await import("/mod.js")).v);
  await A("worker", () => new Promise((res) => { const w = new Worker("/w.js"); w.onmessage = (e) => res(strip(e.data)); w.onerror = (e) => res("error " + e.message); }));
  await A("script", () => new Promise((res) => { const s = document.createElement("script"); s.src = "/s.js"; s.onload = () => res(strip(window.__s)); s.onerror = () => res("error"); document.documentElement.appendChild(s); }));
  await A("img", () => new Promise((res) => { const i = new Image(); i.onload = () => res("ok"); i.onerror = () => res("error"); i.src = "/i.gif"; }));
  await A("timer", () => new Promise((res) => setTimeout(() => res("ok"), 5)));
  await A("timerStr", () => new Promise((res) => { window.__ts = res; setTimeout("__ts(location.href)", 5); }).then(strip));
  T("event", () => { let hit = false; const d = document.createElement("div"); d.addEventListener("x", () => { hit = true; }); d.dispatchEvent(new Event("x")); return hit; });
  T("onclick", () => { let hit = false; const d = document.createElement("div"); d.onclick = () => { hit = true; }; d.click(); return hit; });
  T("style", () => { const d = document.createElement("div"); d.style.backgroundImage = "url(/bg.png)"; return strip(d.style.backgroundImage) + " | " + strip(d.getAttribute("style")); });
  T("histLen", () => history.length);
  T("histState", () => JSON.stringify(history.state));
  T("pushHash", () => { history.pushState({ a: 1 }, "", "#p"); return strip(location.href) + " " + JSON.stringify(history.state); });
  T("replaceUrl", () => { history.replaceState(null, "", location.href.split("#")[0]); return strip(location.href); });
  T("evalLoc", () => strip(eval("location.href")));
  T("fnLoc", () => strip(new Function("return location.href")()));
  T("arrRealm", () => document.createElement("b").getAttributeNames() instanceof Array);
  T("perfRealm", () => performance.getEntries() instanceof Array);
  T("perfNames", () => performance.getEntriesByType("resource").map((e) => strip(e.name)).filter((n) => /data\.txt|mod\.js|s\.js/.test(n)).join(","));
  T("blob", () => strip(URL.createObjectURL(new Blob(["x"]))).replace(/[0-9a-f-]{36}/, "UUID"));
  T("name", () => window.name.length > 0 ? "set:" + window.name.length : "");
  T("parentName", () => (parent.name || "").length > 0 ? "set" : "");
  T("frameEl", () => !!frameElement);
  T("topIsTop", () => top === parent.top);
  T("typeofOpen", () => typeof window.open);
  T("docOpenReturns", () => typeof document.open);
  T("cookieStore", () => typeof self.cookieStore);
  T("instanceofWin", () => window instanceof Window);
  T("currentScript", () => document.currentScript === null);
  T("activeEl", () => document.activeElement && document.activeElement.tagName);
  T("qsaHref", () => { const d = document.createElement("div"); d.innerHTML = '<a href="/q"></a>'; document.body.appendChild(d); const n = document.querySelectorAll('a[href="/q"]').length; d.remove(); return n; });
  T("formAction", () => { const f = document.createElement("form"); f.action = "/f"; return strip(f.action); });
  T("linkHref", () => { const l = document.createElement("link"); l.href = "/l.css"; return strip(l.href); });
  T("textContentScript", () => { const s = document.createElement("script"); s.textContent = "window.__tc = location.href"; document.body.appendChild(s); return strip(window.__tc); });
  T("innerHTMLHandler", () => { const d = document.createElement("div"); d.innerHTML = '<img src="x:" onerror="window.__h=location.href">'; return d.innerHTML.length > 0; });
  await A("handlerRan", () => new Promise((res) => setTimeout(() => res(strip(window.__h)), 300)));
  await A("pmParent", () => new Promise((res) => { const P = (window.opener && window.opener !== window) ? opener : parent; P.__pmres = res; P.postMessage({ rv14: kind }, "*"); }));
  await A("pmSelf", () => new Promise((res) => { const h = (e) => { removeEventListener("message", h); res(strip(e.origin) + " " + (e.source === window) + " " + e.data); }; addEventListener("message", h); postMessage("self", "*"); }));
  return r;
};
`;

const CHILD = `<!DOCTYPE html><html><head></head><body>child<script>${BATTERY}</script></body></html>`;

const PARENT_JS = String.raw`
document.cookie = "rv14parent=1; path=/";
window.addEventListener("message", (e) => {
  if (e.data && e.data.rv14 && window.__pmres) {
    const src = window.__pmsrc;
    window.__pmres((e.origin.replace(/localhost:\d+/, "HOST")) + " src=" + (e.source === src));
  }
});
const load = (f) => new Promise((res) => f.addEventListener("load", () => res(), { once: true }));
const inject = (win) => { const s = win.document.createElement("script"); s.textContent = __BATTERY__; (win.document.body || win.document.documentElement).appendChild(s); };
const kinds = (new URLSearchParams(location.search).get("kinds") || "blank,write,srcdoc,touched,untouched,resrc,nested,readd,docopen,docopenblank").split(",");
const out = {};
for (const kind of kinds) {
  let win, f;
  try {
    f = document.createElement("iframe");
    if (kind === "blank") { document.body.appendChild(f); win = f.contentWindow; inject(win); }
    else if (kind === "write") { document.body.appendChild(f); win = f.contentWindow; const d = f.contentDocument; d.open(); d.write("<!DOCTYPE html><html><body>w<script>" + __BATTERY__ + "<\/script></body></html>"); d.close(); }
    else if (kind === "srcdoc") { f.srcdoc = "<!DOCTYPE html><body>s<script>" + __BATTERY__ + "<\/script></body>"; const l = load(f); document.body.appendChild(f); await l; win = f.contentWindow; }
    else if (kind === "touched") { f.src = "/child.html?k=touched"; const l = load(f); document.body.appendChild(f); void f.contentWindow.document; await l; win = f.contentWindow; }
    else if (kind === "untouched") { f.src = "/child.html?k=untouched"; const l = load(f); document.body.appendChild(f); await l; win = f.contentWindow; }
    else if (kind === "resrc") { f.src = "/child.html?k=r1"; let l = load(f); document.body.appendChild(f); void f.contentWindow.document; await l; l = load(f); f.src = "/child.html?k=r2"; await l; l = load(f); f.src = "/child.html?k=r3"; await l; win = f.contentWindow; }
    else if (kind === "nested") { document.body.appendChild(f); const d1 = f.contentDocument; const f2 = d1.createElement("iframe"); d1.body.appendChild(f2); const d2 = f2.contentDocument; const f3 = d2.createElement("iframe"); d2.body.appendChild(f3); win = f3.contentWindow; inject(win); }
    else if (kind === "readd") { f.src = "/child.html?k=readd"; let l = load(f); document.body.appendChild(f); void f.contentWindow.document; await l; f.remove(); l = load(f); document.body.appendChild(f); await l; win = f.contentWindow; }
    else if (kind === "docopen") { f.src = "/child.html?k=docopen"; const l = load(f); document.body.appendChild(f); await l; win = f.contentWindow; const d = f.contentDocument; d.open(); d.write("<!DOCTYPE html><body>o</body>"); d.close(); inject(win); }
    else if (kind === "docopenblank") { document.body.appendChild(f); win = f.contentWindow; const d = f.contentDocument; d.open(); d.write("<!DOCTYPE html><body>o</body>"); d.close(); inject(win); }
    else if (kind === "reblank") { f.src = "/child.html?k=reblank"; let l = load(f); document.body.appendChild(f); await l; l = load(f); f.src = "about:blank"; await l; win = f.contentWindow; inject(win); }
    else if (kind === "resrcdoc") { f.srcdoc = "<p>one</p>"; let l = load(f); document.body.appendChild(f); await l; l = load(f); f.srcdoc = "<!DOCTYPE html><body>s2<script>" + __BATTERY__ + "<\/script></body>"; await l; win = f.contentWindow; }
    else if (kind === "srcdocTouched") { f.srcdoc = "<!DOCTYPE html><body>st<script>" + __BATTERY__ + "<\/script></body>"; const l = load(f); document.body.appendChild(f); void f.contentWindow.document; await l; win = f.contentWindow; }
    else if (kind === "popupNav") { win = open(""); win.location.href = "/child.html?k=popupNav"; for (let i = 0; i < 100 && !(win.__battery && win.document.readyState === "complete"); i++) await new Promise((r) => setTimeout(r, 50)); }
    else if (kind === "popupBlank") { win = open(""); inject(win); }
    else if (kind === "popupWrite") { win = open(""); const d = win.document; d.open(); d.write("<!DOCTYPE html><html><body>pw<script>" + __BATTERY__ + "<\/script></body></html>"); d.close(); }
    else if (kind === "popupUrl") { win = open("/child.html?k=popupUrl"); for (let i = 0; i < 100 && !(win.__battery && win.document.readyState === "complete"); i++) await new Promise((r) => setTimeout(r, 50)); }
    else if (kind === "popupUrlLate") { win = open("/child.html?k=popupUrlLate"); for (let i = 0; i < 100 && !(win.__battery && win.document.readyState === "complete"); i++) await new Promise((r) => setTimeout(r, 50)); }
    window.__pmsrc = win;
    out[kind] = await win.__battery(kind);
    out[kind].parentLs = localStorage.getItem("rv14_" + kind);
    out[kind].parentSs = sessionStorage.getItem("rv14s_" + kind);
    out[kind].parentCookie = document.cookie.includes("rv14c_" + kind + "=1");
  } catch (e) {
    out[kind] = { error: String(e) };
  }
  if (f) f.remove();
  if (kind.startsWith("popup") && win) win.close();
}
const inBare = !("$scramjet" in window) && !Object.getOwnPropertySymbols(window).length;
for (const kind of kinds) fail("RV14MATRIX " + kind + " " + JSON.stringify(out[kind]));
`;

import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

export function makeServer(kinds?: string) {
	const GIF = Buffer.from(
		"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
		"base64"
	);
	return http.createServer((req, res) => {
		const p = req.url!.split("?")[0];
		const send = (ct: string, body: any) => {
			res.writeHead(200, {
				"Content-Type": ct,
			});
			res.end(body);
		};
		if (p === "/")
			send(
				"text/html",
				`<!DOCTYPE html><html><body><h1>m</h1><script src="/script.js"></script></body></html>`
			);
		else if (p === "/script.js")
			send(
				"application/javascript",
				`(async () => { const fail = (m) => { (window.__lines ||= []).push(m); };\n${PARENT_JS.replaceAll("__BATTERY__", JSON.stringify(BATTERY))}\nwindow.__done = true; })();`
			);
		else if (p === "/child.html") send("text/html", CHILD);
		else if (p === "/data.txt") send("text/plain", "data");
		else if (p === "/mod.js") send("text/javascript", "export const v = 1;");
		else if (p === "/w.js")
			send("text/javascript", "postMessage(location.href);");
		else if (p === "/s.js")
			send("text/javascript", "window.__s = location.href;");
		else if (p === "/i.gif") send("image/gif", GIF);
		else {
			res.writeHead(404);
			res.end();
		}
	});
}

export async function collect(evalFn: (s: string) => Promise<any>) {
	for (let i = 0; i < 120; i++) {
		if (await evalFn("!!window.__done").catch(() => false)) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	return await evalFn("JSON.stringify(window.__lines || [])");
}

export default [
	playwrightTest({
		name: "rv14-matrix",
		fn: async ({ page, navigate }) => {
			const server = makeServer();
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			page.on("pageerror", (e: Error) => errs.push(e.message));
			try {
				await navigate(
					`http://localhost:${port}/` +
						(process.env.RV14_KINDS ? "?kinds=" + process.env.RV14_KINDS : "")
				);
				const fr = () =>
					page
						.frames()
						.find(
							(f: any) =>
								f.url().includes("localhost%3A" + port) &&
								!f.url().includes("child")
						);
				const lines = JSON.parse(await collect(async (s) => fr()!.evaluate(s)));
				const tag = process.cwd().includes("/dev/") ? "dev" : "main";
				const fs = await import("node:fs");
				fs.writeFileSync(
					`/home/velzie/.cache/sjreview/scratch-a14/matrix-${tag}.txt`,
					lines.join("\n") + "\nERRS " + JSON.stringify(errs) + "\n"
				);
				console.log(lines.join("\n") + "\nERRS " + JSON.stringify(errs));
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	}),
];
