import { serverTest } from "../../testcommon.ts";

// WebAssembly is unusually strict about what the network layer hands it:
// instantiateStreaming/compileStreaming refuse anything that isn't served as
// application/wasm, and the bytes have to arrive untouched. A proxy that
// rewrites bodies or normalises content types breaks every wasm-backed library
// (ffmpeg.wasm, sql.js, PDF and image codecs, game engines).
//
// Nothing here diverges - this is regression cover for an area with no tests.

// a minimal module exporting f42() -> i32, returning 42
const WASM = Buffer.from([
	0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00,
	0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x66, 0x34, 0x32,
	0x00, 0x00, 0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x2a, 0x0b,
]);

const wasmTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/mod.wasm") {
					res.writeHead(200, { "Content-Type": "application/wasm" });
					res.end(WASM);
					return;
				}
				if (path === "/nomime.wasm") {
					res.writeHead(200, { "Content-Type": "application/octet-stream" });
					res.end(WASM);
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("nf");
			});
		},
	});

export default [
	wasmTest(
		"wasm-instantiate-streaming",
		`
			const { instance, module } = await WebAssembly.instantiateStreaming(fetch("/mod.wasm"));
			assertEqual(instance.exports.f42(), 42, "instantiateStreaming compiled and ran the module");
			assert(module instanceof WebAssembly.Module, "a Module came back");
		`
	),
	wasmTest(
		"wasm-compile-streaming",
		`
			const mod = await WebAssembly.compileStreaming(fetch("/mod.wasm"));
			const instance = await WebAssembly.instantiate(mod);
			assertEqual(instance.exports.f42(), 42, "compileStreaming then instantiate");
			assertDeepEqual(WebAssembly.Module.exports(mod).map((e) => e.name), ["f42"], "Module.exports");
			assertDeepEqual(WebAssembly.Module.imports(mod), [], "Module.imports");
		`
	),
	wasmTest(
		"wasm-bytes-untouched",
		`
			const buf = await (await fetch("/mod.wasm")).arrayBuffer();
			assertEqual(buf.byteLength, 36, "the wasm bytes arrived at their original length");
			const magic = [...new Uint8Array(buf).slice(0, 4)];
			assertDeepEqual(magic, [0, 97, 115, 109], "the wasm magic header is intact");
			const { instance } = await WebAssembly.instantiate(buf);
			assertEqual(instance.exports.f42(), 42, "instantiate from an ArrayBuffer");
			assert(await WebAssembly.validate(buf), "WebAssembly.validate");
		`
	),
	wasmTest(
		"wasm-content-type-preserved",
		`
			const r = await fetch("/mod.wasm");
			assertEqual(r.headers.get("content-type"), "application/wasm",
				"the wasm content-type survives the proxy - streaming compilation depends on it");
			assertEqual((await r.arrayBuffer()).byteLength, 36, "byte length");
		`
	),
	wasmTest(
		"wasm-wrong-mime-rejects",
		`
			// the flip side: streaming compilation must still refuse a wrong type
			let err;
			try { await WebAssembly.instantiateStreaming(fetch("/nomime.wasm")); } catch (e) { err = e; }
			assert(err, "a non-wasm MIME type must reject");
			assert(String(err.message).toLowerCase().includes("mime") || err instanceof TypeError,
				"rejection reason: " + err.message);
		`
	),
];
