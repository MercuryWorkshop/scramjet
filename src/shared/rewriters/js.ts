import { URLMeta } from "./url";

import { $scramjet, flagEnabled } from "../../scramjet";
import { getRewriter, JsRewriterOutput } from "./wasm";

Error.stackTraceLimit = 50;

const decoder = new TextDecoder();

function rewriteJsWasm(
	input: string | Uint8Array,
	source: string | null,
	meta: URLMeta,
	module: boolean
): { js: string | Uint8Array; map: Uint8Array | null; tag: string } {
	let [rewriter, ret] = getRewriter(meta);

	try {
		let out: JsRewriterOutput;
		const before = performance.now();
		try {
			if (typeof input === "string") {
				out = rewriter.rewrite_js(
					input,
					meta.base.href,
					source || "(unknown)",
					module
				);
			} else {
				out = rewriter.rewrite_js_bytes(
					input,
					meta.base.href,
					source || "(unknown)",
					module
				);
			}
		} catch (err) {
			const err1 = err as Error;
			console.warn("failed rewriting js for", source, err1.message, input);

			return { js: input, tag: "", map: null };
		}
		const after = performance.now();
		let { js, map, scramtag, errors } = out;
		let duration = after - before;

		if (flagEnabled("sourcemaps", meta.base) && !globalThis.clients) {
			globalThis[globalThis.$scramjet.config.globals.pushsourcemapfn](
				Array.from(map),
				scramtag
			);

			map = null;
		}

		if (flagEnabled("rewriterLogs", meta.base)) {
			for (const error of errors) {
				console.error("oxc parse error", error);
			}
		}

		if (flagEnabled("rewriterLogs", meta.base)) {
			let timespan: string;
			if (duration < 1) {
				timespan = "BLAZINGLY FAST";
			} else if (duration < 500) {
				timespan = "decent speed";
			} else {
				timespan = "really slow";
			}
			console.log(
				`oxc rewrite for "${source || "(unknown)"}" was ${timespan} (${duration}ms)`
			);
		}

		return {
			js: typeof input === "string" ? decoder.decode(js) : js,
			tag: scramtag,
			map,
		};
	} finally {
		ret();
	}
}

// 1. does not work with modules
// 2. cannot proxy import()
// 3. disables "use strict" optimizations
// 4. i think the global state can get clobbered somehow
//
// if you can ensure all the preconditions are met this is faster than full rewrites
function rewriteJsNaiive(js: string | ArrayBuffer) {
	if (typeof js !== "string") {
		js = new TextDecoder().decode(js);
	}

	return `
		with (${$scramjet.config.globals.wrapfn}(globalThis)) {

			${js}

		}
	`;
}

function rewriteJsInner(
	js: string | Uint8Array,
	url: string | null,
	meta: URLMeta,
	module = false
) {
	if (flagEnabled("naiiveRewriter", meta.origin)) {
		const text = typeof js === "string" ? js : new TextDecoder().decode(js);

		return { js: rewriteJsNaiive(text), tag: "", map: null };
	}

	return rewriteJsWasm(js, url, meta, module);
}

export function rewriteJs(
	js: string | Uint8Array,
	url: string | null,
	meta: URLMeta,
	module = false
) {
	return rewriteJsInner(js, url, meta, module).js;
}

export function rewriteJsWithMap(
	js: string | Uint8Array,
	url: string | null,
	meta: URLMeta,
	module = false
) {
	return rewriteJsInner(js, url, meta, module);
}
