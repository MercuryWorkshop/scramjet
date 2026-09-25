import { serverTest } from "../../../testcommon.ts";

// A child realm hooked by its parent (about:blank / srcdoc / touched-before-
// load iframe, window.open popup) runs the *parent realm's* module code. On
// develop every module declares its interceptor as `class extends X`, and `X`
// is resolved in the parent realm's global at hook time - i.e. after the
// parent page's own scripts have run. `Intercept` then keys everything off
// `X.name`. Main named members by string path from the child's own global.
//
// So a parent page that replaced a global constructor with its own wrapper
// (New Relic / Pace.js / xhook / ajax-hook style `window.XMLHttpRequest =
// function newXHR(){...}`, `window.WebSocket = function(url,p){...}`)
// silently disables that interface's interception in every child realm it
// hooks afterwards.
function hits() {
	const seen: string[] = [];
	return {
		seen,
		attach(server: any) {
			server.on("request", (req: any, res: any) => {
				if (req.url === "/" || req.url === "/script.js") return;
				seen.push(req.url);
				res.writeHead(200, {
					"Content-Type": "text/plain",
					"Access-Control-Allow-Origin": "*",
				});
				res.end("hit:" + req.url);
			});
		},
	};
}

const childXhr = (label: string, getChild: string) => `
const w = ${getChild};
const x = new w.XMLHttpRequest();
const done = new Promise((r) => { x.onloadend = () => r(); setTimeout(r, 3000); });
x.open("GET", "/rv12-${label}");
x.send();
await done;
return { status: x.status, text: x.responseText.slice(0, 40), responseURL: x.responseURL };
`;

const wrapXhr = {
	// New Relic's browser agent: a named wrapper function
	newrelic: `
const OrigXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function newXHR(opts) { const x = new OrigXHR(opts); return x; };
window.XMLHttpRequest.prototype = OrigXHR.prototype;
`,
	// Pace.js / ajax-hook: an anonymous function (name "")
	pace: `
const OrigXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function (flags) { return new OrigXHR(flags); };
window.XMLHttpRequest.prototype = OrigXHR.prototype;
`,
	none: "",
};

const tests = [];
for (const [kind, wrap] of Object.entries(wrapXhr)) {
	for (const [frameKind, make] of Object.entries({
		blank: `(() => { const f = document.createElement("iframe"); document.body.appendChild(f); return f.contentWindow; })()`,
		srcdoc: `await new Promise((r) => { const f = document.createElement("iframe"); f.srcdoc = "<p>x</p>"; f.onload = () => r(f.contentWindow); document.body.appendChild(f); })`,
	})) {
		const h = hits();
		const label = `${kind}-${frameKind}`;
		tests.push(
			serverTest({
				name: `rv12-parentglobals-xhr-${label}`,
				scramjetOnly: true,
				start: async (server) => h.attach(server),
				js: `
${wrap}
const r = await (async () => { ${childXhr(label, make)} })();
// about:blank/srcdoc subresources 404 on both builds (known, bucket 4 #5), so
// the signal is responseURL: the intercepted getter answers with the site's
// URL, an unintercepted XHR shows the raw proxy-origin URL it really hit
const SJ = Symbol.for("scramjet client global");
const cw = document.querySelector("iframe").contentWindow;
const patched = cw[SJ] && cw[SJ].patched ? !!(cw[SJ].patched.get(cw.XMLHttpRequest.prototype) || new Set()).has("open") : "n/a";
assertEqual(new URL(r.responseURL).origin, location.origin, "child-realm XHR went through the proxy: " + JSON.stringify(r) + " open patched=" + patched);
pass();
`,
			})
		);
	}
}

// the WebSocket variant: Pace.js replaces window.WebSocket with an anonymous
// wrapper. An unintercepted child WebSocket connects straight to the site,
// bypassing the proxy - visible to the server as an Origin of the proxy
// itself rather than the site's.
const wsHits = hits();
tests.push(
	serverTest({
		name: "rv12-parentglobals-ws-pace-blank",
		scramjetOnly: true,
		start: async (server, port) => {
			const { WebSocketServer } = await import("ws");
			const wss = new WebSocketServer({
				server,
			});
			wss.on("connection", (sock: any, req: any) => {
				sock.send(
					JSON.stringify({
						origin: req.headers.origin ?? null,
					})
				);
			});
			void port;
		},
		js: `
const Orig = window.WebSocket;
window.WebSocket = function (url, protocols) { return protocols === undefined ? new Orig(url) : new Orig(url, protocols); };
window.WebSocket.prototype = Orig.prototype;
const f = document.createElement("iframe"); document.body.appendChild(f);
const w = f.contentWindow;
const port = location.port;
const ws = new w.WebSocket("ws://localhost:" + port + "/");
const msg = await new Promise((r) => { ws.onmessage = (e) => r(e.data); ws.onerror = () => r("error"); setTimeout(() => r("timeout"), 3000); });
const origin = msg.startsWith("{") ? JSON.parse(msg).origin : msg;
assertEqual(origin, location.origin, "child WebSocket went through the proxy (server saw the site origin): " + msg);
pass();
`,
	})
);
void wsHits;

export default tests;

// Prototype.js (1.6/1.7, still on Magento 1 / legacy Rails sites) replaces
// window.Element with an anonymous constructor function and copies the
// prototype over. On develop every `class extends Element` interceptor in an
// about:blank child the page creates afterwards resolves to that function,
// whose name is "", and is skipped.
const elemSeen: any[] = [];
tests.push(
	serverTest({
		name: "rv12-parentglobals-element-prototypejs-blank",
		scramjetOnly: true,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (req.url.startsWith("/rv12-seen")) {
					res.writeHead(200, {
						"Content-Type": "application/json",
					});
					res.end(JSON.stringify(elemSeen));
					return;
				}
				if (req.url.startsWith("/rv12-direct")) {
					elemSeen.push({
						url: req.url,
						referer: req.headers.referer ?? null,
						h: Object.keys(req.headers).join(","),
						conn: req.socket.remoteAddress,
					});
					res.writeHead(200, {
						"Content-Type": "image/gif",
					});
					res.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
				}
			});
		},
		js: `
(function (global) {
  var element = global.Element;
  global.Element = function (tagName, attributes) { return document.createElement(tagName); };
  for (var k in element) global.Element[k] = element[k];
  global.Element.prototype = element.prototype;
})(window);
const f = document.createElement("iframe"); document.body.appendChild(f);
const w = f.contentWindow, d = w.document;
const SJ = Symbol.for("scramjet client global");
const set = w[SJ].patched ? w[SJ].patched.get(w.Element.prototype) : null;
const patchedElement = w[SJ].patched ? (set ? [...set].sort().join(",") : "") : "(main: no patched table)";
{ const ci = new Image(); ci.src = location.origin + "/rv12-direct-control.gif"; document.body.appendChild(ci); }
// an absolute URL, so an unrewritten load goes straight to the site
d.body.innerHTML = '<img id=i src="' + location.origin + '/rv12-direct-innerhtml.gif">';
const im = d.createElement("img"); im.setAttribute("src", location.origin + "/rv12-direct-setattr.gif"); d.body.appendChild(im);
await new Promise((r) => setTimeout(r, 800));
const seen = await (await fetch("/rv12-seen")).json();
// a load that went through the proxy arrives from the transport (libcurl over
// wisp: http2-settings/upgrade headers, the site as referer); a direct one is
// the browser itself connecting to the site, bypassing the proxy
const direct = seen.filter((s) => !s.url.includes("control") && !s.h.includes("http2-settings"));
assertEqual(direct.length, 0, "child loads bypassed the proxy: " + JSON.stringify(seen) + " / child Element.prototype patched: [" + patchedElement + "]");
pass();
`,
	})
);

// the same through a real page in an iframe that the parent touched before it
// loaded: Chrome reuses the initial about:blank Window for the navigation, so
// the parent-built client (and its missing interceptors) is the one the child
// page runs under
tests.push(
	serverTest({
		name: "rv12-parentglobals-xhr-newrelic-touched-page",
		scramjetOnly: true,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (req.url === "/child.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!DOCTYPE html><html><body><script>
const x = new XMLHttpRequest();
x.onloadend = () => parent.postMessage({ rv12: 1, status: x.status, text: x.responseText.slice(0, 20), responseURL: x.responseURL }, "*");
x.open("GET", "/rv12-api");
x.send();
</script></body></html>`);
					return;
				}
				if (req.url === "/rv12-api") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("api-ok");
				}
			});
		},
		js: `
const OrigXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function newXHR(opts) { return new OrigXHR(opts); };
window.XMLHttpRequest.prototype = OrigXHR.prototype;
const got = new Promise((r) => { addEventListener("message", (e) => { if (e.data && e.data.rv12) r(e.data); }); setTimeout(() => r("timeout"), 5000); });
const f = document.createElement("iframe"); f.src = "/child.html"; document.body.appendChild(f);
void f.contentWindow; // touched before load, as players/SDKs do
const r = await got;
assertEqual(r.text, "api-ok", "child page XHR reached the site: " + JSON.stringify(r));
pass();
`,
	})
);

// Not even a wrapper is needed: a top-level `var`/`let`/`const` in a classic
// script is resolved by the bundle's free identifiers too. A legacy helper
// object named after an interface makes `class extends Storage` throw in the
// child hook ("Class extends value #<Object> is not a constructor"), the
// module is skipped, and the child sees the raw, shared proxy-origin storage
// area - every proxied site's keys.
tests.push(
	serverTest({
		name: "rv12-parentglobals-var-storage-blank",
		scramjetOnly: true,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (req.url === "/page.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!DOCTYPE html><html><body><script>
var Storage = { get: function (k) { return localStorage.getItem(k); } };
var Cache = { items: {} };
</script><script src="/script.js"></script></body></html>`);
				}
			});
		},
		js: `
if (!location.pathname.endsWith("/page.html")) { location.href = "/page.html"; await new Promise(() => {}); }
localStorage.setItem("rv12-parent", "1");
const f = document.createElement("iframe"); document.body.appendChild(f);
const w = f.contentWindow;
const keys = Object.keys(w.localStorage);
const leaked = keys.filter((k) => k.includes("@"));
assertEqual(leaked.length, 0, "child localStorage exposes the shared, unscoped area: " + JSON.stringify(keys));
pass();
`,
	})
);

// The cross-site version (site B reading site A's localStorage) lives in the
// probe at ~/.cache/sjreview/scratch-a12/p10 (run through rv12-probe.ts): it
// needs two top-level navigations, which runTest's single page can't host.
