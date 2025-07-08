import { URLMeta } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be
import {
	init,
	initSync,
	rewrite_js,
	rewrite_js_from_arraybuffer,
	RewriterOutput,
} from "../../../rewriter/out/rewriter.js";
import { $scramjet, flagEnabled } from "../../scramjet";

initSync({
	module: new WebAssembly.Module(
		Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0))
	),
});

init();

Error.stackTraceLimit = 50;

const decoder = new TextDecoder();

function rewriteJsWrapper(
	input: string | ArrayBuffer,
	module: boolean,
	meta: URLMeta
): string | ArrayBuffer {
	let out: RewriterOutput;
	if (typeof input === "string") {
		out = rewrite_js(
			input,
			module,
			meta.base.href,
			"PERCS_PLEASE_FILL_THIS_IN.js",
			$scramjet
		);
	} else {
		out = rewrite_js_from_arraybuffer(
			new Uint8Array(input),
			module,
			meta.base.href,
			"PERCS_PLEASE_FILL_THIS_IN.js",
			$scramjet
		);
	}
	const { js, errors, duration } = out;

	// TODO: maybe make this a scram flag?
	if (true) {
		for (const error of errors) {
			console.error("oxc parse error", error);
		}
	}

	// TODO: maybe make this a scram flag?
	if (true) {
		let timespan: string;
		if (duration < 1n) {
			timespan = "BLAZINGLY FAST";
		} else if (duration < 500n) {
			timespan = "decent speed";
		} else {
			timespan = "really slow";
		}
		console.log(`oxc rewrite was ${timespan} (${duration}ms)`);
	}

	return typeof input === "string" ? decoder.decode(js) : js;
}

export function rewriteJsx(
	js: string | ArrayBuffer,
	module: boolean,
	meta: URLMeta
) {
	const j = rewriteJsWrapper(js, module, meta);

	const text = typeof j === "string" ? j : new TextDecoder().decode(j);
	if (module) {
		js = `
			let location = $scramjet$wrap(self.location);
			let window = $scramjet$wrap(self.window);
			let globalThis = $scramjet$wrap(self.globalThis);

			${text}
		`;
	} else {
		js = `(function(window, location, globalThis) {
			${text}
		}).call($scramjet$wrap(this), $scramjet$wrap(window), $scramjet$wrap(location), $scramjet$wrap(globalThis))`;
	}
	return js;
}

function rewriteJsInner(
	js: string | Uint8Array,
	url: string | null,
	meta: URLMeta,
	module = false
) {
	let jsr = rewriteJsx(js, false, meta);
	// console.log(js);
	return {
		js: jsr,
		tag: "",
		map: null,
	};
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
