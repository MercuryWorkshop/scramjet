import { serverTest } from "../../../testcommon.ts";

// rv20: targeted worker scenarios. Each test dumps one JSON object
// (RV20DUMP <kind>) and asserts consistency against bare Chrome per key.

const REPORT = String.raw`
const report = (kind, r) => {
	for (const k of Object.keys(r)) assertConsistent(kind + "." + k, r[k]);
	console.log("RV20DUMP " + kind + " " + JSON.stringify(r));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (target, ev, ms = 5000) => new Promise((res) => { const t = setTimeout(() => res("timeout"), ms); target.addEventListener(ev, (e) => { clearTimeout(t); res(e); }, { once: true }); });
const msg = (w, ms = 5000) => new Promise((res) => { const t = setTimeout(() => res("timeout"), ms); w.onmessage = (e) => { clearTimeout(t); res(e.data); }; w.onerror = (e) => { clearTimeout(t); res("error:" + (e.message || e.type)); }; });
const guard = async (f) => { try { return await f(); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 200); } };
`;

// worker body answering origin / BroadcastChannel / idb questions
const INFO = `
self.onmessage = async (e) => {
	const out = { origin: self.origin, href: location.href.replace(/[0-9a-f-]{36}/, "UUID") };
	out.bc = await new Promise((res) => { const c = new BroadcastChannel("rv20s"); c.onmessage = (m) => { res(m.data); c.close(); }; c.postMessage("ping"); setTimeout(() => res("timeout"), 1500); });
	out.idb = await new Promise((res) => { const q = indexedDB.open("rv20sdb"); q.onsuccess = () => { res([...q.result.objectStoreNames]); q.result.close(); }; q.onerror = () => res("err"); });
	out.ls = await caches.keys().then((k) => k.filter((x) => /rv20/.test(x)), (e) => "ERR " + e.name);
	postMessage(out);
};`;

const route = (server: any, extra: Record<string, [string, string]> = {}) =>
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		const r: Record<string, [string, string]> = {
			"/info.js": ["application/javascript", INFO],
			"/info-src.txt": ["text/plain", INFO],
			"/echo.js": [
				"application/javascript",
				"onmessage = (e) => postMessage(e.data); postMessage('up');",
			],
			"/shared.js": [
				"application/javascript",
				"const inst = Math.random(); let n = 0; onconnect = (e) => { n++; e.ports[0].postMessage({ inst, n, name: self.name }); };",
			],
			"/frame.html": [
				"text/html",
				"<!doctype html><script>window.mkShared = (n) => new SharedWorker('/shared.js', n); window.mkWorker = (u, o) => new Worker(u, o); window.mkBlobWorker = (src) => new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));<\/script>",
			],
			...extra,
		};
		const hit = r[path];
		if (!hit) {
			res.writeHead(404);
			res.end("nf");
			return;
		}
		res.writeHead(200, {
			"Content-Type": hit[0],
		});
		res.end(hit[1]);
	});

const PAGE = String.raw`
const bc = new BroadcastChannel("rv20s"); bc.onmessage = () => bc.postMessage("pong");
await new Promise((res) => { const q = indexedDB.open("rv20sdb", 1); q.onupgradeneeded = () => q.result.createObjectStore("pagestore"); q.onsuccess = () => { q.result.close(); res(); }; q.onerror = res; });
await caches.open("rv20s-cache");
const infoSrc = await (await fetch("/info-src.txt")).text();
`;

export default [
	// a worker whose script is a data: URL (the "inline worker" fallback used
	// when blob: is blocked, e.g. by worker-src CSP, and by some bundler plugins)
	serverTest({
		name: "rv20-sc-origins",
		autoPass: true,
		js:
			REPORT +
			PAGE +
			String.raw`
		const out = {};
		const ask = async (w) => { const p = msg(w); w.postMessage(1); return await p; };
		out.file = await ask(new Worker("/info.js"));
		out.data = await ask(new Worker("data:text/javascript," + encodeURIComponent(infoSrc)));
		out.blob = await ask(new Worker(URL.createObjectURL(new Blob([infoSrc], { type: "text/javascript" }))));
		// blob worker created inside an about:blank child and a srcdoc child
		const fr = document.createElement("iframe"); document.body.append(fr);
		const bl = fr.contentWindow.URL.createObjectURL(new fr.contentWindow.Blob([infoSrc], { type: "text/javascript" }));
		out.blankBlob = await ask(new fr.contentWindow.Worker(bl));
		out.blankBlobFromTop = await ask(new Worker(bl));
		const sd = document.createElement("iframe"); sd.srcdoc = "<p>x</p>"; document.body.append(sd); await once(sd, "load");
		out.srcdocBlob = await ask(new sd.contentWindow.Worker(sd.contentWindow.URL.createObjectURL(new sd.contentWindow.Blob([infoSrc]))));
		out.srcdocFile = await ask(new sd.contentWindow.Worker("/info.js"));
		// real child document at a same-origin URL
		const rf = document.createElement("iframe"); rf.src = "/frame.html"; document.body.append(rf); await once(rf, "load");
		out.childBlob = await ask(rf.contentWindow.mkBlobWorker(infoSrc));
		out.childFile = await ask(rf.contentWindow.mkWorker("/info.js"));
		report("origins", out);
	`,
		start: async (server) => route(server),
	}),
	// SharedWorker identity: same name from page / child / srcdoc child, other names
	serverTest({
		name: "rv20-sc-shared-identity",
		autoPass: true,
		js:
			REPORT +
			String.raw`
		const connect = (sw) => msg(sw.port);
		const a = await connect(new SharedWorker("/shared.js", "one"));
		const b = await connect(new SharedWorker("/shared.js", { name: "one" }));
		const c = await connect(new SharedWorker("/shared.js", "two"));
		const d = await connect(new SharedWorker("/shared.js"));
		const e = await connect(new SharedWorker("/shared.js", ""));
		const f2 = await connect(new SharedWorker("/shared.js", {}));
		const rf = document.createElement("iframe"); rf.src = "/frame.html"; document.body.append(rf); await once(rf, "load");
		const g = await connect(rf.contentWindow.mkShared("one"));
		const bf = document.createElement("iframe"); document.body.append(bf);
		const h = await connect(new bf.contentWindow.SharedWorker("/shared.js", "one"));
		const sd = document.createElement("iframe"); sd.srcdoc = "<p>x</p>"; document.body.append(sd); await once(sd, "load");
		const i = await connect(new sd.contentWindow.SharedWorker("/shared.js", "one"));
		const same = (x, y) => x && y && x.inst === y.inst;
		report("sharedid", {
			stringVsDict: same(a, b), twoDiffers: !same(a, c), unnamedVsEmpty: same(d, e), unnamedVsDict: same(d, f2),
			unnamedVsOne: same(d, a), childSame: same(a, g), blankChildSame: same(a, h), srcdocSame: same(a, i),
			names: [a.name, c.name, d.name, g.name, i.name],
		});
	`,
		start: async (server) => route(server),
	}),
	// a worker created in a popup, and one created in a popup from a worker URL relative to the popup
	serverTest({
		name: "rv20-sc-popup",
		autoPass: true,
		js:
			REPORT +
			PAGE +
			String.raw`
		const out = {};
		const ask = async (w) => { const p = msg(w); w.postMessage(1); return await p; };
		const pop = window.open("/frame.html", "_blank");
		await new Promise((r) => { const t = setInterval(() => { try { if (pop.mkWorker) { clearInterval(t); r(); } } catch {} }, 50); setTimeout(r, 5000); });
		out.popFile = await guard(() => ask(pop.mkWorker("/info.js")));
		out.popBlob = await guard(() => ask(pop.mkBlobWorker(infoSrc)));
		const bp = window.open("", "_blank");
		out.blankPopFile = await guard(() => ask(new bp.Worker("/info.js")));
		pop.close(); bp.close();
		report("popup", out);
	`,
		start: async (server) => route(server),
	}),
	// srcdoc child that makes the worker from its own script
	serverTest({
		name: "rv20-sc-srcdoc-own",
		autoPass: true,
		js:
			REPORT +
			String.raw`
		const fr = document.createElement("iframe");
		fr.srcdoc = "<script>parent.__srcdocReady(typeof Worker); try { const w = new Worker('/echo.js'); w.onmessage = (e) => parent.__srcdocMsg(e.data); w.onerror = (e) => parent.__srcdocMsg('error ' + e.message); } catch (e) { parent.__srcdocMsg('ERR ' + e.message); }<\/script>";
		const ready = new Promise((r) => window.__srcdocReady = r);
		const got = new Promise((r) => { window.__srcdocMsg = r; setTimeout(() => r("timeout"), 6000); });
		document.body.append(fr);
		report("srcdocown", { ready: await Promise.race([ready, wait(6000).then(() => "timeout")]), got: await got });
	`,
		start: async (server) => route(server),
	}),
];
