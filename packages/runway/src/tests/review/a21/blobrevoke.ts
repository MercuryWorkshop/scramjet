import { basicTest, type Test } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv21-blob-revoke-immediately",
		js: `
		const R = {};
		const T = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("TIMEOUT"), ms))]);
		const mk = (code, type = "text/javascript") => URL.createObjectURL(new Blob([code], { type }));
		{ const u = mk("postMessage('w:' + (1+1))"); const w = new Worker(u); URL.revokeObjectURL(u);
		  R.worker = String(await T(new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = () => res("error"); }), 4000)); }
		{ const u = mk("onconnect = (e) => e.ports[0].postMessage('s:ok')"); const w = new SharedWorker(u); URL.revokeObjectURL(u);
		  R.sharedWorker = String(await T(new Promise((res) => { w.port.onmessage = (e) => res(e.data); w.onerror = () => res("error"); }), 4000)); }
		{ const u = mk("export const v = 42;"); const p = import(u); URL.revokeObjectURL(u);
		  R.dynImport = String(await T(p.then((m) => m.v, (e) => "reject " + e.name), 4000)); }
		{ const u = mk("hello", "text/plain"); const p = fetch(u); URL.revokeObjectURL(u);
		  R.fetch = String(await T(p.then((r) => r.text(), (e) => "reject " + e.name), 4000)); }
		{ const u = mk("window.__rv21s = 'ran'"); const s = document.createElement("script"); s.src = u; const p = new Promise((res) => { s.onload = () => res(window.__rv21s); s.onerror = () => res("error"); }); document.head.appendChild(s); URL.revokeObjectURL(u);
		  R.script = String(await T(p, 4000)); }
		{ const u = mk("<script>parent.postMessage('if:ok','*')<\\/script>", "text/html"); const f = document.createElement("iframe"); f.src = u; const p = new Promise((res) => addEventListener("message", (e) => { if (e.data === "if:ok") res(e.data); })); document.body.appendChild(f); URL.revokeObjectURL(u);
		  R.iframe = String(await T(p, 4000)); }
		{ const u = mk("importScripts(URL_IN); postMessage('is:' + self.__v)".replace("URL_IN", JSON.stringify(mk("self.__v = 7")))); const w = new Worker(u);
		  R.importScriptsControl = String(await T(new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = () => res("error"); }), 4000)); }
		console.log("RV21", JSON.stringify(R));
		for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);
	`,
	}),
] as Test[];
