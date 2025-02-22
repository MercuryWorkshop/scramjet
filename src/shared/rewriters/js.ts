import { URLMeta } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be
import {
	initSync,
	rewrite_js,
	rewrite_js_from_arraybuffer,
	RewriterOutput,
} from "../../../rewriter/wasm/out/wasm.js";
import { $scramjet, flagEnabled } from "../../scramjet";

if (self.WASM)
	self.REAL_WASM = Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0));

// only use in sw
export async function asyncInitRewriter() {
	const buf = await fetch($scramjet.config.files.wasm).then((r) =>
		r.arrayBuffer()
	);
	self.REAL_WASM = new Uint8Array(buf);
}

Error.stackTraceLimit = 50;

const decoder = new TextDecoder();

function rewriteJsWrapper(
	input: string | ArrayBuffer,
	source: string | null,
	meta: URLMeta,
	module: boolean
): string | ArrayBuffer {
	initSync({
		module: new WebAssembly.Module(self.REAL_WASM),
	});

	let out: RewriterOutput;
	const before = performance.now();
	try {
		if (typeof input === "string") {
			out = rewrite_js(
				input,
				meta.base.href,
				module,
				source || "(unknown)",
				$scramjet
			);
		} else {
			out = rewrite_js_from_arraybuffer(
				new Uint8Array(input),
				meta.base.href,
				module,
				source || "(unknown)",
				$scramjet
			);
		}
	} catch (err) {
		const err1 = err as Error;
		console.warn("failed rewriting js for", source, err1, input);
		err1.message = `failed rewriting js for "${source}": ${err1.message}`;
		return input;
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
			`oxc rewrite for "${source || "(unknown)"}" was ${timespan} (${duration}ms; ${overhead}ms overhead)`
		);
	}

	return typeof input === "string" ? decoder.decode(js) : js;
}

export function rewriteJs(
	js: string | ArrayBuffer,
	url: string | null,
	meta: URLMeta,
	module = false
) {
	if (flagEnabled("naiiveRewriter", meta.origin)) {
		const text = typeof js === "string" ? js : new TextDecoder().decode(js);

		return rewriteJsNaiive(text);
	}

	return rewriteJsWrapper(js, url, meta, module);
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
