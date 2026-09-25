import { serverTest } from "../../../testcommon.ts";
import { readFileSync } from "node:fs";

// rv20: real worker-heavy libraries, loaded from jsdelivr (and sql.js from
// the test origin), compared against bare Chrome.

const CDN = "https://cdn.jsdelivr.net/npm";
const LIBDIR = "/home/velzie/.cache/sjreview/scratch-a20/libs";

const PDF = (() => {
	// a minimal one-page PDF with the text "Hello rv20"
	const objs = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		null,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
	const stream = "BT /F1 12 Tf 20 100 Td (Hello rv20) Tj ET";
	objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
	let out = "%PDF-1.4\n";
	const offs: number[] = [];
	objs.forEach((o, i) => {
		offs.push(out.length);
		out += `${i + 1} 0 obj\n${o}\nendobj\n`;
	});
	const xref = out.length;
	out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
	for (const o of offs) out += `${String(o).padStart(10, "0")} 00000 n \n`;
	out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return out;
})();

const FILES: Record<string, [string, () => string | Buffer]> = {
	"/cl-worker.js": [
		"text/javascript",
		() => `importScripts("${CDN}/comlink@4.4.1/dist/umd/comlink.js");
const api = { counter: 0, add(a, b) { return a + b; }, async cb(f) { return await f(3); }, buf(b) { return b.byteLength; }, inc() { return ++this.counter; }, where() { return [location.href, self.origin]; } };
if (self.onconnect !== undefined && typeof SharedWorkerGlobalScope !== "undefined") onconnect = (e) => Comlink.expose(api, e.ports[0]); else Comlink.expose(api);`,
	],
	"/sql/worker.sql-wasm.js": [
		"text/javascript",
		() => readFileSync(`${LIBDIR}/worker.sql-wasm.js`),
	],
	"/sql/sql-wasm.wasm": [
		"application/wasm",
		() => readFileSync(`${LIBDIR}/sql-wasm.wasm`),
	],
	"/doc.pdf": ["application/pdf", () => PDF],
};

const HELPERS = String.raw`
const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src)); document.head.append(s); });
const guard = async (f, ms = 20000) => { try { return await Promise.race([f(), new Promise((r) => setTimeout(() => r("timeout"), ms))]); } catch (e) { return "ERR " + (e && e.name) + ": " + String(e && e.message).slice(0, 200); } };
const CDN = "${CDN}";
const out = {};
const done = () => { for (const k of Object.keys(out)) assertConsistent("lib." + k, out[k]); console.log("RV20DUMP libs " + JSON.stringify(out)); };
`;

const T = (name: string, js: string) =>
	Object.assign(
		serverTest({
			name,
			autoPass: true,
			js: HELPERS + js + "\ndone();",
			start: async (server) => {
				server.on("request", (req: any, res: any) => {
					if (res.headersSent) return;
					const p = (req.url || "/").split("?")[0];
					if (p === "/" || p === "/script.js") return;
					const hit = FILES[p];
					if (hit) {
						res.writeHead(200, {
							"Content-Type": hit[0],
						});
						res.end(hit[1]());
						return;
					}
					res.writeHead(404);
					res.end();
				});
			},
		}),
		{
			timeoutMs: 90000,
		}
	);

export default [
	T(
		"rv20-lib-comlink",
		String.raw`
		await load(CDN + "/comlink@4.4.1/dist/umd/comlink.js");
		out.comlink = await guard(async () => {
			const api = Comlink.wrap(new Worker("/cl-worker.js"));
			const buf = new ArrayBuffer(12);
			return [await api.add(2, 3), await api.cb(Comlink.proxy((x) => x * 2)), await api.buf(Comlink.transfer(buf, [buf])), buf.byteLength, await api.inc(), await api.counter, await api.where()];
		});
		out.comlinkShared = await guard(async () => {
			const sw = new SharedWorker("/cl-worker.js", "cl");
			const api = Comlink.wrap(sw.port);
			return [await api.add(1, 1), await api.cb(Comlink.proxy((x) => x + 1))];
		});
	`
	),
	T(
		"rv20-lib-pdfjs",
		String.raw`
		await load(CDN + "/pdfjs-dist@3.11.174/build/pdf.min.js");
		out.pdfCdnWorker = await guard(async () => {
			pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + "/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
			const doc = await pdfjsLib.getDocument("/doc.pdf").promise;
			const page = await doc.getPage(1);
			const tc = await page.getTextContent();
			const c = document.createElement("canvas"); const vp = page.getViewport({ scale: 1 }); c.width = vp.width; c.height = vp.height;
			await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
			return [doc.numPages, tc.items.map((i) => i.str).join(""), c.width, !!doc._transport?.messageHandler];
		}, 40000);
	`
	),
	T(
		"rv20-lib-monaco",
		String.raw`
		const base = CDN + "/monaco-editor@0.52.0/min";
		window.MonacoEnvironment = { getWorkerUrl: () => "data:text/javascript;charset=utf-8," + encodeURIComponent("self.MonacoEnvironment={baseUrl:'" + base + "/'};importScripts('" + base + "/vs/base/worker/workerMain.js');") };
		await load(base + "/vs/loader.js");
		out.monaco = await guard(() => new Promise((res) => {
			require.config({ paths: { vs: base + "/vs" } });
			require(["vs/editor/editor.main"], () => {
				const el = document.createElement("div"); el.style.cssText = "width:400px;height:200px"; document.body.append(el);
				const model = monaco.editor.createModel("const x: number = 'str';\nlet y = x.nope;", "typescript", monaco.Uri.parse("file:///a.ts"));
				monaco.editor.create(el, { model });
				const poll = setInterval(() => { const m = monaco.editor.getModelMarkers({ resource: model.uri }); if (m.length) { clearInterval(poll); res(m.map((x) => x.code + ":" + x.startLineNumber).sort()); } }, 250);
			}, (e) => res("require error " + e));
		}), 45000);
	`
	),
	T(
		"rv20-lib-esbuild",
		String.raw`
		await load(CDN + "/esbuild-wasm@0.24.0/lib/browser.min.js");
		out.esbuild = await guard(async () => {
			await esbuild.initialize({ wasmURL: CDN + "/esbuild-wasm@0.24.0/esbuild.wasm", worker: true });
			const r = await esbuild.transform("let x: number = 1; export default x", { loader: "ts", format: "cjs" });
			return r.code.length > 10 && r.code.includes("x = 1");
		}, 40000);
	`
	),
	T(
		"rv20-lib-sqljs",
		String.raw`
		out.sqljs = await guard(async () => {
			const w = new Worker("/sql/worker.sql-wasm.js");
			const call = (m) => new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error " + e.message); w.postMessage(m); });
			await call({ id: 1, action: "open" });
			const r = await call({ id: 2, action: "exec", sql: "create table t(a); insert into t values (1),(2); select sum(a) as s from t;" });
			return r.results ? r.results[0].values : r;
		}, 30000);
	`
	),
];
