import { config, flagEnabled } from "@/shared";
import { URLMeta } from "@rewriters/url";

import { getRewriter, JsRewriterOutput, textDecoder } from "@rewriters/wasm";

Error.stackTraceLimit = 50;

type RewriterResult = {
	js: string | Uint8Array;
	map: Uint8Array | null;
	tag: string;
	errors: string[];
};
function rewriteJsWasm(
	input: string | Uint8Array,
	source: string | null,
	meta: URLMeta,
	module: boolean
): RewriterResult {
	let [rewriter, ret] = getRewriter(meta);

	try {
		let out: JsRewriterOutput;
		const before = performance.now();
		// try {
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
		// } catch (err) {
		// 	const err1 = err as Error;
		// 	console.warn(
		// 		"failed rewriting js for",
		// 		source,
		// 		err1.message,
		// 		input instanceof Uint8Array ? textDecoder.decode(input) : input
		// 	);

		// 	return { js: input, tag: "", map: null };
		// }
		dbg.time(meta, before, `oxc rewrite for "${source || "(unknown)"}"`);

		const { js, map, scramtag, errors } = out;

		return {
			js: typeof input === "string" ? textDecoder.decode(js) : js,
			tag: scramtag,
			map,
			errors,
		};
	} finally {
		ret();
	}
}

export function rewriteJsInner(
	js: string | Uint8Array,
	url: string | null,
	meta: URLMeta,
	module = false
) {
	return rewriteJsWasm(js, url, meta, module);
}

export function rewriteJs(
	js: string | Uint8Array,
	url: string | null,
	meta: URLMeta,
	module = false
): string | Uint8Array {
	try {
		const res = rewriteJsInner(js, url, meta, module);
		let newjs = res.js;

		if (flagEnabled("sourcemaps", meta.base)) {
			const pushmap = globalThis[config.globals.pushsourcemapfn];
			if (pushmap) {
				pushmap(Array.from(res.map), res.tag);
			} else {
				if (newjs instanceof Uint8Array) {
					newjs = new TextDecoder().decode(newjs);
				}
				const sourcemapfn = `${config.globals.pushsourcemapfn}([${res.map.join(",")}], "${res.tag}");`;

				// don't put the sourcemap call before "use strict"
				const strictMode = /^\s*(['"])use strict\1;?/;
				if (strictMode.test(newjs)) {
					newjs = newjs.replace(strictMode, `$&\n${sourcemapfn}`);
				} else {
					newjs = `${sourcemapfn}\n${newjs}`;
				}
			}
		}

		if (flagEnabled("rewriterLogs", meta.base)) {
			for (const error of res.errors) {
				console.error("oxc parse error", error);
			}
		}

		return newjs;
	} catch (err) {
		console.warn(
			"failed rewriting js for",
			url || "(unknown)",
			err.message,
			js instanceof Uint8Array ? textDecoder.decode(js) : js
		);
		if (flagEnabled("allowInvalidJs", meta.base)) {
			return js;
		} else {
			throw err;
		}
	}
}
