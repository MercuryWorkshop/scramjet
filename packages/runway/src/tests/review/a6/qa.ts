import http from "http";
import {
	basicTest,
	htmlTest,
	serverTest,
	playwrightTest,
	type Test,
} from "../../../testcommon.ts";

async function serve(
	files: Record<string, [string, string]>,
	onReq?: (url: string) => void
) {
	const server = http.createServer((req, res) => {
		onReq?.(req.url || "/");
		const f = files[(req.url || "/").split("?")[0]];
		if (!f) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {
			"Content-Type": f[0],
		});
		res.end(f[1]);
	});
	await new Promise<void>((r) => server.listen(0, () => r()));
	return {
		server,
		port: (server.address() as any).port as number,
	};
}
async function findFrame(page: any, needle: string) {
	for (let t = 0; t < 150; t++) {
		const f = page.frames().find((f: any) => f.url().includes(needle));
		if (f && (await f.evaluate(() => (window as any).__ready).catch(() => 0)))
			return f;
		await page.waitForTimeout(100);
	}
	throw new Error("frame not found " + needle);
}
const H = "text/html",
	J = "application/javascript";

const tests: Test[] = [];

// ---- #7 opaque-origin storage scope
tests.push(
	playwrightTest({
		name: "rv6-qa-opaque-storage",
		fn: async ({ page, navigate }) => {
			const { server, port } = await serve({
				"/": [
					H,
					`<!doctype html><body><script>window.__ready=1</script></body>`,
				],
			});
			await navigate(`http://localhost:${port}/?opq`);
			const frame = await findFrame(page, "%3Fopq");
			const before = await page.evaluate(() => Object.keys(localStorage));
			const results = await frame.evaluate(async () => {
				const out: any[] = [];
				for (let i = 0; i < 3; i++) {
					const f = document.createElement("iframe");
					f.src =
						"data:text/html,<script>try{localStorage.setItem('opq" +
						i +
						"','v');parent.postMessage('stored','*')}catch(e){parent.postMessage('threw '+e.name,'*')}<\/script>";
					const p = new Promise((r) =>
						addEventListener("message", (e) => r(e.data), {
							once: true,
						})
					);
					document.body.appendChild(f);
					out.push(
						await Promise.race([
							p,
							new Promise((r) => setTimeout(() => r("timeout"), 4000)),
						])
					);
					f.remove();
				}
				return out;
			});
			const after = await page.evaluate(() => Object.keys(localStorage));
			const added = after.filter((k) => !before.includes(k));
			server.close();
			throw new Error(
				"RESULT frames=" +
					JSON.stringify(results) +
					" newRealKeys=" +
					JSON.stringify(added)
			);
		},
	})
);

// ---- #10 fetch.intercept / fetch.response hook carriers
tests.push(
	playwrightTest({
		name: "rv6-qa-intercept-carriers",
		fn: async ({ page, navigate }) => {
			const { server, port } = await serve({
				"/": [
					H,
					`<!doctype html><body><script>window.__ready=1</script></body>`,
				],
				"/real": [H, `real`],
			});
			await page.evaluate(() => {
				const w: any = window;
				const hooks = w.__runwayScramjetFrame.hooks.fetch;
				const push = (hook: any, cb: any) => {
					const l = (hook.tap.callbacks[hook.key] ||= []);
					l.push({
						callback: cb,
						plugin: {
							name: "rv6",
							tapOrder: {},
						},
						order: {},
					});
				};
				push(hooks.intercept, (ctx: any, props: any) => {
					if (!ctx.parsed.url.pathname.startsWith("/intercepted")) return;
					props.response = {
						body: "hello",
						status: 200,
						statusText: "OK",
						headers: w.$scramjet.ScramjetHeaders.fromRawHeaders([
							["content-type", "text/plain"],
							["x-rv6", "yes"],
						]),
					};
				});
				push(hooks.response, (ctx: any, props: any) => {
					if (!ctx.parsed.url.pathname.startsWith("/real")) return;
					props.response.headers.set("x-rv6-added", "yes");
				});
			});
			await navigate(`http://localhost:${port}/?hk`);
			const frame = await findFrame(page, "%3Fhk");
			const r = await frame.evaluate(async () => {
				const a = await fetch("/intercepted");
				const b = await fetch("/real");
				let xh: any = "n/a";
				await new Promise<void>((res) => {
					const x = new XMLHttpRequest();
					x.open("GET", "/intercepted");
					x.onloadend = () => {
						xh = x.getResponseHeader("x-rv6");
						res();
					};
					x.send();
				});
				return {
					interceptedBody: await a.text(),
					interceptedHeader: a.headers.get("x-rv6"),
					interceptedCT: a.headers.get("content-type"),
					responseTapHeader: b.headers.get("x-rv6-added"),
					xhr: xh,
				};
			});
			server.close();
			throw new Error("RESULT " + JSON.stringify(r));
		},
	})
);

// ---- #16 import-map URL-like key from a cross-origin (CDN) importer
{
	let second: http.Server;
	const t = serverTest({
		name: "rv6-qa-importmap-cdn-key",
		autoPass: true,
		js: `
			const sp = await (await fetch("/second-port")).text();
			const CDN = "http://127.0.0.1:" + sp;
			const im = document.createElement("script"); im.type = "importmap";
			im.textContent = JSON.stringify({ imports: { [CDN + "/lib.js"]: "/shim.js" } });
			document.head.appendChild(im);
			const inl = await import(CDN + "/lib.js");
			const viaCdn = await import(CDN + "/entry.js");
			throw new Error("RESULT inlineImport=" + inl.who + " cdnStaticImport=" + viaCdn.who);
		`,
		start: async (server) => {
			second = http.createServer((req, res) => {
				const p = (req.url || "").split("?")[0];
				res.setHeader("Access-Control-Allow-Origin", "*");
				if (p === "/lib.js") {
					res.writeHead(200, {
						"Content-Type": J,
					});
					res.end(`export const who = "cdn-lib";`);
					return;
				}
				if (p === "/entry.js") {
					res.writeHead(200, {
						"Content-Type": J,
					});
					res.end(`import { who } from "${"/lib.js"}"; export { who };`);
					return;
				}
				res.writeHead(404);
				res.end();
			});
			await new Promise<void>((r) => second.listen(0, () => r()));
			const sp = (second.address() as any).port;
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				if (req.url === "/second-port") {
					res.writeHead(200);
					res.end(String(sp));
				} else if ((req.url || "").startsWith("/shim.js")) {
					res.writeHead(200, {
						"Content-Type": J,
					});
					res.end(`export const who = "mapped-shim";`);
				}
			});
		},
	});
	const stop = t.stop;
	t.stop = async () => {
		second.close();
		await stop();
	};
	t.timeoutMs = 15000;
	tests.push(t);
}

// ---- #17 noscript in scripting-disabled documents
tests.push(
	playwrightTest({
		name: "rv6-qa-noscript-disabled-doc",
		fn: async ({ page, navigate }) => {
			const hits: string[] = [];
			const { server, port } = await serve(
				{
					"/": [
						H,
						`<!doctype html><body><script>window.__ready=1</script></body>`,
					],
				},
				(u) => hits.push(u)
			);
			const reqs: string[] = [];
			page.on("request", (r: any) => {
				if (r.url().includes("rv6ns")) reqs.push(r.url());
			});
			await navigate(`http://localhost:${port}/?ns`);
			const frame = await findFrame(page, "%3Fns");
			const r = await frame.evaluate(async () => {
				const doc = document.implementation.createHTMLDocument("x");
				doc.body.innerHTML =
					'<noscript><img id="i" src="/rv6ns-a.png"></noscript>';
				const inDoc = doc.getElementById("i");
				const attr = inDoc ? inDoc.getAttribute("src") : "no element";
				const n = doc.body.firstChild as Element;
				document.body.appendChild(document.adoptNode(n));
				await new Promise((r) => setTimeout(r, 500));
				const dp = new DOMParser().parseFromString(
					'<noscript><img src="/rv6ns-b.png"></noscript>',
					"text/html"
				);
				const dpi = dp.querySelector("img");
				return {
					createDocImg: attr,
					domparserImg: dpi ? dpi.getAttribute("src") : "no element",
				};
			});
			await page.waitForTimeout(500);
			server.close();
			throw new Error(
				"RESULT " +
					JSON.stringify(r) +
					" browserRequests=" +
					JSON.stringify(reqs) +
					" originHits=" +
					JSON.stringify(hits.filter((h) => h.includes("rv6ns")))
			);
		},
	})
);

// ---- #18 $top fragment
tests.push(
	playwrightTest({
		name: "rv6-qa-top-fragment",
		fn: async ({ page, navigate }) => {
			const hits: string[] = [];
			const { server, port } = await serve(
				{
					"/": [
						H,
						`<!doctype html><body><iframe src="/frame"></iframe><script>window.__ready=1</script></body>`,
					],
					"/frame": [
						H,
						`<!doctype html><body><img src="/rv6img.png"><script>fetch("/rv6fetch")</script></body>`,
					],
				},
				(u) => hits.push(u)
			);
			const reqs: string[] = [];
			page.on("request", (r: any) => {
				if (r.url().includes("rv6")) reqs.push(decodeURIComponent(r.url()));
			});
			await navigate(`http://localhost:${port}/?tf#access_token=SECRET123`);
			await page.waitForTimeout(2500);
			server.close();
			throw new Error(
				"RESULT proxyUrls=" +
					JSON.stringify(reqs) +
					" originSaw=" +
					JSON.stringify(hits)
			);
		},
	})
);

// ---- #24 sync XHR refused in open()
tests.push(
	basicTest({
		name: "rv6-qa-syncxhr-open",
		js: `
	let where = "none";
	const x = new XMLHttpRequest();
	try { x.open("GET", "/", false); } catch (e) { where = "open:" + e.name; }
	if (where === "none") { try { x.send(); where = "ok status=" + x.status; } catch (e) { where = "send:" + e.name; } }
	assertConsistent("sync-xhr", where);
	throw new Error("RESULT " + where);
`,
	})
);

// ---- #26 bytesToBase64 with page-replaced Function.prototype.call
tests.push(
	basicTest({
		name: "rv6-qa-b64-call",
		js: `
	const orig = Function.prototype.call;
	let calls = 0;
	Function.prototype.call = function (...a) { calls++; return orig.apply(this, a); };
	const s = document.createElement("script");
	s.textContent = "window.__b64ran = 1";
	document.body.appendChild(s);
	const t = s.textContent;
	Function.prototype.call = function () { throw new Error("hostile call"); };
	let err = "none";
	let stack = "";
	try { const s2 = document.createElement("script"); s2.textContent = "window.__b64ran2 = 1"; document.body.appendChild(s2); void s2.textContent; } catch (e) { err = e.message; stack = String(e.stack).split(String.fromCharCode(10)).slice(1, 6).join(" | "); }
	Function.prototype.call = orig;
	throw new Error("RESULT wrappedCallsDuringInsert=" + calls + " ran=" + window.__b64ran + " ran2=" + window.__b64ran2 + " text=" + JSON.stringify(t) + " err=" + err + " stack=" + stack);
`,
	})
);

// ---- #27 saveNatives eager global reads: throwing getter on a not-yet-hooked frame
tests.push(
	basicTest({
		name: "rv6-qa-savenatives-throwing-getter",
		js: `
	const f = document.createElement("iframe");
	document.body.appendChild(f);
	const w = window.frames[window.frames.length - 1];
	let defined = "no";
	try {
		Object.defineProperty(w, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); }, configurable: true });
		defined = "yes";
	} catch (e) { defined = "threw " + e.message; }
	let loc, err = "none";
	try { loc = f.contentWindow.eval("location.href"); } catch (e) { err = e.name + ": " + e.message; }
	throw new Error("RESULT defined=" + defined + " frameLocation=" + loc + " err=" + err);
`,
	})
);

tests.push(
	basicTest({
		name: "rv6-qa-savenatives-control",
		js: `
	const f = document.createElement("iframe");
	document.body.appendChild(f);
	const w = window.frames[window.frames.length - 1];
	void w.length;
	let loc, err = "none";
	try { loc = f.contentWindow.eval("location.href"); } catch (e) { err = e.name + ": " + e.message; }
	throw new Error("RESULT frameLocation=" + loc + " err=" + err);
`,
	})
);
tests.push(
	basicTest({
		name: "rv6-qa-savenatives-throwing-getter-contentwindow",
		js: `
	const f = document.createElement("iframe");
	document.body.appendChild(f);
	const w = window.frames[window.frames.length - 1];
	Object.defineProperty(w, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); }, configurable: true });
	let r = "none";
	try { const cw = f.contentWindow; r = "hooked=" + (typeof cw.$scramjet$wrap) + " fetchIsNative=" + /native code/.test(cw.Function.prototype.toString.call(cw.fetch)); } catch (e) { r = "contentWindow threw " + e.name + ": " + e.message; }
	throw new Error("RESULT " + r);
`,
	})
);

tests.push(
	basicTest({
		name: "rv6-qa-savenatives-variants",
		js: `
	const out = {};
	for (const [label, setup] of [
		["control-no-define", (w) => void w.length],
		["benign-define", (w) => Object.defineProperty(w, "rv6foo", { get() { return 1; }, configurable: true })],
		["throw-localStorage", (w) => Object.defineProperty(w, "localStorage", { get() { throw new Error("x"); }, configurable: true })],
		["throw-innerWidth", (w) => Object.defineProperty(w, "innerWidth", { get() { throw new Error("x"); }, configurable: true })],
		["throw-custom-own", (w) => Object.defineProperty(w, "rv6bar", { get() { throw new Error("x"); }, configurable: true, enumerable: true })],
	]) {
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const w = window.frames[window.frames.length - 1];
		try { setup(w); } catch (e) { out[label] = "setup threw " + e.message; continue; }
		try { const cw = f.contentWindow; const loc = cw.eval("location.href"); out[label] = "hooked loc=" + loc; } catch (e) { out[label] = "UNHOOKED? " + e.message; try { out[label] += " rawFnLocation=" + new f.contentWindow.Function("return location.href")() + " rawFetchTypeofClient=" + (typeof f.contentWindow[Symbol.for("scramjet client global")]); } catch (e2) { out[label] += " fn threw " + e2.message; } }
		f.remove();
	}
	throw new Error("RESULT " + JSON.stringify(out));
`,
	})
);

// ---- CSP <meta> comment breakout
tests.push(
	htmlTest({
		name: "rv6-qa-csp-meta-breakout",
		html: `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' --><script>window.__raw = location.href</script><!--"></head><body><script>
		runTest(async () => { throw new Error("RESULT rawScriptRan=" + (window.__raw !== undefined) + " rawLocation=" + window.__raw); });
	</script></body></html>`,
	})
);

// ---- case-insensitive javascript:
tests.push(
	basicTest({
		name: "rv6-qa-javascript-case",
		js: `
	const out = {};
	for (const scheme of ["javascript:", "JavaScript:", " javascript:", "JAVASCRIPT:", "java\\tscript:"]) {
		const a = document.createElement("a");
		a.href = scheme + "window.__jsloc = location.href; void 0";
		document.body.appendChild(a);
		window.__jsloc = undefined;
		a.click();
		await new Promise((r) => setTimeout(r, 100));
		out[JSON.stringify(scheme)] = window.__jsloc === undefined ? "did-not-run" : (window.__jsloc.includes("/~/") ? "RAW(proxy url)" : "wrapped");
		a.remove();
	}
	throw new Error("RESULT " + JSON.stringify(out));
`,
	})
);

{
	const fe = basicTest({
		name: "rv6-qa-flageditor-boolean-incumbency",
		js: `
		throw new Error("RESULT scriptSees location=" + location.href + " wrapped=" + !location.href.includes("/~/"));
	`,
	});
	(fe as any).incumbencyMode = false;
	fe.scramjetOnly = true;
	tests.push(fe);
}
{
	const mo = basicTest({
		name: "rv6-qa-mutationobserver-script",
		js: `
		const recs = [];
		const mo = new MutationObserver((l) => { for (const r of l) recs.push(r.type + ":" + r.addedNodes.length + "/" + r.removedNodes.length); });
		const s = document.createElement("script");
		document.body.appendChild(s);
		mo.observe(document.body, { childList: true, subtree: true, characterData: true });
		s.textContent = "window.__mo = 1";
		await new Promise((r) => setTimeout(r, 50));
		mo.disconnect();
		assertConsistent("mo-records", recs.join(","));
		const recs2 = [];
		const s2 = document.createElement("script"); document.body.appendChild(s2);
		const mo2 = new MutationObserver((l) => { for (const r of l) recs2.push(r.type + ":" + r.addedNodes.length + "/" + r.removedNodes.length); });
		mo2.observe(document.body, { childList: true, subtree: true, characterData: true });
		s2.appendChild(document.createTextNode("window.__mo2 = 1"));
		await new Promise((r) => setTimeout(r, 50));
		mo2.disconnect();
		assertConsistent("mo-records-appendChild", recs2.join(",") + " ran=" + window.__mo2);
		const el = document.createElement("div"); el.setAttribute("a", "1");
		assertConsistent("attrs-values", [("values" in el.attributes), typeof el.attributes.values, el.attributes[Symbol.iterator] === Array.prototype.values].join(","));
		let msg = ""; try { localStorage.setItem("k"); } catch (e) { msg = e.message; }
		assertConsistent("setItem-1arg", msg);
	`,
	});
	tests.push(mo);
}
export default tests;
