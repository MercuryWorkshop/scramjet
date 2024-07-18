import { decodeUrl } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be
import {
	initSync,
	rewrite_js,
	rewrite_js_from_arraybuffer,
} from "../../../rewriter/out/rewriter.js";
import "../../../static/wasm.js";

initSync(
	new WebAssembly.Module(
		Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0))
	)
);

global.rws = rewriteJs;
export function rewriteJs(js: string | ArrayBuffer, origin?: URL) {
	if ("window" in globalThis) origin ??= new URL(decodeUrl(location.href));

	const before = performance.now();
	if (typeof js === "string") {
		js = new TextDecoder().decode(rewrite_js(js, origin.toString()));
	} else {
		js = rewrite_js_from_arraybuffer(new Uint8Array(js), origin.toString());
	}
	const after = performance.now();

	console.log("Rewrite took", Math.floor((after - before) * 10) / 10, "ms");

	return js;
}
