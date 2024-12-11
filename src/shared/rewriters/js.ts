import { URLMeta } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be
import {
	initSync,
	rewrite_js,
	rewrite_js_from_arraybuffer,
	RewriterOutput,
} from "../../../rewriter/wasm/out/wasm.js";
import { $scramjet, flagEnabled } from "../../scramjet";

initSync({
	module: new WebAssembly.Module(
		Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0))
	),
});

Error.stackTraceLimit = 50;

const decoder = new TextDecoder();

function rewriteJsWrapper(
	input: string | ArrayBuffer,
	url: string | null,
	meta: URLMeta
): string | ArrayBuffer {
	let out: RewriterOutput;
	const before = performance.now();
	if (typeof input === "string") {
		out = rewrite_js(input, meta.base.href, url || "(unknown)", $scramjet);
	} else {
		out = rewrite_js_from_arraybuffer(
			new Uint8Array(input),
			meta.base.href,
			url || "(unknown)",
			$scramjet
		);
	}
	const after = performance.now();
	const { js, errors, duration } = out;

	if (flagEnabled("rewriterLogs", meta.base)) {
		for (const error of errors) {
			console.error("oxc parse error", error);
		}
	}

	if (flagEnabled("rewriterLogs", meta.base)) {
		let timespan: string;
		if (duration < 1n) {
			timespan = "BLAZINGLY FAST";
		} else if (duration < 500n) {
			timespan = "decent speed";
		} else {
			timespan = "really slow";
		}
		const overhead = (after - before - Number(duration)).toFixed(2);
		console.log(
			`oxc rewrite for "${url || "(unknown)"}" was ${timespan} (${duration}ms; ${overhead}ms overhead)`
		);
	}

	return typeof input === "string" ? decoder.decode(js) : js;
}

export function rewriteJs(
	js: string | ArrayBuffer,
	url: string | null,
	meta: URLMeta
) {
	if (flagEnabled("naiiveRewriter", meta.origin)) {
		const text = typeof js === "string" ? js : new TextDecoder().decode(js);

		console.log("naiive");

		return rewriteJsNaiive(text);
	}

	js = rewriteJsWrapper(js, url, meta);

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
