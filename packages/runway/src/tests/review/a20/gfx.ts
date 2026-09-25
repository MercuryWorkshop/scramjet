import { serverTest } from "../../../testcommon.ts";

// rv20: graphics/game APIs inside a worker: rAF, OffscreenCanvas, FontFace, ImageBitmap

const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR42mP8z8DwnwEIGBkYAAAhAwP/1pFZjQAAAABJRU5ErkJggg==",
	"base64"
);

const W = String.raw`
const g = async (f, ms = 4000) => { try { return await Promise.race([Promise.resolve().then(f), new Promise((r) => setTimeout(() => r("timeout"), ms))]); } catch (e) { return "ERR " + e.name + ": " + String(e.message).slice(0, 140); } };
onmessage = async () => {
	const out = {};
	out.raf = await g(() => new Promise((r) => { if (!self.requestAnimationFrame) return r("absent"); requestAnimationFrame((t) => r(typeof t)); }), 1500);
	out.webgl2 = await g(() => { const c = new OffscreenCanvas(4, 4); const gl = c.getContext("webgl2") || c.getContext("webgl"); return gl ? gl.constructor.name : "null"; });
	out.bitmap = await g(async () => { const b = await (await fetch("img.png")).blob(); const bm = await createImageBitmap(b); return [bm.width, bm.height]; });
	out.fontFaceRel = await g(async () => { const f = new FontFace("RvFont", "url(font.woff2)"); self.fonts.add(f); await f.load(); return f.status; });
	out.fontFaceAbs = await g(async () => { const f = new FontFace("RvFont2", "url(" + location.origin + "/w/font.woff2)"); await f.load(); return f.status; });
	out.imgDecoder = await g(async () => { if (!self.ImageDecoder) return "absent"; const d = new ImageDecoder({ data: (await fetch("img.png")).body, type: "image/png" }); const r = await d.decode(); return [r.image.displayWidth, r.image.displayHeight]; });
	postMessage(out);
};`;

export default [
	serverTest({
		name: "rv20-gfx",
		autoPass: true,
		js: String.raw`
		const w = new Worker("/w/gfx.js");
		const r = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res("error " + e.message); w.postMessage(1); setTimeout(() => res("timeout"), 20000); });
		for (const k of Object.keys(r)) assertConsistent("g." + k, r[k]);
		console.log("RV20DUMP gfx " + JSON.stringify(r));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (p === "/w/gfx.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(W);
					return;
				}
				if (p === "/w/img.png") {
					res.writeHead(200, {
						"Content-Type": "image/png",
					});
					res.end(PNG);
					return;
				}
				if (p === "/w/font.woff2") {
					// not a real font: Chrome reports "error" on load for both, but only after fetching it
					res.writeHead(200, {
						"Content-Type": "font/woff2",
						"Access-Control-Allow-Origin": "*",
					});
					res.end("notafont");
					(globalThis as any).__rv20font =
						((globalThis as any).__rv20font || 0) + 1;
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];
