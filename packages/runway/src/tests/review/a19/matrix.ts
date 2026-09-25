import { serverTest } from "../../../testcommon.ts";
import fs from "node:fs";

// rv19: storage scoping matrix. Each context loads /probe.js, which reports
// what that context sees of the top frame's storage. Results are dumped to
// scratch-a19 per (build, env) and fed to assertConsistent.

const DUMP = "/home/velzie/.cache/sjreview/scratch-a19";

export const PROBE_JS = `
(async () => {
	const r = {};
	const t = async (k, f) => { try { r[k] = await f(); } catch (e) { r[k] = "ERR:" + (e && e.name) + ":" + String(e && e.message).slice(0, 60); } };
	await t("origin", () => self.origin);
	await t("href", () => location.href.replace(/[0-9]{4,5}/g, "P").slice(0, 80));
	await t("ls", () => localStorage.getItem("topls"));
	await t("ss", () => sessionStorage.getItem("topss"));
	await t("lsLen", () => localStorage.length);
	await t("cookie", () => typeof document === "undefined" ? "noDoc" : document.cookie);
	await t("cs", async () => typeof cookieStore === "undefined" ? "noCS" : (await cookieStore.getAll()).map((c) => c.name).join(","));
	await t("idb", async () => (await indexedDB.databases()).map((d) => d.name).filter((n) => n.startsWith("rv19")).join(","));
	await t("idbRead", () => new Promise((res, rej) => { const q = indexedDB.open("rv19db"); q.onupgradeneeded = () => { q.transaction.abort(); }; q.onsuccess = () => { const v = q.result.version; q.result.close(); res("v" + v); }; q.onerror = () => res("openErr:" + (q.error && q.error.name)); }));
	await t("caches", async () => (await caches.keys()).filter((n) => n.startsWith("rv19")).join(","));
	await t("cacheMatch", async () => { const m = await caches.match("/rv19entry"); return m ? await m.text() : null; });
	await t("opfs", async () => { const root = await navigator.storage.getDirectory(); const n = []; for await (const [k] of root.entries()) n.push(k); return n.filter((x) => x.startsWith("rv19")).join(","); });
	await t("locks", async () => (await navigator.locks.query()).held.map((l) => l.name).filter((n) => n.startsWith("rv19")).join(","));
	await t("bc", () => { const c = new BroadcastChannel("rv19bc"); c.postMessage(self.PROBE_ID); return c.name; });
	const msg = { rv19: true, id: self.PROBE_ID, r };
	if (typeof WorkerGlobalScope !== "undefined") {
		if (self.__port) self.__port.postMessage(msg); else postMessage(msg);
	} else {
		const to = parent !== self ? parent : opener;
		let done = false;
		if (self.__rv19cb) { self.__rv19cb(msg); done = true; }
		else if (to && (self.origin === "null" ? false : true)) { try { to.__rv19cb(msg); done = true; } catch {} }
		if (done) {}
		else if (to) to.postMessage(msg, "*");
		else fetch("${"${ORIGIN}"}/report", { method: "POST", body: JSON.stringify(msg) });
	}
})();
`;

export function probeServer(
	server: any,
	port: number,
	extra?: (req: any, res: any, path: string) => boolean
) {
	const origin = "http://localhost:" + port;
	let reported: any[] = [];
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		const q = new URL(req.url, "http://x").searchParams;
		const id = q.get("id") || "?";
		if (extra && extra(req, res, path)) return;
		if (path === "/probe.js") {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
				"Access-Control-Allow-Origin": "*",
			});
			res.end(PROBE_JS.replace("${ORIGIN}", origin));
			return;
		}
		if (path === "/probe.html") {
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(
				`<!doctype html><script>self.PROBE_ID=${JSON.stringify(id)}</script><script src="/probe.js"></script>`
			);
			return;
		}
		if (path === "/worker.js") {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
			});
			res.end(
				`self.PROBE_ID=${JSON.stringify(id)};importScripts("/probe.js");`
			);
			return;
		}
		if (path === "/shared.js") {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
			});
			res.end(
				`onconnect=(e)=>{self.__port=e.ports[0];self.PROBE_ID=${JSON.stringify(id)}+":"+self.name;importScripts("/probe.js");};`
			);
			return;
		}
		if (path === "/report") {
			let b = "";
			req.on("data", (c: any) => (b += c));
			req.on("end", () => {
				reported.push(JSON.parse(b));
				res.writeHead(200, {
					"Access-Control-Allow-Origin": "*",
				});
				res.end("ok");
			});
			return;
		}
		if (path === "/reported") {
			res.writeHead(200, {
				"Content-Type": "application/json",
			});
			res.end(JSON.stringify(reported));
			return;
		}
		if (path === "/dump") {
			let b = "";
			req.on("data", (c: any) => (b += c));
			req.on("end", () => {
				const d = JSON.parse(b);
				fs.mkdirSync(DUMP, {
					recursive: true,
				});
				fs.writeFileSync(
					`${DUMP}/${d.name}-${process.env.RUNWAY_PORT_BASE}-${d.env}.json`,
					JSON.stringify(d.results, null, 1)
				);
				res.writeHead(200);
				res.end("ok");
			});
			return;
		}
	});
}

// shared by page JS: harness for collecting reports
export const COLLECT = `
	const results = {};
	const waiters = {};
	self.__rv19cb = (d) => { results[d.id] = JSON.parse(JSON.stringify(d.r)); waiters[d.id] && waiters[d.id](); };
	addEventListener("message", (e) => { const d = e.data; if (d && d.rv19) self.__rv19cb(d); });
	const bcSeen = [];
	const bcTop = new BroadcastChannel("rv19bc"); bcTop.onmessage = (e) => bcSeen.push(e.data);
	const wait = (id, ms = 5000) => new Promise((res) => { if (results[id]) return res(); waiters[id] = res; setTimeout(() => { if (!results[id]) results[id] = "TIMEOUT"; res(); }, ms); });
	const frame = (attrs, html) => { const f = document.createElement("iframe"); for (const k in attrs) f.setAttribute(k, attrs[k]); document.body.appendChild(f); return f; };
	const ENV = navigator.serviceWorker ? "bare" : "sj";
	const PROBE = location.origin + "/probe.js";
	const PSRC = await (await fetch("/probe.js")).text();
	const inl = (id) => "<script>self.PROBE_ID=" + JSON.stringify(id) + "<\/script><script>" + PSRC + "<\/script>";
	const runIn = (d, id) => { const s = d.createElement("script"); s.textContent = "self.PROBE_ID=" + JSON.stringify(id) + ";" + PSRC; d.body.appendChild(s); };
	const dump = async (name) => {
		results.bcSeen = bcSeen.slice().sort();
		await fetch("/dump", { method: "POST", body: JSON.stringify({ name, env: ENV, results }) });
		for (const k of Object.keys(results).sort()) assertConsistent(k, results[k]);
	};
	const seed = async () => {
		localStorage.setItem("topls", "L");
		sessionStorage.setItem("topss", "S");
		document.cookie = "topck=1; path=/";
		await new Promise((res) => { const q = indexedDB.open("rv19db", 3); q.onupgradeneeded = () => q.result.createObjectStore("s"); q.onsuccess = () => { q.result.close(); res(); }; q.onerror = res; });
		const c = await caches.open("rv19c"); await c.put("/rv19entry", new Response("E"));
		const root = await navigator.storage.getDirectory(); await root.getFileHandle("rv19f", { create: true });
		navigator.locks.request("rv19lock", () => new Promise(() => {}));
		await new Promise((r) => setTimeout(r, 300));
	};
`;

export default [
	serverTest({
		name: "rv19-matrix-frames",
		autoPass: true,
		js: `
			${COLLECT}
			await seed();
			const script = (id) => "<script>self.PROBE_ID=" + JSON.stringify(id) + "<\\/script><script src=" + JSON.stringify(PROBE) + "><\\/script>";
			// top
			self.PROBE_ID = "a-top";
			{ const s = document.createElement("script"); s.src = "/probe.js"; document.head.appendChild(s); }
			await wait("a-top");
			frame({ src: "/probe.html?id=b-same" }); await wait("b-same");
			frame({ src: "http://127.0.0.1:" + location.port + "/probe.html?id=c-crossorigin" }); await wait("c-crossorigin");
			{ const f = frame({}); runIn(f.contentDocument, "d-blank"); await wait("d-blank"); }
			frame({ srcdoc: script("e-srcdoc") }); await wait("e-srcdoc");
			{ const f = frame({}); f.contentDocument.open(); f.contentDocument.write(inl("f-docwrite")); f.contentDocument.close(); await wait("f-docwrite"); }
			{ const u = URL.createObjectURL(new Blob([script("g-blob")], { type: "text/html" })); frame({ src: u }); await wait("g-blob"); }
			frame({ src: "data:text/html," + encodeURIComponent(script("h-data")) }); await wait("h-data");
			frame({ src: "/probe.html?id=i-sandbox", sandbox: "allow-scripts" }); await wait("i-sandbox");
			frame({ src: "/probe.html?id=j-sandbox-so", sandbox: "allow-scripts allow-same-origin" }); await wait("j-sandbox-so");
			frame({ srcdoc: script("k-sandbox-srcdoc"), sandbox: "allow-scripts" }); await wait("k-sandbox-srcdoc");
			{ const w = new Worker("/worker.js?id=l-worker"); w.onmessage = (e) => { results[e.data.id] = e.data.r; waiters[e.data.id] && waiters[e.data.id](); }; await wait("l-worker"); }
			{ const u = URL.createObjectURL(new Blob(["self.PROBE_ID='m-blobworker';importScripts(" + JSON.stringify(PROBE) + ")"], { type: "text/javascript" })); const w = new Worker(u); w.onmessage = (e) => { results[e.data.id] = e.data.r; waiters[e.data.id] && waiters[e.data.id](); }; await wait("m-blobworker"); }
			{ const w = new SharedWorker("/shared.js?id=n-shared", "nm"); w.port.onmessage = (e) => { results["n-shared"] = e.data; waiters["n-shared"] && waiters["n-shared"](); }; w.port.start(); await wait("n-shared"); }
			history.pushState(null, "", "/deep/path/page?q=1#h");
			self.PROBE_ID = "o-pushstate";
			{ const s = document.createElement("script"); s.src = PROBE; document.head.appendChild(s); }
			await wait("o-pushstate");
			await new Promise((r) => setTimeout(r, 500));
			await dump("rv19-matrix-frames");
		`,
		start: async (server, port) => probeServer(server, port),
	}),
	serverTest({
		name: "rv19-matrix-popups",
		autoPass: true,
		js: `
			${COLLECT}
			await seed();
			const w1 = window.open("/probe.html?id=p-popup", "_blank"); await wait("p-popup"); w1 && w1.close();
			const w2 = window.open("/probe.html?id=q-noopener", "_blank", "noopener");
			for (let i = 0; i < 30 && !results["q-noopener"]; i++) { await new Promise((r) => setTimeout(r, 200)); const rep = await (await fetch("/reported")).json(); for (const x of rep) results[x.id] = x.r; }
			const w3 = window.open("http://127.0.0.1:" + location.port + "/probe.html?id=r-popup-xo", "_blank"); await wait("r-popup-xo"); w3 && w3.close();
			const w4 = window.open("", "_blank"); { runIn(w4.document, "s-popup-blank"); await wait("s-popup-blank"); w4.close(); }
			await new Promise((r) => setTimeout(r, 500));
			await dump("rv19-matrix-popups");
		`,
		start: async (server, port) => probeServer(server, port),
	}),
	serverTest({
		name: "rv19-matrix-nested-workers",
		autoPass: true,
		js: `
			${COLLECT}
			await seed();
			const onW = (w) => { w.onmessage = (e) => { if (e.data && e.data.rv19) self.__rv19cb(e.data); }; };
			const blobSrc = (id) => "self.PROBE_ID=" + JSON.stringify(id) + ";" + PSRC;
			// blob worker created inside an about:blank child
			{ const f = frame({}); const w = f.contentWindow; const u = w.URL.createObjectURL(new w.Blob([blobSrc("t-blank-blobworker")], { type: "text/javascript" })); onW(new w.Worker(u)); await wait("t-blank-blobworker"); }
			// blob worker inside a srcdoc child
			frame({ srcdoc: "<script>const u = URL.createObjectURL(new Blob([" + JSON.stringify(blobSrc("u-srcdoc-blobworker")) + "], { type: 'text/javascript' })); const w = new Worker(u); w.onmessage = (e) => parent.__rv19cb(e.data);<\/script>" }); await wait("u-srcdoc-blobworker");
			// module worker
			{ const u = URL.createObjectURL(new Blob([blobSrc("v-module-blobworker")], { type: "text/javascript" })); onW(new Worker(u, { type: "module" })); await wait("v-module-blobworker"); }
			// data: worker (opaque in Chrome)
			{ try { onW(new Worker("data:text/javascript," + encodeURIComponent(blobSrc("w-data-worker")))); await wait("w-data-worker"); } catch (e) { results["w-data-worker"] = "ctorERR:" + e.name; } }
			// nested worker
			{ const u = URL.createObjectURL(new Blob(["const inner = new Worker(" + JSON.stringify(location.origin + "/worker.js?id=x-nested") + "); inner.onmessage = (e) => postMessage(e.data);"], { type: "text/javascript" })); onW(new Worker(u)); await wait("x-nested"); }
			await dump("rv19-matrix-nested-workers");
		`,
		start: async (server, port) => probeServer(server, port),
	}),
];
