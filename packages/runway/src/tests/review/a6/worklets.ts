import { serverTest, type Test } from "../../../testcommon.ts";

const FILES: Record<string, string> = {
	"/proc.js": `class P extends AudioWorkletProcessor { constructor() { super(); this.port.postMessage({ hello: 1, sr: sampleRate }); } process() { return true; } } registerProcessor("rv6-proc", P);`,
	"/mw.js": `import { v } from "./dep.js"; onmessage = (e) => postMessage(e.data + v);`,
	"/dep.js": `export const v = "-dep";`,
	"/sw.js": `onconnect = (e) => { const p = e.ports[0]; p.onmessage = (m) => p.postMessage(m.data + "-shared"); };`,
	"/cw.js": `importScripts("/dep2.js"); onmessage = (e) => postMessage(e.data + self.dep2);`,
	"/dep2.js": `self.dep2 = "-imp";`,
	"/paint.js": `registerPaint("rv6paint", class { paint(ctx, size) { ctx.fillStyle = "red"; ctx.fillRect(0, 0, size.width, size.height); } });`,
};
const t = (name: string, js: string) =>
	Object.assign(
		serverTest({
			name,
			autoPass: true,
			js,
			start: async (server) => {
				server.on("request", (req, res) => {
					if (res.headersSent) return;
					const p = (req.url || "/").split("?")[0];
					if (p === "/" || p === "/script.js") return;
					if (FILES[p]) {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(FILES[p]);
						return;
					}
					res.writeHead(404);
					res.end();
				});
			},
		}),
		{
			timeoutMs: 15000,
		}
	);

export default [
	t(
		"rv6-wl-audioworklet",
		`
		const ctx = new OfflineAudioContext(1, 128, 44100);
		await ctx.audioWorklet.addModule("/proc.js");
		const node = new AudioWorkletNode(ctx, "rv6-proc");
		const d = await new Promise((res, rej) => { node.port.onmessage = (e) => res(e.data); setTimeout(() => rej(new Error("no message from processor")), 3000); });
		assertEqual(d.hello, 1, "processor message data: " + JSON.stringify(d));
	`
	),
	t(
		"rv6-wl-audioworklet-blob",
		`
		const ctx = new OfflineAudioContext(1, 128, 44100);
		const src = 'class P extends AudioWorkletProcessor { process() { return true; } } registerProcessor("rv6-proc2", P);';
		await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
		new AudioWorkletNode(ctx, "rv6-proc2");
	`
	),
	t(
		"rv6-wl-paintworklet",
		`
		await CSS.paintWorklet.addModule("/paint.js");
	`
	),
	t(
		"rv6-wl-module-worker",
		`
		const w = new Worker("/mw.js", { type: "module" });
		const r = await new Promise((res, rej) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("worker error " + e.message)); w.postMessage("m"); setTimeout(() => rej(new Error("timeout")), 5000); });
		assertEqual(r, "m-dep"); w.terminate();
	`
	),
	t(
		"rv6-wl-classic-worker-importscripts",
		`
		const w = new Worker("/cw.js");
		const r = await new Promise((res, rej) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("worker error " + e.message)); w.postMessage("c"); setTimeout(() => rej(new Error("timeout")), 5000); });
		assertEqual(r, "c-imp"); w.terminate();
	`
	),
	t(
		"rv6-wl-shared-worker",
		`
		const w = new SharedWorker("/sw.js");
		const r = await new Promise((res, rej) => { w.port.onmessage = (e) => res(e.data); w.onerror = (e) => rej(new Error("sw error")); w.port.postMessage("s"); setTimeout(() => rej(new Error("timeout")), 5000); });
		assertEqual(r, "s-shared");
	`
	),
] as Test[];
