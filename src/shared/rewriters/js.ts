import { decodeUrl } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be
import {
	init,
	initSync,
	rewrite_js,
	rewrite_js_from_arraybuffer,
} from "../../../rewriter/out/rewriter.js";

initSync(
	new WebAssembly.Module(
		Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0))
	)
);

init();

Error.stackTraceLimit = 50;

global.rws = rewriteJs;
export function rewriteJs(js: string | ArrayBuffer, origin?: URL) {
	if ("window" in globalThis)
		origin = origin ?? new URL(decodeUrl(location.href));

	const before = performance.now();
	if (typeof js === "string") {
		js = new TextDecoder().decode(
			rewrite_js(js, origin.toString(), self.$scramjet)
		);
	} else {
		js = rewrite_js_from_arraybuffer(
			new Uint8Array(js),
			origin.toString(),
			self.$scramjet
		);
	}
	const after = performance.now();

	// dbg.debug("Rewrite took", Math.floor((after - before) * 10) / 10, "ms");

	if (typeof js !== "string") js = new TextDecoder().decode(js);
	js = js.replaceAll(
		`(c=H[36](57,T,(F=(d=["contentWindow","ports",(S=p.dH,"recaptcha-setup")],S).data==d[2],S).origin)==H[36](59,T,A),b=!E||S.source==E[d[0]],F&&c&&b&&S[d[1]].length>M)?S[d[1]][M]:null`,
		" p.dH.ports[0]"
	);
	return js;
}

// 1. does not work with modules
// 2. cannot proxy import()
// 3. disables "use strict" optimizations
// 4. i think the global state can get clobbered somehow
//
// if you can ensure all the preconditions are met this is faster than full rewrites
export function rewriteJsNaiive(js: string | ArrayBuffer, origin?: URL) {
	if ("window" in globalThis)
		origin = origin ?? new URL(decodeUrl(location.href));

	if (typeof js !== "string") {
		js = new TextDecoder().decode(js);
	}

	return `
		with (${self.$scramjet.config.wrapfn}(globalThis)) {

			${js}

		}
	`;
}
