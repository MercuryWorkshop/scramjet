import { serverTest } from "../../../testcommon.ts";

// rv20: worklet module loading (develop now tags addModule URLs isModule:true)

const FILES: Record<string, string> = {
	"/wl/proc.js": `import { v } from "./dep.js"; import * as rel from "../top-dep.js";
class P extends AudioWorkletProcessor { constructor() { super(); this.port.postMessage({ v, rel: rel.t, meta: import.meta.url, glob: Object.getOwnPropertyNames(globalThis).filter((k) => /scramjet|^\\$/.test(k)) }); } process() { return true; } }
registerProcessor("rv20-proc", P);`,
	"/wl/dep.js": `export const v = "dep";`,
	"/top-dep.js": `export const t = "top";`,
	"/wl/plain.js": `class Q extends AudioWorkletProcessor { constructor() { super(); this.port.postMessage({ meta: import.meta.url, src: String(Q).slice(0, 40) }); } process() { return true; } } registerProcessor("rv20-plain", Q);`,
	"/wl/dyn.js": `class D extends AudioWorkletProcessor { constructor() { super(); this.port.postMessage({ ok: 1 }); } process() { return true; } } registerProcessor("rv20-dyn", D);`,
	"/wl/paint.js": `import { v } from "./dep.js"; registerPaint("rv20paint", class { paint(ctx, size) { ctx.fillStyle = v === "dep" ? "rgb(0,255,0)" : "rgb(255,0,0)"; ctx.fillRect(0, 0, size.width, size.height); } });`,
};

export default [
	serverTest({
		name: "rv20-worklets",
		autoPass: true,
		js: String.raw`
		const guard = async (f) => { try { return await f(); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 160); } };
		const fromNode = (ctx, name) => new Promise((res) => { const n = new AudioWorkletNode(ctx, name); n.port.onmessage = (e) => res(e.data); setTimeout(() => res("timeout"), 3000); });
		const out = {};
		const ctx = new OfflineAudioContext(1, 128, 44100);
		out.staticImport = await guard(async () => { await ctx.audioWorklet.addModule("/wl/proc.js"); return fromNode(ctx, "rv20-proc"); });
		out.plain = await guard(async () => { await ctx.audioWorklet.addModule("wl/plain.js"); return fromNode(ctx, "rv20-plain"); });
		const src = 'class B extends AudioWorkletProcessor { constructor() { super(); this.port.postMessage({ blob: 1, meta: import.meta.url.slice(0, 5) }); } process() { return true; } } registerProcessor("rv20-blob", B);';
		out.blob = await guard(async () => { await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: "text/javascript" }))); return fromNode(ctx, "rv20-blob"); });
		out.data = await guard(async () => { await ctx.audioWorklet.addModule("data:text/javascript," + encodeURIComponent(src.replace(/rv20-blob/, "rv20-data"))); return fromNode(ctx, "rv20-data"); });
		out.missing = await guard(async () => { await ctx.audioWorklet.addModule("/wl/nope.js"); return "resolved"; });
		out.credsOmit = await guard(async () => { await ctx.audioWorklet.addModule("/wl/dyn.js", { credentials: "omit" }); return fromNode(ctx, "rv20-dyn"); });
		out.paint = await guard(async () => {
			await CSS.paintWorklet.addModule("/wl/paint.js");
			const d = document.createElement("div"); d.style.cssText = "width:10px;height:10px;background:paint(rv20paint)"; document.body.append(d);
			await new Promise((r) => setTimeout(r, 500));
			return "added";
		});
		for (const k of Object.keys(out)) assertConsistent("wl." + k, out[k]);
		console.log("RV20DUMP worklets " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (FILES[p]) {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(FILES[p]);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];
