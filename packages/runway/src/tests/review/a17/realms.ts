import { serverTest } from "../../../testcommon.ts";

// Values from other realms / subclasses / exotic objects flowing into the
// IDL conversion layer. Every key is compared against bare Chrome with
// assertConsistent (run WITHOUT RUNWAY_FAST).

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
				"access-control-allow-origin": "*",
			});
			res.end(
				JSON.stringify({
					method: req.method,
					path: req.url,
					ct: (req.headers["content-type"] || "").split(";")[0],
					xa: req.headers["x-a"] || null,
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
		try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 80); }
		if (v === undefined) v = "undefined";
		R[k] = v;
		assertConsistent(k, v);
	};
	const ABS = location.origin + "/echo";
	const holder = document.createElement("div");
	document.body.appendChild(holder);
	const html = (fn) => { holder.replaceChildren(); holder.appendChild(document.createElement("span")); fn(holder.firstChild); return holder.innerHTML; };
`;

function realmOps(prefix: string, W: string) {
	// W is an expression evaluating to the foreign window
	return `
	{
		const W = ${W};
		const D = W.document;
		await K("${prefix}.append", () => html(s => holder.append(D.createElement("b"))));
		await K("${prefix}.prepend", () => html(s => holder.prepend(D.createElement("b"))));
		await K("${prefix}.after", () => html(s => s.after(D.createElement("b"))));
		await K("${prefix}.before", () => html(s => s.before(D.createElement("b"))));
		await K("${prefix}.replaceWith", () => html(s => s.replaceWith(D.createElement("b"))));
		await K("${prefix}.replaceChildren", () => html(s => holder.replaceChildren(D.createElement("b"))));
		await K("${prefix}.appendChild", () => html(s => holder.appendChild(D.createElement("b"))));
		await K("${prefix}.insertBefore", () => html(s => holder.insertBefore(D.createElement("b"), s)));
		await K("${prefix}.replaceChild", () => html(s => holder.replaceChild(D.createElement("b"), s)));
		await K("${prefix}.insertAdjacentElement", () => html(s => s.insertAdjacentElement("afterend", D.createElement("b"))));
		await K("${prefix}.appendText", () => html(s => holder.append(D.createTextNode("t"))));
		await K("${prefix}.appendFrag", () => html(s => { const f = D.createDocumentFragment(); f.append("x"); f.appendChild(D.createElement("i")); holder.append(f); }));
		await K("${prefix}.imgsrc", () => { const i = D.createElement("img"); i.setAttribute("src", "/a.png"); holder.textContent = ""; holder.appendChild(i); return holder.firstChild.getAttribute("src"); });
		await K("${prefix}.setAttributeNode", () => { const a = D.createAttribute("title"); a.value = "t"; const e = document.createElement("p"); e.setAttributeNode(a); return e.outerHTML; });
		await K("${prefix}.setAttributeNodeHref", () => { const a = D.createAttribute("href"); a.value = "/x"; const e = document.createElement("a"); e.setAttributeNode(a); return [e.getAttribute("href"), e.href.replace(location.origin, "O")].join(","); });
		await K("${prefix}.importNode", () => document.importNode(D.createElement("b"), true).ownerDocument === document);
		await K("${prefix}.adoptNode", () => document.adoptNode(D.createElement("b")).ownerDocument === document);
		await K("${prefix}.range", () => { const b = D.createElement("b"); b.textContent = "hey"; holder.textContent = ""; holder.appendChild(b); const r = document.createRange(); r.selectNodeContents(b); return r.toString(); });
		await K("${prefix}.rangeInsert", () => html(s => { const r = document.createRange(); r.selectNode(s); r.insertNode(D.createElement("b")); }));
		await K("${prefix}.selection", () => { const b = D.createElement("b"); b.textContent = "sel"; holder.textContent = ""; holder.appendChild(b); getSelection().selectAllChildren(b); return getSelection().toString(); });
		await K("${prefix}.mo", async () => { const b = D.createElement("b"); holder.textContent = ""; holder.appendChild(b); const recs = []; const mo = new MutationObserver(r => recs.push(...r)); mo.observe(b, { attributes: true }); b.setAttribute("x", "1"); await new Promise(r => setTimeout(r, 10)); mo.disconnect(); return recs.length; });
		await K("${prefix}.fetchReq", async () => (await (await fetch(new W.Request(ABS + "?r=1"))).json()).path);
		await K("${prefix}.fetchReqPost", async () => JSON.stringify(await (await fetch(new W.Request(ABS, { method: "POST", body: "hi" }))).json()));
		await K("${prefix}.newRequestReq", () => new Request(new W.Request(ABS + "?q")).url);
		await K("${prefix}.fetchURLobj", async () => (await (await fetch(new W.URL(ABS + "?u"))).json()).path);
		await K("${prefix}.bodyBlob", async () => await new Response(new W.Blob(["hi"])).text());
		await K("${prefix}.bodyFile", async () => await new Response(new W.File(["hi"], "f.txt")).text());
		await K("${prefix}.bodyU8", async () => await new Response(new W.Uint8Array([104, 105])).text());
		await K("${prefix}.bodyAB", async () => await new Response(new W.Uint8Array([104, 105]).buffer).text());
		await K("${prefix}.bodyDV", async () => await new Response(new W.DataView(new W.Uint8Array([104, 105]).buffer)).text());
		await K("${prefix}.bodyUSP", async () => { const r = new Response(new W.URLSearchParams("a=1")); return [await r.text(), r.headers.get("content-type")].join("|"); });
		await K("${prefix}.bodyFD", async () => { const fd = new W.FormData(); fd.append("a", "1"); const r = new Response(fd); return [(await r.text()).includes('name="a"'), r.headers.get("content-type").split(";")[0]].join("|"); });
		await K("${prefix}.bodyRS", async () => await new Response(new W.ReadableStream({ start(c) { c.enqueue(new W.Uint8Array([104])); c.close(); } })).text());
		await K("${prefix}.reqBodyBlob", async () => await new Request(ABS, { method: "POST", body: new W.Blob(["hi"]) }).text());
		await K("${prefix}.fetchBodyBlob", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: new W.Blob(["hi"], { type: "text/x" }) })).json()));
		await K("${prefix}.fetchBodyFD", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: (() => { const f = new W.FormData(); f.append("a", "1"); return f; })() })).json()));
		await K("${prefix}.fetchBodyUSP", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: new W.URLSearchParams("a=1") })).json()));
		await K("${prefix}.fetchHeaders", async () => (await (await fetch(ABS, { headers: new W.Headers({ "x-a": "1" }) })).json()).xa);
		await K("${prefix}.headersInit", () => new Headers(new W.Headers({ "x-a": "1" })).get("x-a"));
		await K("${prefix}.reqHeaders", () => new Request(ABS, { headers: new W.Headers({ "x-a": "1" }) }).headers.get("x-a"));
		await K("${prefix}.respHeaders", () => new Response("x", { headers: new W.Headers({ "x-a": "1" }) }).headers.get("x-a"));
		await K("${prefix}.fetchSignal", async () => { const ac = new W.AbortController(); ac.abort(); try { await fetch(ABS, { signal: ac.signal }); return "resolved"; } catch (e) { return e.name; } });
		await K("${prefix}.abortAny", () => { const ac = new W.AbortController(); const s = AbortSignal.any([ac.signal]); ac.abort(); return s.aborted; });
		await K("${prefix}.aelSignal", () => { const ac = new W.AbortController(); let n = 0; const t = new EventTarget(); t.addEventListener("x", () => n++, { signal: ac.signal }); ac.abort(); t.dispatchEvent(new Event("x")); return n; });
		await K("${prefix}.dispatchForeignEvent", () => { let n = 0; const t = document.createElement("i"); t.addEventListener("x", () => n++); t.dispatchEvent(new W.Event("x")); return n; });
		await K("${prefix}.dispatchForeignCustomEvent", () => { let d; const t = document.createElement("i"); t.addEventListener("x", (e) => d = e.detail); t.dispatchEvent(new W.CustomEvent("x", { detail: 5 })); return d; });
		await K("${prefix}.urlBase", () => new URL("x", new W.URL("http://a.test/b/")).href);
		await K("${prefix}.usp", () => new URLSearchParams(new W.URLSearchParams("a=1&b=2")).toString());
		await K("${prefix}.pmPort", () => new Promise(res => { const mc = new W.MessageChannel(); addEventListener("message", function h(e) { if (e.data !== "pmPort") return; removeEventListener("message", h); res(e.ports.length); }); postMessage("pmPort", "*", [mc.port1]); setTimeout(() => res("timeout"), 1000); }));
		await K("${prefix}.pmAB", () => new Promise(res => { const ab = new W.ArrayBuffer(8); addEventListener("message", function h(e) { if (e.data?.k !== "pmAB") return; removeEventListener("message", h); res([e.data.ab.byteLength, ab.byteLength].join(",")); }); postMessage({ k: "pmAB", ab }, "*", [ab]); setTimeout(() => res("timeout"), 1000); }));
		await K("${prefix}.pmOpts", () => new Promise(res => { const ab = new W.ArrayBuffer(8); addEventListener("message", function h(e) { if (e.data?.k !== "pmOpts") return; removeEventListener("message", h); res(ab.byteLength); }); postMessage({ k: "pmOpts", ab }, { targetOrigin: "*", transfer: [ab] }); setTimeout(() => res("timeout"), 1000); }));
		await K("${prefix}.structuredClone", () => { const ab = new W.ArrayBuffer(4); const c = structuredClone(ab, { transfer: [ab] }); return [c.byteLength, ab.byteLength].join(","); });
		await K("${prefix}.adoptedSheets", () => { const s = new W.CSSStyleSheet(); try { document.adoptedStyleSheets = [s]; return document.adoptedStyleSheets.length; } finally { try { document.adoptedStyleSheets = []; } catch {} } });
		await K("${prefix}.objectURL", async () => { const u = URL.createObjectURL(new W.Blob(["ob"])); return await (await fetch(u)).text(); });
		await K("${prefix}.cachePut", async () => { const c = await caches.open("rv17"); await c.put(new W.Request(ABS + "?c"), new W.Response("cached")); const m = await c.match(ABS + "?c"); await caches.delete("rv17"); return m ? await m.text() : "nomatch"; });
		await K("${prefix}.cacheMatchReq", async () => { const c = await caches.open("rv17b"); await c.put(ABS + "?d", new Response("d")); const m = await c.match(new W.Request(ABS + "?d")); await caches.delete("rv17b"); return m ? await m.text() : "nomatch"; });
		await K("${prefix}.xhrSendBlob", () => new Promise(res => { const x = new XMLHttpRequest(); x.open("POST", ABS); x.onload = () => res(x.responseText); x.onerror = () => res("err"); x.send(new W.Blob(["xb"])); }));
		await K("${prefix}.xhrSendFD", () => new Promise(res => { const x = new XMLHttpRequest(); x.open("POST", ABS); x.onload = () => res(x.responseText); x.onerror = () => res("err"); const f = new W.FormData(); f.append("a", "1"); x.send(f); }));
		await K("${prefix}.xhrSendDoc", () => new Promise(res => { const x = new XMLHttpRequest(); x.open("POST", ABS); x.onload = () => res(JSON.parse(x.responseText).ct); x.onerror = () => res("err"); x.send(D.implementation.createHTMLDocument("t")); }));
		await K("${prefix}.beacon", () => navigator.sendBeacon(ABS, new W.Blob(["b"])));
		await K("${prefix}.treeWalker", () => { const b = D.createElement("b"); b.append(D.createElement("i")); const tw = document.createTreeWalker(b); return tw.nextNode() && tw.currentNode.nodeName; });
		await K("${prefix}.contains", () => { const b = D.createElement("b"); holder.textContent = ""; holder.appendChild(b); return holder.contains(b); });
		await K("${prefix}.compare", () => { const b = D.createElement("b"); return holder.compareDocumentPosition(b); });
		await K("${prefix}.isEqualNode", () => document.createElement("b").isEqualNode(D.createElement("b")));
		await K("${prefix}.getComputedStyle", () => { const b = D.createElement("b"); holder.textContent = ""; holder.appendChild(b); return getComputedStyle(b).display; });
		await K("${prefix}.setHTMLUnsafe", () => html(s => s.setHTMLUnsafe("<i>x</i>")));
		await K("${prefix}.innerHTMLobj", () => html(s => { s.innerHTML = { toString() { return "<u>o</u>"; } }; }));
		await K("${prefix}.intersection", () => { const io = new IntersectionObserver(() => {}); const b = D.createElement("b"); holder.textContent = ""; holder.appendChild(b); io.observe(b); io.disconnect(); return "ok"; });
		await K("${prefix}.resizeObs", () => { const io = new ResizeObserver(() => {}); io.observe(D.createElement("b")); io.disconnect(); return "ok"; });
		await K("${prefix}.fileReader", () => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res("err"); fr.readAsText(new W.Blob(["fr"])); }));
		await K("${prefix}.createImageBitmap", async () => { const c = D.createElement("canvas"); c.width = 2; c.height = 2; const b = await createImageBitmap(c); return b.width; });
		await K("${prefix}.drawImage", () => { const c = document.createElement("canvas"); const i = D.createElement("canvas"); c.getContext("2d").drawImage(i, 0, 0); return "ok"; });
		await K("${prefix}.textEncoderInto", () => new TextEncoder().encodeInto("hi", new W.Uint8Array(4)).written);
		await K("${prefix}.cryptoRandom", () => crypto.getRandomValues(new W.Uint8Array(4)).length);
		await K("${prefix}.jsonStringify", () => JSON.stringify(new W.Array(1, 2)));
		await K("${prefix}.arrayIsArray", () => Array.isArray(new W.Array()));
		await K("${prefix}.historyState", () => { history.replaceState(new W.Object({ a: 1 }), ""); return JSON.stringify(history.state); });
		await K("${prefix}.localStorageObj", () => { localStorage.setItem("rv17", new W.Object()); const v = localStorage.getItem("rv17"); localStorage.removeItem("rv17"); return v; });
		await K("${prefix}.setTimeoutFn", () => new Promise(res => { setTimeout(new W.Function("this.__rv17 = 1"), 0); setTimeout(() => res(String(W.__rv17 ?? window.__rv17)), 20); }));
		await K("${prefix}.addEventListenerForeignFn", () => { let n = 0; const t = document.createElement("i"); const fn = new W.Function("n", "this.__rv17n = (this.__rv17n||0)+1"); t.addEventListener("x", fn); t.dispatchEvent(new Event("x")); return String(W.__rv17n ?? window.__rv17n); });
		await K("${prefix}.addEventListenerHandleEvent", () => { let n = 0; const t = document.createElement("i"); const o = new W.Object(); o.handleEvent = () => n++; t.addEventListener("x", o); t.dispatchEvent(new Event("x")); return n; });
		await K("${prefix}.workerURL", async () => { const u = URL.createObjectURL(new W.Blob(["postMessage(1)"], { type: "text/javascript" })); const w = new Worker(u); return await new Promise(r => { w.onmessage = e => r(e.data); w.onerror = () => r("err"); setTimeout(() => r("timeout"), 2000); }).finally(() => w.terminate()); });
		await K("${prefix}.workerTransfer", async () => { const w = new Worker(URL.createObjectURL(new Blob(["onmessage=e=>postMessage(e.data.byteLength + ',' + (e.ports||[]).length)"], { type: "text/javascript" }))); const ab = new W.ArrayBuffer(8); const mc = new W.MessageChannel(); w.postMessage(ab, [ab, mc.port1]); return await new Promise(r => { w.onmessage = e => r(e.data + "|" + ab.byteLength); setTimeout(() => r("timeout"), 2000); }).finally(() => w.terminate()); });
		await K("${prefix}.workerOptions", async () => { const w = new Worker(URL.createObjectURL(new Blob(["postMessage(self.name)"], { type: "text/javascript" })), new W.Object({ name: "nm" })); return await new Promise(r => { w.onmessage = e => r(e.data); setTimeout(() => r("timeout"), 2000); }).finally(() => w.terminate()); });
		await K("${prefix}.portPost", () => new Promise(res => { const mc = new MessageChannel(); const ab = new W.ArrayBuffer(8); mc.port2.onmessage = e => res(e.data.byteLength + "," + ab.byteLength); mc.port1.postMessage(ab, [ab]); setTimeout(() => res("timeout"), 1000); }));
		await K("${prefix}.bcPost", () => { const bc = new BroadcastChannel("rv17"); try { bc.postMessage(new W.Blob(["x"])); return "ok"; } finally { bc.close(); } });
		await K("${prefix}.fontFace", () => { const f = new FontFace("x", new W.Uint8Array(4).buffer); return f.family; });
		await K("${prefix}.imageData", () => new ImageData(new W.Uint8ClampedArray(4), 1).width);
		await K("${prefix}.textDecoder", () => new TextDecoder().decode(new W.Uint8Array([104, 105])));
		await K("${prefix}.blobParts", async () => await new Blob([new W.Blob(["a"]), new W.Uint8Array([98])]).text());
		await K("${prefix}.fileParts", async () => await new File([new W.Blob(["a"])], "n").text());
		await K("${prefix}.fdAppendBlob", async () => { const fd = new FormData(); fd.append("f", new W.Blob(["zz"]), "z.txt"); return [fd.get("f").name, await fd.get("f").text()].join(","); });
		await K("${prefix}.fdFromForm", () => { const f = D.createElement("form"); const i = D.createElement("input"); i.name = "a"; i.value = "1"; f.append(i); return [...new FormData(f)].join(";"); });
		await K("${prefix}.uspRecord", () => new URLSearchParams(new W.Object({ a: "1" })).toString());
		await K("${prefix}.headersSeq", () => new Headers(new W.Array(new W.Array("x-a", "1"))).get("x-a"));
		await K("${prefix}.headersRecord", () => new Headers(new W.Object({ "x-a": "1" })).get("x-a"));
		await K("${prefix}.reqInitObj", async () => (await (await fetch(ABS, new W.Object({ method: "POST", body: "q", headers: new W.Object({ "x-a": "2" }) }))).json()).xa);
		await K("${prefix}.cookieStoreObj", async () => { if (!self.cookieStore) return "none"; await cookieStore.set(new W.Object({ name: "rv17", value: "v" })); const c = await cookieStore.get(new W.Object({ name: "rv17" })); await cookieStore.delete("rv17"); return c && c.value; });
		await K("${prefix}.matchMedia", () => typeof matchMedia(new W.String("screen")).matches);
		await K("${prefix}.elFromPoint", () => typeof document.elementFromPoint(new W.Number(1), 1));
		await K("${prefix}.animate", () => { const b = D.createElement("b"); holder.textContent = ""; holder.appendChild(b); const a = b.animate(new W.Array(new W.Object({ opacity: 0 })), 10); return typeof a.play; });
		await K("${prefix}.shadowAdopt", () => { const e = document.createElement("div"); const sr = e.attachShadow({ mode: "open" }); try { sr.adoptedStyleSheets = [new W.CSSStyleSheet()]; return sr.adoptedStyleSheets.length; } catch (x) { return x.name; } });
		await K("${prefix}.styleSheetFromFrame", () => { const st = D.createElement("style"); st.textContent = "b{color:red}"; holder.textContent = ""; holder.appendChild(st); return holder.firstChild.sheet && holder.firstChild.sheet.cssRules.length; });
		await K("${prefix}.scriptFromFrame", () => { window.__rv17s = 0; const s = D.createElement("script"); s.textContent = "window.__rv17s = (window.__rv17s||0)+1; window.__rv17loc = typeof location.href"; holder.textContent = ""; holder.appendChild(s); return window.__rv17s; });
		await K("${prefix}.scriptFromFrameLoc", () => { const s = D.createElement("script"); s.textContent = "window.__rv17h = location.host"; holder.textContent = ""; holder.appendChild(s); return window.__rv17h === new URL(location.href).host; });
		await K("${prefix}.iframeFromFrame", async () => { const f = D.createElement("iframe"); f.src = "/echo?if"; holder.textContent = ""; holder.appendChild(f); await new Promise(r => { f.onload = r; setTimeout(r, 2000); }); try { return f.contentDocument.body.textContent.includes("GET"); } catch (e) { return e.name; } });
		await K("${prefix}.anchorHref", () => { const a = D.createElement("a"); a.href = "/zz"; holder.textContent = ""; holder.appendChild(a); return holder.firstChild.href.replace(location.origin, "O"); });
	}
	`;
}

export default [
	serverTest({
		name: "rv17-realms-hooked",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			f.contentWindow; // hooks
			${realmOps("hooked", "f.contentWindow")}
		`,
	}),
	serverTest({
		name: "rv17-realms-unhooked",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			${realmOps("unhooked", "window[window.length-1]")}
		`,
	}),
	serverTest({
		name: "rv17-realms-popup",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			const p = open("");
			assert(p, "popup blocked");
			try {
				${realmOps("popup", "p")}
			} finally { p.close(); }
		`,
	}),
	serverTest({
		name: "rv17-realms-self",
		autoPass: true,
		start: async (server) => echoServer(server),
		js: `${PRELUDE}
			${realmOps("self", "window")}
		`,
	}),
];
