import http from "http";
import type { AddressInfo } from "node:net";
import { serverTest } from "../../../testcommon.ts";

// rv5 pass 2: frame / popup mechanics across two real origins (two ports).
// `pages` maps a path to HTML; {A} and {B} are replaced with the two origins.
// "/" on origin A is the test page.

type Pages = Record<string, string>;

const frameTest = (name: string, pages: Pages, timeoutMs = 20000) => {
	let other: http.Server;
	let bPort = 0;
	const t = serverTest({
		name,
		start: async (server, aPort) => {
			const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				const body = pages[path];
				if (body === undefined) {
					console.log(
						"RV5-404 " +
							req.method +
							" " +
							req.url +
							" host=" +
							req.headers.host
					);
					res.writeHead(404);
					res.end("nf");
					return;
				}
				const html = body
					.replaceAll("{A}", `http://localhost:${aPort}`)
					.replaceAll("{B}", `http://localhost:${bPort}`);
				res.writeHead(200, {
					"Content-Type": path.endsWith(".js")
						? "application/javascript"
						: "text/html",
					"Access-Control-Allow-Origin": "*",
					...(path.startsWith("/cookie")
						? {
								"Set-Cookie": "rv5srv" + path.length + "=1; Path=/",
							}
						: {}),
				});
				res.end(html);
			};
			other = http.createServer(handler);
			await new Promise<void>((r) => other.listen(0, () => r()));
			bPort = (other.address() as AddressInfo).port;
			server.on("request", handler);
		},
	});
	const stop = t.stop;
	t.stop = async () => {
		other?.closeAllConnections?.();
		await new Promise<void>((r) => (other ? other.close(() => r()) : r()));
		await stop();
	};
	t.timeoutMs = timeoutMs;
	return t;
};

const top = (
	body: string
) => `<!DOCTYPE html><html><head><title>top</title></head><body>
<script>
const nextMessage = (pred = () => true, ms = 8000) => new Promise((res, rej) => {
	const t = setTimeout(() => rej(new Error("no message within " + ms + "ms")), ms);
	addEventListener("message", function h(e) { if (!pred(e)) return; clearTimeout(t); removeEventListener("message", h); res(e); });
});
const addFrame = (attrs) => new Promise((res) => { const f = document.createElement("iframe"); for (const k in attrs) f.setAttribute(k, attrs[k]); f.onload = () => res(f); document.body.appendChild(f); });
runTest(async () => {
${body}
}, true);
</script></body></html>`;

const child = (js: string) =>
	`<!DOCTYPE html><html><body><p>child</p><script>${js}</script></body></html>`;

export default [
	frameTest("rv5-frames-importmap-dyn-toplevel", {
		"/": top(`
			const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
			const m = await window.__p;
			assertEqual(m.got, "lib", "chunk and dependency via script-inserted import map (top-level doc)");
		`)
			.replace(
				"<head>",
				`<head><script>
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{A}/v2/static/": "{A}/static/", "{A}/lib.js": "{A}/v2/lib.js" } });
	document.currentScript.parentNode.insertBefore(im, document.currentScript);
</script>`
			)
			.replace("<body>", '<body><script src="/v2/bundle.js"></script>'),
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),
	frameTest("rv5-frames-importmap-dyn-toplevel-prefix-only", {
		"/": top(`
			const m = await import("/v2/static/c2.js");
			assertEqual(m.got, "mapped", "prefix-mapped dynamic import via script-inserted import map");
		`).replace(
			"<head>",
			`<head><script>
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{A}/v2/static/": "{A}/static/" } });
	document.head.appendChild(im);
</script>`
		),
		"/static/c2.js": `export const got = "mapped";`,
		"/v2/static/c2.js": `export const got = "unmapped";`,
	}),
	frameTest("rv5-frames-importmap-dyn-toplevel-exact-only", {
		"/": top(`
			const m = await import("/a.js");
			assertEqual(m.got, "b", "exact-mapped dynamic import via script-inserted import map");
		`).replace(
			"<head>",
			`<head><script>
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{A}/a.js": "{A}/b.js" } });
	document.head.appendChild(im);
</script>`
		),
		"/a.js": `export const got = "a";`,
		"/b.js": `export const got = "b";`,
	}),

	frameTest("rv5-frames-importmap-dyn-nested-cross", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "imc");
			await addFrame({ src: "/inner.html" });
			const e = await p;
			assertEqual(e.data.got, "lib", "chunk and dependency via script-inserted import map (nested frame): " + JSON.stringify(e.data));
		`),
		"/inner.html": `<!DOCTYPE html><html><head><script>window.__nested = true;
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{B}/v2/static/": "{B}/static/", "{B}/lib.js": "{B}/v2/lib.js" } });
	document.currentScript.parentNode.insertBefore(im, document.currentScript);
</script></head><body><script crossorigin src="{B}/v2/bundle.js"></script><script>
	(async () => { const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	let r; try { const m = await window.__p; r = { kind: "imc", got: m.got }; } catch (e) { r = { kind: "imc", err: String(e) }; }
	if (parent !== window && window.__nested) parent.postMessage(r, "*"); else window.__r = r; })();
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),
	frameTest("rv5-frames-importmap-dyn-top-cross", {
		"/": `<!DOCTYPE html><html><head><script>
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{B}/v2/static/": "{B}/static/", "{B}/lib.js": "{B}/v2/lib.js" } });
	document.currentScript.parentNode.insertBefore(im, document.currentScript);
</script></head><body><script crossorigin src="{B}/v2/bundle.js"></script><script>
	(async () => { const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	let r; try { const m = await window.__p; r = { kind: "imc", got: m.got }; } catch (e) { r = { kind: "imc", err: String(e) }; }
	if (parent !== window && window.__nested) parent.postMessage(r, "*"); else window.__r = r; })();
</script></body></html>`,
		"/inner.html": `<!DOCTYPE html><html><head><script>
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{B}/v2/static/": "{B}/static/", "{B}/lib.js": "{B}/v2/lib.js" } });
	document.currentScript.parentNode.insertBefore(im, document.currentScript);
</script></head><body><script crossorigin src="{B}/v2/bundle.js"></script><script>
	(async () => { const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	let r; try { const m = await window.__p; r = { kind: "imc", got: m.got }; } catch (e) { r = { kind: "imc", err: String(e) }; }
	if (parent !== window && window.__nested) parent.postMessage(r, "*"); else window.__r = r; })();
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),
	frameTest("rv5-frames-importmap-dyn-nested-same", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "imc");
			await addFrame({ src: "/inner.html" });
			const e = await p;
			assertEqual(e.data.got, "lib", "chunk and dependency via script-inserted import map (nested frame): " + JSON.stringify(e.data));
		`),
		"/inner.html": `<!DOCTYPE html><html><head><script>window.__nested = true;
	const im = document.createElement("script"); im.type = "importmap";
	im.textContent = JSON.stringify({ imports: { "{A}/v2/static/": "{A}/static/", "{A}/lib.js": "{A}/v2/lib.js" } });
	document.currentScript.parentNode.insertBefore(im, document.currentScript);
</script></head><body><script crossorigin src="{A}/v2/bundle.js"></script><script>
	(async () => { const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	let r; try { const m = await window.__p; r = { kind: "imc", got: m.got }; } catch (e) { r = { kind: "imc", err: String(e) }; }
	if (parent !== window && window.__nested) parent.postMessage(r, "*"); else window.__r = r; })();
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),

	frameTest("rv5-frames-importmap-nested-cross", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "imc");
			await addFrame({ src: "/inner.html" });
			const e = await p;
			assertEqual(e.data.got, "lib", "chunk and its dependency loaded in a nested frame: " + JSON.stringify(e.data));
		`),
		"/inner.html": `<!DOCTYPE html><html><head><script type="importmap">{"imports":{"{B}/v2/static/":"{B}/static/","{B}/lib.js":"{B}/v2/lib.js"}}</script></head><body><script crossorigin src="{B}/v2/bundle.js"></script><script>
	(async () => { const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	try { const m = await window.__p; parent.postMessage({ kind: "imc", got: m.got }, "*"); } catch (e) { parent.postMessage({ kind: "imc", err: String(e) }, "*"); } })();
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),
	frameTest("rv5-frames-importmap-nested-same", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "imc");
			await addFrame({ src: "/inner.html" });
			const e = await p;
			assertEqual(e.data.got, "lib", "chunk and its dependency loaded in a nested frame: " + JSON.stringify(e.data));
		`),
		"/inner.html": `<!DOCTYPE html><html><head><script type="importmap">{"imports":{"{A}/v2/static/":"{A}/static/","{A}/lib.js":"{A}/v2/lib.js"}}</script></head><body><script crossorigin src="{A}/v2/bundle.js"></script><script>
	(async () => { const t0 = Date.now(); while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	try { const m = await window.__p; parent.postMessage({ kind: "imc", got: m.got }, "*"); } catch (e) { parent.postMessage({ kind: "imc", err: String(e) }, "*"); } })();
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),

	frameTest("rv5-frames-importmap-crazygames-cross", {
		"/": `<!DOCTYPE html><html><head><title>top</title><script type="importmap">{"imports":{"{B}/v2/static/":"{B}/static/","{B}/lib.js":"{B}/v2/lib.js"}}</script></head><body><script crossorigin src="{B}/v2/bundle.js"></script><script>
runTest(async () => {
	const t0 = Date.now();
	while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	const m = await window.__p;
	assertEqual(m.got, "lib", "chunk and its dependency loaded");
}, true);
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),
	frameTest("rv5-frames-importmap-crazygames-same", {
		"/": `<!DOCTYPE html><html><head><title>top</title><script type="importmap">{"imports":{"{A}/v2/static/":"{A}/static/","{A}/lib.js":"{A}/v2/lib.js"}}</script></head><body><script src="{A}/v2/bundle.js"></script><script>
runTest(async () => {
	const t0 = Date.now();
	while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
	const m = await window.__p;
	assertEqual(m.got, "lib", "chunk and its dependency loaded");
}, true);
</script></body></html>`,
		"/v2/bundle.js": `window.__p = import("./static/c.js");`,
		"/v2/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/static/c.js": `import { v } from "../lib.js"; export const got = v;`,
		"/v2/lib.js": `export const v = "lib";`,
	}),

	frameTest("rv5-frames-dynimport-touched-cross", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "dyn");
			const f = document.createElement("iframe"); f.src = "{B}/game.html"; document.body.appendChild(f);
			void f.contentWindow.document;
			const e = await p;
			assertEqual(e.data.where, "chunk", "chunk loaded: " + JSON.stringify(e.data));
			assertEqual(e.data.meta, "{B}/gf/v2.10/static/chunk.js", "chunk url");
		`),
		"/game.html": `<!DOCTYPE html><html><body><script>
			const s = document.createElement("script"); s.src = "{B}/gf/v2.10/bundle.js"; document.head.appendChild(s);
		</script></body></html>`,
		"/gf/v2.10/bundle.js": `(function(){ import("./static/chunk.js").then(m => parent.postMessage({ kind: "dyn", where: m.where, meta: m.meta }, "*"), e => parent.postMessage({ kind: "dyn", err: String(e) }, "*")); })();`,
		"/gf/v2.10/static/chunk.js": `export const where = "chunk"; export const meta = import.meta.url;`,
	}),
	frameTest("rv5-frames-dynimport-untouched-cross", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "dyn");
			const f = document.createElement("iframe"); f.src = "{B}/game.html"; document.body.appendChild(f);
			
			const e = await p;
			assertEqual(e.data.where, "chunk", "chunk loaded: " + JSON.stringify(e.data));
			assertEqual(e.data.meta, "{B}/gf/v2.10/static/chunk.js", "chunk url");
		`),
		"/game.html": `<!DOCTYPE html><html><body><script>
			const s = document.createElement("script"); s.src = "{B}/gf/v2.10/bundle.js"; document.head.appendChild(s);
		</script></body></html>`,
		"/gf/v2.10/bundle.js": `(function(){ import("./static/chunk.js").then(m => parent.postMessage({ kind: "dyn", where: m.where, meta: m.meta }, "*"), e => parent.postMessage({ kind: "dyn", err: String(e) }, "*")); })();`,
		"/gf/v2.10/static/chunk.js": `export const where = "chunk"; export const meta = import.meta.url;`,
	}),
	frameTest("rv5-frames-dynimport-touched-same", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "dyn");
			const f = document.createElement("iframe"); f.src = "/game.html"; document.body.appendChild(f);
			void f.contentWindow.document;
			const e = await p;
			assertEqual(e.data.where, "chunk", "chunk loaded: " + JSON.stringify(e.data));
			assertEqual(e.data.meta, "{A}/gf/v2.10/static/chunk.js", "chunk url");
		`),
		"/game.html": `<!DOCTYPE html><html><body><script>
			const s = document.createElement("script"); s.src = "{A}/gf/v2.10/bundle.js"; document.head.appendChild(s);
		</script></body></html>`,
		"/gf/v2.10/bundle.js": `(function(){ import("./static/chunk.js").then(m => parent.postMessage({ kind: "dyn", where: m.where, meta: m.meta }, "*"), e => parent.postMessage({ kind: "dyn", err: String(e) }, "*")); })();`,
		"/gf/v2.10/static/chunk.js": `export const where = "chunk"; export const meta = import.meta.url;`,
	}),

	frameTest("rv5-frames-touched-frame-cookies", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "ck");
			const f = document.createElement("iframe"); f.src = "{B}/cookie-child.html"; document.body.appendChild(f);
			void f.contentWindow.document;
			const e = await p;
			assert(e.data.cookie.includes("rv5srv"), "server Set-Cookie visible in touched frame: " + e.data.cookie);
			assert(e.data.cookie.includes("rv5js=1"), "js cookie visible: " + e.data.cookie);
		`),
		"/cookie-child.html": child(
			`document.cookie = "rv5js=1; path=/"; setTimeout(() => parent.postMessage({ kind: "ck", cookie: document.cookie }, "*"), 300);`
		),
	}),
	frameTest("rv5-frames-touch-contentwindow-before-load-crossorigin", {
		"/": top(`
			const p = nextMessage((e) => e.data === "child-alive");
			const f = document.createElement("iframe"); f.src = "{B}/alive.html"; document.body.appendChild(f);
			void f.contentWindow.location; void f.contentWindow.document;
			await p;
			await new Promise((r) => setTimeout(r, 1000));
		`),
		"/alive.html": child(`parent.postMessage("child-alive", "*");`),
	}),
	frameTest("rv5-frames-touch-contentwindow-before-load-sameorigin", {
		"/": top(`
			const p = nextMessage((e) => e.data === "child-alive");
			const f = document.createElement("iframe"); f.src = "/alive.html"; document.body.appendChild(f);
			void f.contentWindow.document;
			await p;
			await new Promise((r) => setTimeout(r, 1000));
		`),
		"/alive.html": child(`parent.postMessage("child-alive", "*");`),
	}),
	frameTest("rv5-frames-touch-contentwindow-before-load-srcdoc", {
		"/": top(`
			const p = nextMessage((e) => e.data === "child-alive");
			const f = document.createElement("iframe"); f.srcdoc = '<script>parent.postMessage("child-alive", "*")<\\/script>'; document.body.appendChild(f);
			void f.contentWindow.document;
			await p;
			await new Promise((r) => setTimeout(r, 1000));
		`),
	}),
	frameTest("rv5-frames-static-iframe-markup", {
		"/": top(`
			await nextMessage((e) => e.data === "child-alive");
			await new Promise((r) => setTimeout(r, 1000));
		`).replace("<body>", '<body><iframe src="{B}/alive.html"></iframe>'),
		"/alive.html": child(`parent.postMessage("child-alive", "*");`),
	}),
	frameTest("rv5-frames-sync-xhr-top", {
		"/": top(`
			const x = new XMLHttpRequest(); x.open("GET", "/blank.html", false); x.send();
			assertEqual(x.status, 200, "sync xhr in top document");
		`),
		"/blank.html": child(``),
	}),
	frameTest("rv5-frames-sync-xhr-about-blank-absolute", {
		"/": top(`
			const f = await addFrame({});
			const x = new f.contentWindow.XMLHttpRequest(); x.open("GET", location.origin + "/blank.html", false); x.send();
			assertEqual(x.status, 200, "sync xhr (absolute URL) from about:blank");
		`),
		"/blank.html": child(``),
	}),
	frameTest("rv5-frames-async-xhr-about-blank", {
		"/": top(`
			const f = await addFrame({});
			const x = new f.contentWindow.XMLHttpRequest(); x.open("GET", location.origin + "/blank.html");
			await new Promise((r, j) => { x.onload = r; x.onerror = () => j(new Error("xhr error")); x.send(); });
			assertEqual(x.status, 200, "async xhr from about:blank");
		`),
		"/blank.html": child(``),
	}),
	frameTest("rv5-frames-friendly-iframe-script-src-same-origin", {
		"/": top(`
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			const d = f.contentDocument;
			d.open();
			d.write('<script src="{A}/adlib.js"><\\/script><script src="/adlib2.js"><\\/script>');
			d.close();
			await new Promise((r) => setTimeout(r, 1500));
			assert(window.__adlib, "absolute same-origin script src written into friendly iframe ran");
			assert(window.__adlib2, "relative script src written into friendly iframe ran");
		`),
		"/adlib.js": `parent.__adlib = 1;`,
		"/adlib2.js": `parent.__adlib2 = 1;`,
	}),
	frameTest("rv5-frames-friendly-iframe-dom-script-src", {
		"/": top(`
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			const s = f.contentDocument.createElement("script"); s.src = "{B}/adlib.js";
			await new Promise((r, j) => { s.onload = r; s.onerror = () => j(new Error("script error")); f.contentDocument.head.appendChild(s); });
			assert(window.__adlib, "script appended into about:blank frame ran");
		`),
		"/adlib.js": `parent.__adlib = 1;`,
	}),
	frameTest("rv5-frames-nested-cross-origin-sandwich", {
		"/": top(`
			const got = nextMessage((e) => e.data && e.data.kind === "inner");
			const f = await addFrame({ src: "{B}/middle.html" });
			const e = await got;
			assertEqual(e.origin, "{A}", "inner (origin A) message origin");
			assertEqual(e.data.parentIsTop, false, "inner: parent !== top");
			assertEqual(e.data.topFrame0IsParent, true, "top.frames[0] === parent");
			assertEqual(e.data.parentFrame0IsSelf, true, "parent.frames[0] === window");
			assertEqual(e.data.topTitle, "top", "same-origin inner reads top.document through a cross-origin middle");
			assertEqual(e.data.topHref, location.href, "inner reads top.location.href");
			assertEqual(e.data.parentHrefThrows, true, "reading cross-origin parent.location.href throws");
			assertEqual(window.__calledFromInner, true, "inner called a function on top directly");
			assertEqual(frames[0] === f.contentWindow, true, "frames[0]");
			assertEqual(f.contentWindow.frames.length, 1, "cross-origin middle frames.length");
		`),
		"/middle.html": `<!DOCTYPE html><html><body><iframe src="{A}/inner.html"></iframe></body></html>`,
		"/inner.html": child(`
			let parentHrefThrows = false; try { void parent.location.href; } catch (e) { parentHrefThrows = true; }
			const T = parent.parent;
			T.__calledFromInner = true;
			T.postMessage({ kind: "inner", parentIsTop: parent === T, topFrame0IsParent: T.frames[0] === parent,
				parentFrame0IsSelf: parent.frames[0] === window, topTitle: T.document.title, topHref: T.location.href, parentHrefThrows }, "{A}");
		`),
	}),
	frameTest("rv5-frames-crossorigin-postmessage-handshake", {
		"/": top(`
			const helloP = nextMessage((e) => e.data === "hello");
			const f = await addFrame({ src: "{B}/child.html" });
			const hello = await helloP;
			assertEqual(hello.origin, "{B}", "hello origin");
			assertEqual(hello.source === f.contentWindow, true, "hello source");
			const ch = new MessageChannel();
			const viaPort = new Promise((res) => { ch.port1.onmessage = (e) => res(e.data); });
			f.contentWindow.postMessage({ kind: "port" }, "{B}", [ch.port2]);
			assertEqual(await viaPort, "port-ok", "port reply");
			const wrong = nextMessage((e) => e.data === "wrong-origin-received", 1500).then(() => true, () => false);
			f.contentWindow.postMessage({ kind: "wrong" }, "http://not-the-child.example");
			assertEqual(await wrong, false, "targetOrigin mismatch must not be delivered");
			const r = nextMessage((e) => e.data && e.data.kind === "reply");
			f.contentWindow.postMessage({ kind: "ping" }, "*");
			const re = await r;
			assertEqual(re.data.origin, "{A}", "child sees parent's origin");
			assertEqual(re.data.sourceIsParent, true, "child sees e.source === parent");
		`),
		"/child.html": child(`
			addEventListener("message", (e) => {
				if (e.data && e.data.kind === "port") { e.ports[0].postMessage("port-ok"); }
				if (e.data && e.data.kind === "wrong") parent.postMessage("wrong-origin-received", "*");
				if (e.data && e.data.kind === "ping") parent.postMessage({ kind: "reply", origin: e.origin, sourceIsParent: e.source === parent }, e.origin);
			});
			parent.postMessage("hello", "{A}");
		`),
	}),
	frameTest("rv5-frames-frameelement", {
		"/": top(`
			const same = await addFrame({ src: "/same.html", id: "sf" });
			assertEqual(same.contentWindow.frameElement === same, true, "same-origin frameElement");
			assertEqual(same.contentWindow.__fe, "sf", "frameElement.id from inside");
			const feP = nextMessage((e) => e.data && e.data.kind === "fe");
			const x = await addFrame({ src: "{B}/x.html" });
			const e = await feP;
			assertEqual(e.data.fe, null, "cross-origin frameElement is null");
			assertEqual(window.frameElement, null, "top frameElement is null");
		`),
		"/same.html": child(
			`window.__fe = window.frameElement && window.frameElement.id;`
		),
		"/x.html": child(
			`let fe; try { fe = window.frameElement; } catch (e) { fe = "threw " + e.name; } parent.postMessage({ kind: "fe", fe: fe === null ? null : String(fe) }, "*");`
		),
	}),
	frameTest("rv5-frames-friendly-iframe-document-write", {
		"/": top(`
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			const d = f.contentDocument;
			d.open();
			d.write('<!DOCTYPE html><html><body><div id="ad">ad</div><script>parent.__fw = { href: location.href, origin: origin, cookieOk: typeof document.cookie === "string", parentTitle: parent.document.title };<\\/script><script src="{B}/adlib.js"><\\/script></body></html>');
			d.close();
			await new Promise((r) => setTimeout(r, 1500));
			assert(window.__fw, "inline script in document.written frame ran");
			assertConsistent("friendly href", __fw.href.replace(/\d+/g, "N"));
			assertEqual(__fw.origin, location.origin, "origin inherited");
			assertEqual(__fw.parentTitle, "top", "reads parent");
			assert(window.__adlib, "cross-origin script src written into friendly iframe ran");
			assertEqual(d.getElementById("ad").textContent, "ad");
		`),
		"/adlib.js": `parent.__adlib = location.href;`,
	}),
	frameTest("rv5-frames-srcdoc", {
		"/": top(`
			const got = nextMessage((e) => e.data && e.data.kind === "srcdoc");
			const f = document.createElement("iframe");
			f.srcdoc = '<script>parent.postMessage({ kind: "srcdoc", href: location.href, origin: origin, t: parent.document.title, base: document.baseURI }, "*")<\\/script>';
			document.body.appendChild(f);
			const e = await got;
			assertEqual(e.origin, location.origin, "message origin");
			assertEqual(e.data.href, "about:srcdoc");
			assertEqual(e.data.origin, location.origin);
			assertEqual(e.data.t, "top");
			assertEqual(e.data.base, location.href, "srcdoc baseURI is parent's URL");
		`),
	}),
	frameTest("rv5-frames-sandboxed", {
		"/": top(`
			let got = nextMessage((e) => e.data && e.data.kind === "sb");
			await addFrame({ src: "/sb.html", sandbox: "allow-scripts" });
			let e = await got;
			assertEqual(e.origin, "null", "opaque sandbox message origin");
			assertEqual(e.data.origin, "null", "self.origin inside sandbox");
			assertEqual(e.data.canTouchParent, false, "cannot touch parent");
			got = nextMessage((e) => e.data && e.data.kind === "sb");
			await addFrame({ src: "/sb.html", sandbox: "allow-scripts allow-same-origin" });
			e = await got;
			assertEqual(e.origin, location.origin, "same-origin sandbox message origin");
			assertEqual(e.data.canTouchParent, true, "allow-same-origin can touch parent");
		`),
		"/sb.html": child(
			`let c = false; try { c = typeof parent.document.title === "string"; } catch (e) {} parent.postMessage({ kind: "sb", origin: self.origin, canTouchParent: c }, "*");`
		),
	}),
	frameTest("rv5-frames-self-navigation", {
		"/": top(`
			const f = await addFrame({ src: "/nav1.html" });
			const e = await nextMessage((e) => e.data && e.data.kind === "nav2");
			assertEqual(e.data.href, location.origin + "/nav2.html?x=1", "navigated child href");
			assertEqual(f.contentWindow.location.pathname, "/nav2.html", "parent reads child pathname");
			assertEqual(e.data.ref, location.origin + "/nav1.html", "referrer");
			f.contentWindow.location.replace("/nav3.html");
			const e3 = await nextMessage((e) => e.data && e.data.kind === "nav3");
			assertEqual(f.contentWindow.location.href, location.origin + "/nav3.html");
			f.src = "{B}/nav3.html";
			const e4 = await nextMessage((e) => e.data && e.data.kind === "nav3" && e.origin === "{B}");
			assertEqual(e4.data.href, "{B}/nav3.html");
		`),
		"/nav1.html": child(
			`setTimeout(() => { location.href = "/nav2.html?x=1"; }, 50);`
		),
		"/nav2.html": child(
			`parent.postMessage({ kind: "nav2", href: location.href, ref: document.referrer }, "*");`
		),
		"/nav3.html": child(
			`parent.postMessage({ kind: "nav3", href: location.href }, "*");`
		),
	}),
	frameTest("rv5-frames-name-targeting", {
		"/": top(`
			const f = await addFrame({ name: "tgt", src: "/blank.html" });
			assertEqual(window.frames["tgt"] === f.contentWindow, true, "frames[name]");
			assertEqual(window.tgt === f.contentWindow, true, "named window property");
			assertEqual(f.contentWindow.name, "tgt", "child window.name");
			const a = document.createElement("a"); a.href = "/landed.html?via=a"; a.target = "tgt"; a.textContent = "go"; document.body.appendChild(a);
			let p = nextMessage((e) => e.data && e.data.kind === "landed");
			a.click();
			let e = await p;
			assertEqual(e.data.search, "?via=a", "a target=name");
			const form = document.createElement("form"); form.action = "/landed.html"; form.method = "GET"; form.target = "tgt";
			const i = document.createElement("input"); i.name = "via"; i.value = "form"; form.appendChild(i); document.body.appendChild(form);
			p = nextMessage((e) => e.data && e.data.kind === "landed");
			form.submit();
			e = await p;
			assertEqual(e.data.search, "?via=form", "form target=name");
			p = nextMessage((e) => e.data && e.data.kind === "landed");
			const w = window.open("/landed.html?via=open", "tgt");
			e = await p;
			assertEqual(e.data.search, "?via=open", "window.open(url, name) targets the iframe");
			assertEqual(w === f.contentWindow, true, "window.open returns the iframe's window");
			p = nextMessage((e) => e.data && e.data.kind === "landed");
			const x = await addFrame({ name: "xtgt", src: "{B}/blank.html" });
			const a2 = document.createElement("a"); a2.href = "{B}/landed.html?via=xa"; a2.target = "xtgt"; document.body.appendChild(a2);
			a2.click();
			e = await p;
			assertEqual(e.data.search, "?via=xa", "a target=name into cross-origin frame");
			assertEqual(e.origin, "{B}");
		`),
		"/blank.html": child(``),
		"/landed.html": child(
			`parent.postMessage({ kind: "landed", search: location.search, name: window.name }, "*");`
		),
	}),
	frameTest("rv5-frames-frames-collection", {
		"/": top(`
			const a = await addFrame({ src: "/blank.html" });
			const b = await addFrame({ src: "{B}/blank.html" });
			assertEqual(frames.length, 2, "frames.length"); assertEqual(window.length, 2, "window.length");
			assertEqual(frames[0] === a.contentWindow, true); assertEqual(frames[1] === b.contentWindow, true);
			assertEqual(frames === window, true, "frames === window");
			assertEqual(a.contentWindow.parent === window, true, "child.parent");
			assertEqual(a.contentWindow.top === window.top, true, "child.top");
			assertEqual(b.contentWindow.parent === window, true, "cross-origin child.parent");
			let threw = false; try { void b.contentWindow.document; } catch (e) { threw = true; }
			const doc = (() => { try { return b.contentDocument; } catch (e) { return "threw"; } })();
			assertEqual(doc, null, "cross-origin contentDocument is null");
			let locThrew = false; try { void b.contentWindow.location.href; } catch (e) { locThrew = e.name; }
			assertEqual(locThrew, "SecurityError", "cross-origin location.href read throws SecurityError");
			b.contentWindow.location = "{B}/landed.html?set=1";
			const e = await nextMessage((e) => e.data && e.data.kind === "landed");
			assertEqual(e.data.search, "?set=1", "cross-origin location set allowed");
		`),
		"/blank.html": child(``),
		"/landed.html": child(
			`parent.postMessage({ kind: "landed", search: location.search }, "*");`
		),
	}),
	frameTest("rv5-frames-popup-same-origin", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "popup");
			const w = window.open("/popup.html", "rv5pop", "width=400,height=400");
			assert(w, "window.open returned a window");
			const e = await p;
			assertEqual(e.source === w, true, "e.source === popup");
			assertEqual(e.origin, location.origin);
			assertEqual(e.data.openerIsParent, true, "popup: opener === our window");
			assertEqual(w.location.pathname, "/popup.html", "read popup location");
			assertEqual(w.document.title, "popup", "read popup document");
			assertEqual(w.opener === window, true, "w.opener");
			assertEqual(w.name, "rv5pop", "popup name");
			w.close();
			await new Promise((r) => setTimeout(r, 500));
			assertEqual(w.closed, true, "closed after close()");
		`),
		"/popup.html": `<!DOCTYPE html><html><head><title>popup</title></head><body><script>opener.postMessage({ kind: "popup", openerIsParent: !!opener && opener.document.title === "top" }, "*");</script></body></html>`,
	}),
	frameTest("rv5-frames-popup-oauth-flow", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "oauth");
			const w = window.open("{B}/authorize?state=s1", "oauth", "width=500,height=600");
			const e = await p;
			assertEqual(e.origin, location.origin, "callback posted from our origin");
			assertEqual(e.data.code, "c123");
			assertEqual(e.data.state, "s1");
			assertEqual(e.source === w, true, "source is popup");
			let ok = false; for (let i = 0; i < 30 && !ok; i++) { await new Promise((r) => setTimeout(r, 100)); ok = w.closed; }
			assertEqual(ok, true, "popup closed itself");
		`),
		"/authorize": child(`
			if (!window.opener) document.title = "noopener";
			const s = new URLSearchParams(location.search).get("state");
			opener.postMessage({ kind: "progress" }, "{A}");
			location.href = "{A}/callback?code=c123&state=" + s;
		`),
		"/callback": child(`
			const q = new URLSearchParams(location.search);
			window.opener.postMessage({ kind: "oauth", code: q.get("code"), state: q.get("state") }, location.origin);
			window.close();
		`),
	}),
	frameTest("rv5-frames-popup-cross-origin-opener", {
		"/": top(`
			const p = nextMessage((e) => e.data && e.data.kind === "xpop");
			const w = window.open("{B}/xpop.html");
			const e = await p;
			assertEqual(e.origin, "{B}");
			assertEqual(e.source === w, true);
			assertEqual(e.data.hasOpener, true);
			assertEqual(e.data.openerLocThrows, true, "cross-origin opener.location read throws");
			let t = false; try { void w.document; } catch (x) { t = true; }
			assertEqual(t, true, "reading cross-origin popup document throws");
			w.postMessage("to-popup", "{B}");
			const back = await nextMessage((e) => e.data === "popup-got:to-popup:{A}");
			w.close();
		`),
		"/xpop.html": child(`
			let t = false; try { void opener.location.href; } catch (e) { t = true; }
			addEventListener("message", (e) => opener.postMessage("popup-got:" + e.data + ":" + e.origin, "*"));
			opener.postMessage({ kind: "xpop", hasOpener: !!opener, openerLocThrows: t }, "*");
		`),
	}),
	frameTest("rv5-frames-noopener", {
		"/": top(`
			const w = window.open("/np.html", "_blank", "noopener");
			assertEqual(w, null, "noopener returns null");
			const bc = new BroadcastChannel("np");
			const e = await new Promise((res, rej) => { bc.onmessage = (e) => res(e.data); setTimeout(() => rej(new Error("no bc")), 6000); });
			assertEqual(e, "opener:null", "popup has no opener");
		`),
		"/np.html": child(
			`new BroadcastChannel("np").postMessage("opener:" + String(window.opener));`
		),
	}),
	frameTest("rv5-frames-about-blank-script-injection", {
		"/": top(`
			const f = await addFrame({});
			const w = f.contentWindow;
			const s = w.document.createElement("script");
			s.textContent = "window.__inner = [location.href, typeof fetch, origin]";
			w.document.body.appendChild(s);
			assertEqual(w.__inner[0], "about:blank");
			assertEqual(w.__inner[1], "function");
		`),
	}),
	frameTest("rv5-frames-about-blank-fetch-relative", {
		"/": top(`
			const f = await addFrame({});
			const r = await f.contentWindow.fetch("/blank.html");
			assertEqual(r.status, 200, "fetch('/x') from about:blank frame resolves against the parent URL");
			assertEqual(r.url, location.origin + "/blank.html");
		`),
		"/blank.html": child(``),
	}),
	frameTest("rv5-frames-about-blank-fetch-inline-script", {
		"/": top(`
			const f = await addFrame({});
			const w = f.contentWindow;
			const s = w.document.createElement("script");
			s.textContent = "window.__p = fetch('/blank.html').then(r => r.status + ' ' + r.url)";
			w.document.body.appendChild(s);
			assertEqual(await w.__p, "200 " + location.origin + "/blank.html", "fetch from script inside about:blank frame");
		`),
		"/blank.html": child(``),
	}),
	frameTest("rv5-frames-about-blank-xhr-relative", {
		"/": top(`
			const f = await addFrame({});
			const x = new f.contentWindow.XMLHttpRequest(); x.open("GET", "/blank.html", false); x.send();
			assertEqual(x.status, 200, "sync xhr from about:blank");
		`),
		"/blank.html": child(``),
	}),
	frameTest("rv5-frames-about-blank-img-src", {
		"/": top(`
			const f = await addFrame({});
			const img = f.contentWindow.document.createElement("img"); img.src = "/blank.html";
			assertEqual(img.src, location.origin + "/blank.html", "img.src in about:blank resolves against parent");
		`),
	}),
	frameTest("rv5-frames-about-blank-origin", {
		"/": top(`
			const f = await addFrame({});
			assertEqual(f.contentWindow.origin, location.origin, "inherited origin");
			assertEqual(f.contentWindow.location.href, "about:blank");
		`),
	}),
];
