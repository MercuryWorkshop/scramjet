import { URLMeta } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be
import {
	init,
	initSync,
	rewrite_js,
	rewrite_js_from_arraybuffer,
} from "../../../rewriter/out/rewriter.js";
import { $scramjet } from "../../scramjet";

initSync({
	module: new WebAssembly.Module(
		Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0))
	),
});

init();

Error.stackTraceLimit = 50;

export function rewriteJs(js: string | ArrayBuffer, meta: URLMeta) {
	if ($scramjet.config.flags.naiiveRewriter) {
		const text = typeof js === "string" ? js : new TextDecoder().decode(js);

		return rewriteJsNaiive(text);
	}

	const before = performance.now();
	if (typeof js === "string") {
		js = new TextDecoder().decode(rewrite_js(js, meta.base.href, $scramjet));
	} else {
		js = rewrite_js_from_arraybuffer(
			new Uint8Array(js),
			meta.base.href,
			$scramjet
		);
	}
	const after = performance.now();

	// dbg.debug("Rewrite took", Math.floor((after - before) * 10) / 10, "ms");

	return js;
}

// 1. does not work with modules
// 2. cannot proxy import()
// 3. disables "use strict" optimizations
// 4. i think the global state can get clobbered somehow
//
// if you can ensure all the preconditions are met this is faster than full rewrites
export function rewriteJsNaiive(js: string | ArrayBuffer) {
	if (typeof js !== "string") {
		js = new TextDecoder().decode(js);
	}

	return `
		with (${$scramjet.config.globals.wrapfn}(globalThis)) {

			${js}

		}
	`;
}
