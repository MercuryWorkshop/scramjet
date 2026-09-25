import { serverTest } from "../../../testcommon.ts";

// Values crossing realms through messaging: real child frames (own client),
// about:blank children, unhooked children, workers, shared workers, worklets,
// MessageChannel ports moving between realms. Compared with bare Chrome.

const CHILD = `<!doctype html><body><script>
addEventListener("message", (e) => {
	const d = e.data;
	if (d && d.cmd === "echo") {
		e.source.postMessage({ cmd: "echoed", got: d.v, origin: e.origin, srcIsParent: e.source === parent, ports: e.ports.length }, "*");
	}
	if (d && d.cmd === "port") {
		const p = e.ports[0];
		p.onmessage = (m) => p.postMessage({ back: m.data, t: typeof m.data, keys: m.data && typeof m.data === "object" ? Object.keys(m.data).join() : "" });
	}
	if (d && d.cmd === "blob") {
		d.b.text().then((t) => parent.postMessage({ cmd: "blobback", t, isBlob: d.b instanceof Blob, back: new Blob([t + "!"]) }, "*"));
	}
	if (d && d.cmd === "nodes") {
		const el = document.createElement("b");
		el.textContent = "from child";
		parent.document.getElementById("holder").append(el, "txt");
		parent.document.getElementById("holder").after(document.createElement("i"));
		const r = new Request("/echo?child");
		parent.postMessage({ cmd: "nodesdone" }, "*");
		parent.__childReq = r;
		parent.__childBlob = new Blob(["cb"]);
		parent.__childFD = (() => { const f = new FormData(); f.append("a", "1"); return f; })();
		parent.__childHeaders = new Headers({ "x-a": "c" });
		parent.__childAC = new AbortController();
		parent.__childU8 = new Uint8Array([104, 105]);
		parent.__childUSP = new URLSearchParams("q=1");
		parent.__childRS = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([99])); c.close(); } });
		parent.__childSheet = new CSSStyleSheet();
		parent.__childURL = new URL("/echo?curl", document.baseURI);
		parent.__childEl = document.createElement("a");
		parent.__childEl.href = "/childlink";
	}
});
parent.postMessage({ cmd: "ready" }, "*");
</script></body>`;

function server(serverObj: any) {
	serverObj.on("request", (req: any, res: any) => {
		if (req.url === "/" || req.url === "/script.js") return;
		if (req.url.startsWith("/child")) {
			res.writeHead(200, {
				"content-type": "text/html",
			});
			res.end(CHILD);
			return;
		}
		if (req.url.startsWith("/proc.js")) {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(
				`registerProcessor("rvp", class extends AudioWorkletProcessor { constructor() { super(); this.port.onmessage = (e) => this.port.postMessage({ back: e.data, keys: e.data && typeof e.data === "object" ? Object.keys(e.data).join() : "" }); } process() { return true; } });`
			);
			return;
		}
		if (req.url.startsWith("/sw.js")) {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(
				`onconnect = (e) => { const p = e.ports[0]; p.onmessage = (m) => p.postMessage({ back: m.data, keys: m.data && typeof m.data === "object" ? Object.keys(m.data).join() : "" }); };`
			);
			return;
		}
		if (req.url.startsWith("/w.js")) {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(
				`onmessage = (e) => { if (e.ports.length) { const p = e.ports[0]; p.onmessage = (m) => p.postMessage({ back: m.data, keys: m.data && typeof m.data === "object" ? Object.keys(m.data).join() : "" }); p.postMessage("hi-from-worker"); return; } postMessage({ back: e.data, keys: e.data && typeof e.data === "object" ? Object.keys(e.data).join() : "" }); };`
			);
			return;
		}
		const chunks: Buffer[] = [];
		req.on("data", (c: Buffer) => chunks.push(c));
		req.on("end", () => {
			res.writeHead(200, {
				"content-type": "application/json",
			});
			res.end(
				JSON.stringify({
					method: req.method,
					path: req.url,
					xa: req.headers["x-a"] || null,
					ct: (req.headers["content-type"] || "").split(";")[0],
					body: Buffer.concat(chunks)
						.toString()
						.replace(/-{2,}[-\w]+/g, "B")
						.slice(0, 100),
				})
			);
		});
	});
}

const PRELUDE = `
	const CHILDSRC = ${JSON.stringify(CHILD)};
	const K = async (k, f) => {
		let v;
		try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
		if (v === undefined) v = "undefined";
		assertConsistent(k, v);
	};
	const ABS = location.origin + "/echo";
	const holder = document.createElement("div");
	holder.id = "holder";
	document.body.appendChild(holder);
	const wait = (pred, ms = 3000) => new Promise((res) => { const h = (e) => { if (pred(e)) { removeEventListener("message", h); res(e); } }; addEventListener("message", h); setTimeout(() => { removeEventListener("message", h); res(null); }, ms); });
	const oneMsg = (port, ms = 3000) => new Promise((res) => { port.onmessage = (e) => res(e.data); setTimeout(() => res("timeout"), ms); });
`;

export default [
	serverTest({
		name: "rv17-msg-childframe",
		autoPass: true,
		start: async (s) => server(s),
		js: `${PRELUDE}
			const f = document.createElement("iframe");
			const ready = wait((e) => e.data && e.data.cmd === "ready");
			f.src = "/child";
			document.body.appendChild(f);
			const r = await ready;
			await K("ready", () => !!r && [r.source === f.contentWindow, r.origin === location.origin].join());
			await K("echo", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); f.contentWindow.postMessage({ cmd: "echo", v: { a: [1, 2] } }, "*"); const e = await p; return e && JSON.stringify(e.data).replace(location.origin, "O"); });
			await K("echoTarget", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed", 800); f.contentWindow.postMessage({ cmd: "echo", v: 1 }, location.origin); const e = await p; return !!e; });
			await K("echoPortTransfer", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "echo", v: 2 }, "*", [mc.port1]); const e = await p; return e && e.data.ports; });
			await K("portRoundtrip", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage({ z: 1 }); return JSON.stringify(await got); });
			await K("portRoundtripStr", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage("s"); return JSON.stringify(await got); });
			await K("blob", async () => { const p = wait((e) => e.data && e.data.cmd === "blobback"); f.contentWindow.postMessage({ cmd: "blob", b: new Blob(["pb"]) }, "*"); const e = await p; return e && [e.data.t, e.data.isBlob, e.data.back instanceof Blob, await e.data.back.text()].join(); });
			// child builds objects in its own (hooked, own-client) realm and hands them over
			const nd = wait((e) => e.data && e.data.cmd === "nodesdone");
			f.contentWindow.postMessage({ cmd: "nodes" }, "*");
			await nd;
			await K("childNodes", () => holder.outerHTML + (holder.nextSibling && holder.nextSibling.nodeName));
			await K("childReqFetch", async () => (await (await fetch(__childReq)).json()).path);
			await K("childReqUrl", () => __childReq.url.replace(location.origin, "O"));
			await K("childNewReq", () => new Request(__childReq).url.replace(location.origin, "O"));
			await K("childBlobBody", async () => await new Response(__childBlob).text());
			await K("childFDBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childFD })).json()));
			await K("childUSPBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childUSP })).json()));
			await K("childRSBody", async () => await new Response(__childRS).text());
			await K("childU8Body", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childU8 })).json()));
			await K("childHeaders", async () => (await (await fetch(ABS, { headers: __childHeaders })).json()).xa);
			await K("childHeadersInit", () => new Headers(__childHeaders).get("x-a"));
			await K("childSignal", async () => { __childAC.abort(); try { await fetch(ABS, { signal: __childAC.signal }); return "resolved"; } catch (e) { return e.name; } });
			await K("childAbortAny", () => AbortSignal.any([__childAC.signal]).aborted);
			await K("childURLfetch", async () => (await (await fetch(__childURL)).json()).path);
			await K("childURLhref", () => __childURL.href.replace(location.origin, "O"));
			await K("childSheetAdopt", () => { try { document.adoptedStyleSheets = [__childSheet]; return "ok"; } catch (e) { return e.name; } });
			await K("childElHref", () => { holder.textContent = ""; holder.append(__childEl); return [__childEl.href.replace(location.origin, "O"), __childEl.getAttribute("href"), holder.innerHTML.replace(location.origin, "O")].join("|"); });
			await K("childCache", async () => { const c = await caches.open("rv17m"); await c.put(__childReq, new Response("x")); const m = await c.match(ABS + "?child"); await caches.delete("rv17m"); return !!m; });
		`,
	}),
	serverTest({
		name: "rv17-msg-sandboxso",
		autoPass: true,
		start: async (s) => server(s),
		js: `${PRELUDE}
			const f = document.createElement("iframe");
			const ready = wait((e) => e.data && e.data.cmd === "ready");
			f.setAttribute("sandbox", "allow-scripts allow-same-origin"); f.src = "/child";
			document.body.appendChild(f);
			const r = await ready;
			await K("ready", () => !!r && [r.source === f.contentWindow, r.origin === location.origin].join());
			await K("echo", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); f.contentWindow.postMessage({ cmd: "echo", v: { a: [1, 2] } }, "*"); const e = await p; return e && JSON.stringify(e.data).replace(location.origin, "O"); });
			await K("echoTarget", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed", 800); f.contentWindow.postMessage({ cmd: "echo", v: 1 }, location.origin); const e = await p; return !!e; });
			await K("echoPortTransfer", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "echo", v: 2 }, "*", [mc.port1]); const e = await p; return e && e.data.ports; });
			await K("portRoundtrip", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage({ z: 1 }); return JSON.stringify(await got); });
			await K("portRoundtripStr", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage("s"); return JSON.stringify(await got); });
			await K("blob", async () => { const p = wait((e) => e.data && e.data.cmd === "blobback"); f.contentWindow.postMessage({ cmd: "blob", b: new Blob(["pb"]) }, "*"); const e = await p; return e && [e.data.t, e.data.isBlob, e.data.back instanceof Blob, await e.data.back.text()].join(); });
			// child builds objects in its own (hooked, own-client) realm and hands them over
			const nd = wait((e) => e.data && e.data.cmd === "nodesdone");
			f.contentWindow.postMessage({ cmd: "nodes" }, "*");
			await nd;
			await K("childNodes", () => holder.outerHTML + (holder.nextSibling && holder.nextSibling.nodeName));
			await K("childReqFetch", async () => (await (await fetch(__childReq)).json()).path);
			await K("childReqUrl", () => __childReq.url.replace(location.origin, "O"));
			await K("childNewReq", () => new Request(__childReq).url.replace(location.origin, "O"));
			await K("childBlobBody", async () => await new Response(__childBlob).text());
			await K("childFDBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childFD })).json()));
			await K("childUSPBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childUSP })).json()));
			await K("childRSBody", async () => await new Response(__childRS).text());
			await K("childU8Body", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childU8 })).json()));
			await K("childHeaders", async () => (await (await fetch(ABS, { headers: __childHeaders })).json()).xa);
			await K("childHeadersInit", () => new Headers(__childHeaders).get("x-a"));
			await K("childSignal", async () => { __childAC.abort(); try { await fetch(ABS, { signal: __childAC.signal }); return "resolved"; } catch (e) { return e.name; } });
			await K("childAbortAny", () => AbortSignal.any([__childAC.signal]).aborted);
			await K("childURLfetch", async () => (await (await fetch(__childURL)).json()).path);
			await K("childURLhref", () => __childURL.href.replace(location.origin, "O"));
			await K("childSheetAdopt", () => { try { document.adoptedStyleSheets = [__childSheet]; return "ok"; } catch (e) { return e.name; } });
			await K("childElHref", () => { holder.textContent = ""; holder.append(__childEl); return [__childEl.href.replace(location.origin, "O"), __childEl.getAttribute("href"), holder.innerHTML.replace(location.origin, "O")].join("|"); });
			await K("childCache", async () => { const c = await caches.open("rv17m"); await c.put(__childReq, new Response("x")); const m = await c.match(ABS + "?child"); await caches.delete("rv17m"); return !!m; });
		`,
	}),
	serverTest({
		name: "rv17-msg-srcdoc",
		autoPass: true,
		start: async (s) => server(s),
		js: `${PRELUDE}
			const f = document.createElement("iframe");
			const ready = wait((e) => e.data && e.data.cmd === "ready");
			f.srcdoc = CHILDSRC;
			document.body.appendChild(f);
			const r = await ready;
			await K("ready", () => !!r && [r.source === f.contentWindow, r.origin === location.origin].join());
			await K("echo", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); f.contentWindow.postMessage({ cmd: "echo", v: { a: [1, 2] } }, "*"); const e = await p; return e && JSON.stringify(e.data).replace(location.origin, "O"); });
			await K("echoTarget", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed", 800); f.contentWindow.postMessage({ cmd: "echo", v: 1 }, location.origin); const e = await p; return !!e; });
			await K("echoPortTransfer", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "echo", v: 2 }, "*", [mc.port1]); const e = await p; return e && e.data.ports; });
			await K("portRoundtrip", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage({ z: 1 }); return JSON.stringify(await got); });
			await K("portRoundtripStr", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage("s"); return JSON.stringify(await got); });
			await K("blob", async () => { const p = wait((e) => e.data && e.data.cmd === "blobback"); f.contentWindow.postMessage({ cmd: "blob", b: new Blob(["pb"]) }, "*"); const e = await p; return e && [e.data.t, e.data.isBlob, e.data.back instanceof Blob, await e.data.back.text()].join(); });
			// child builds objects in its own (hooked, own-client) realm and hands them over
			const nd = wait((e) => e.data && e.data.cmd === "nodesdone");
			f.contentWindow.postMessage({ cmd: "nodes" }, "*");
			await nd;
			await K("childNodes", () => holder.outerHTML + (holder.nextSibling && holder.nextSibling.nodeName));
			await K("childReqFetch", async () => (await (await fetch(__childReq)).json()).path);
			await K("childReqUrl", () => __childReq.url.replace(location.origin, "O"));
			await K("childNewReq", () => new Request(__childReq).url.replace(location.origin, "O"));
			await K("childBlobBody", async () => await new Response(__childBlob).text());
			await K("childFDBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childFD })).json()));
			await K("childUSPBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childUSP })).json()));
			await K("childRSBody", async () => await new Response(__childRS).text());
			await K("childU8Body", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childU8 })).json()));
			await K("childHeaders", async () => (await (await fetch(ABS, { headers: __childHeaders })).json()).xa);
			await K("childHeadersInit", () => new Headers(__childHeaders).get("x-a"));
			await K("childSignal", async () => { __childAC.abort(); try { await fetch(ABS, { signal: __childAC.signal }); return "resolved"; } catch (e) { return e.name; } });
			await K("childAbortAny", () => AbortSignal.any([__childAC.signal]).aborted);
			await K("childURLfetch", async () => (await (await fetch(__childURL)).json()).path);
			await K("childURLhref", () => __childURL.href.replace(location.origin, "O"));
			await K("childSheetAdopt", () => { try { document.adoptedStyleSheets = [__childSheet]; return "ok"; } catch (e) { return e.name; } });
			await K("childElHref", () => { holder.textContent = ""; holder.append(__childEl); return [__childEl.href.replace(location.origin, "O"), __childEl.getAttribute("href"), holder.innerHTML.replace(location.origin, "O")].join("|"); });
			await K("childCache", async () => { const c = await caches.open("rv17m"); await c.put(__childReq, new Response("x")); const m = await c.match(ABS + "?child"); await caches.delete("rv17m"); return !!m; });
		`,
	}),
	serverTest({
		name: "rv17-msg-sandboxsrcdoc",
		autoPass: true,
		start: async (s) => server(s),
		js: `${PRELUDE}
			const f = document.createElement("iframe");
			const ready = wait((e) => e.data && e.data.cmd === "ready");
			f.setAttribute("sandbox", "allow-scripts allow-same-origin"); f.srcdoc = CHILDSRC;
			document.body.appendChild(f);
			const r = await ready;
			await K("ready", () => !!r && [r.source === f.contentWindow, r.origin === location.origin].join());
			await K("echo", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); f.contentWindow.postMessage({ cmd: "echo", v: { a: [1, 2] } }, "*"); const e = await p; return e && JSON.stringify(e.data).replace(location.origin, "O"); });
			await K("echoTarget", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed", 800); f.contentWindow.postMessage({ cmd: "echo", v: 1 }, location.origin); const e = await p; return !!e; });
			await K("echoPortTransfer", async () => { const p = wait((e) => e.data && e.data.cmd === "echoed"); const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "echo", v: 2 }, "*", [mc.port1]); const e = await p; return e && e.data.ports; });
			await K("portRoundtrip", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage({ z: 1 }); return JSON.stringify(await got); });
			await K("portRoundtripStr", async () => { const mc = new MessageChannel(); f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]); const got = oneMsg(mc.port1); mc.port1.postMessage("s"); return JSON.stringify(await got); });
			await K("blob", async () => { const p = wait((e) => e.data && e.data.cmd === "blobback"); f.contentWindow.postMessage({ cmd: "blob", b: new Blob(["pb"]) }, "*"); const e = await p; return e && [e.data.t, e.data.isBlob, e.data.back instanceof Blob, await e.data.back.text()].join(); });
			// child builds objects in its own (hooked, own-client) realm and hands them over
			const nd = wait((e) => e.data && e.data.cmd === "nodesdone");
			f.contentWindow.postMessage({ cmd: "nodes" }, "*");
			await nd;
			await K("childNodes", () => holder.outerHTML + (holder.nextSibling && holder.nextSibling.nodeName));
			await K("childReqFetch", async () => (await (await fetch(__childReq)).json()).path);
			await K("childReqUrl", () => __childReq.url.replace(location.origin, "O"));
			await K("childNewReq", () => new Request(__childReq).url.replace(location.origin, "O"));
			await K("childBlobBody", async () => await new Response(__childBlob).text());
			await K("childFDBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childFD })).json()));
			await K("childUSPBody", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childUSP })).json()));
			await K("childRSBody", async () => await new Response(__childRS).text());
			await K("childU8Body", async () => JSON.stringify(await (await fetch(ABS, { method: "POST", body: __childU8 })).json()));
			await K("childHeaders", async () => (await (await fetch(ABS, { headers: __childHeaders })).json()).xa);
			await K("childHeadersInit", () => new Headers(__childHeaders).get("x-a"));
			await K("childSignal", async () => { __childAC.abort(); try { await fetch(ABS, { signal: __childAC.signal }); return "resolved"; } catch (e) { return e.name; } });
			await K("childAbortAny", () => AbortSignal.any([__childAC.signal]).aborted);
			await K("childURLfetch", async () => (await (await fetch(__childURL)).json()).path);
			await K("childURLhref", () => __childURL.href.replace(location.origin, "O"));
			await K("childSheetAdopt", () => { try { document.adoptedStyleSheets = [__childSheet]; return "ok"; } catch (e) { return e.name; } });
			await K("childElHref", () => { holder.textContent = ""; holder.append(__childEl); return [__childEl.href.replace(location.origin, "O"), __childEl.getAttribute("href"), holder.innerHTML.replace(location.origin, "O")].join("|"); });
			await K("childCache", async () => { const c = await caches.open("rv17m"); await c.put(__childReq, new Response("x")); const m = await c.match(ABS + "?child"); await caches.delete("rv17m"); return !!m; });
		`,
	}),
	serverTest({
		name: "rv17-msg-workers",
		autoPass: true,
		start: async (s) => server(s),
		js: `${PRELUDE}
			await K("workerEcho", async () => { const w = new Worker("/w.js"); const got = new Promise(r => { w.onmessage = e => r(e.data); setTimeout(() => r("timeout"), 3000); }); w.postMessage({ a: 1 }); const v = await got; w.terminate(); return JSON.stringify(v); });
			await K("workerPort", async () => { const w = new Worker("/w.js"); const mc = new MessageChannel(); w.postMessage(null, [mc.port2]); const first = await oneMsg(mc.port1); const got = oneMsg(mc.port1); mc.port1.postMessage({ z: 2 }); const v = await got; w.terminate(); return JSON.stringify([first, v]); });
			await K("sharedWorkerPort", async () => { const sw = new SharedWorker("/sw.js"); sw.port.start(); const got = oneMsg(sw.port); sw.port.postMessage({ s: 1 }); return JSON.stringify(await got); });
			await K("audioWorkletPort", async () => { const ac = new OfflineAudioContext(1, 128, 44100); await ac.audioWorklet.addModule("/proc.js"); const n = new AudioWorkletNode(ac, "rvp"); const got = oneMsg(n.port); n.port.postMessage({ w: 1 }); return JSON.stringify(await got); });
			await K("audioWorkletPortStr", async () => { const ac = new OfflineAudioContext(1, 128, 44100); await ac.audioWorklet.addModule("/proc.js"); const n = new AudioWorkletNode(ac, "rvp"); const got = oneMsg(n.port); n.port.postMessage("str"); return JSON.stringify(await got); });
			// port handed from a worker to a child frame: page never touches it
			await K("portWorkerToFrame", async () => {
				const f = document.createElement("iframe");
				const ready = wait((e) => e.data && e.data.cmd === "ready");
				f.src = "/child"; document.body.appendChild(f); await ready;
				const mc = new MessageChannel();
				f.contentWindow.postMessage({ cmd: "port" }, "*", [mc.port2]);
				const w = new Worker(URL.createObjectURL(new Blob(["onmessage = (e) => { const p = e.ports[0]; p.onmessage = (m) => postMessage(m.data); p.postMessage({ fromWorker: 1 }); }"], { type: "text/javascript" })));
				const got = new Promise(r => { w.onmessage = e => r(e.data); setTimeout(() => r("timeout"), 3000); });
				w.postMessage(null, [mc.port1]);
				const v = await got; w.terminate(); return JSON.stringify(v);
			});
			// about:blank child (hooked by parent) and an unhooked one, talking over ports
			await K("portBlankChild", async () => {
				const f = document.createElement("iframe"); document.body.appendChild(f);
				const W = f.contentWindow;
				const mc = new W.MessageChannel();
				mc.port2.onmessage = (e) => mc.port2.postMessage({ back: e.data, t: typeof e.data });
				const got = oneMsg(mc.port1);
				mc.port1.postMessage({ q: 1 });
				return JSON.stringify(await got);
			});
			await K("portUnhookedChild", async () => {
				const f = document.createElement("iframe"); document.body.appendChild(f);
				const W = window[window.length - 1];
				const mc = new MessageChannel();
				W.eval("0");
				const recv = new Promise(r => { W.addEventListener("message", (e) => r(JSON.stringify({ data: e.data, ports: e.ports.length }))); setTimeout(() => r("timeout"), 2000); });
				W.postMessage({ u: 1 }, "*");
				return await recv;
			});
			await K("unhookedChildPortData", async () => {
				const f = document.createElement("iframe"); document.body.appendChild(f);
				const W = window[window.length - 1];
				const mc = new MessageChannel();
				const got = new Promise(r => { mc.port2.addEventListener("message", (e) => r(JSON.stringify(e.data))); mc.port2.start(); setTimeout(() => r("timeout"), 2000); });
				W.MessagePort.prototype.postMessage.call(mc.port1, { raw: 1 });
				return await got;
			});
			await K("bcBetweenFrames", async () => {
				const f = document.createElement("iframe"); document.body.appendChild(f);
				const W = f.contentWindow;
				const a = new BroadcastChannel("rv17bc"); const b = new W.BroadcastChannel("rv17bc");
				const got = new Promise(r => { b.onmessage = e => r(JSON.stringify(e.data)); setTimeout(() => r("timeout"), 2000); });
				a.postMessage({ bc: 1 });
				const v = await got; a.close(); b.close(); return v;
			});
			await K("bcUnhooked", async () => {
				const f = document.createElement("iframe"); document.body.appendChild(f);
				const W = window[window.length - 1];
				const a = new BroadcastChannel("rv17bc2"); const b = new W.BroadcastChannel("rv17bc2");
				const got = new Promise(r => { a.onmessage = e => r(JSON.stringify(e.data)); setTimeout(() => r("timeout"), 2000); });
				b.postMessage({ bu: 1 });
				const v = await got; a.close(); b.close(); return v;
			});
			await K("structuredCloneForeign", async () => {
				const f = document.createElement("iframe"); document.body.appendChild(f);
				const W = f.contentWindow;
				const c = structuredClone(new W.Blob(["sc"]));
				return [c instanceof Blob, await c.text()].join();
			});
		`,
	}),
];
