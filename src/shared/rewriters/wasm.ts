// i am a cat. i like to be petted. i like to be fed. i like to be
import { initSync, Rewriter } from "../../../rewriter/wasm/out/wasm.js";
import type { JsRewriterOutput } from "../../../rewriter/wasm/out/wasm.js";
import { codecDecode, codecEncode, config, flagEnabled, iface } from "@/shared";

export type { JsRewriterOutput, Rewriter };

import { rewriteUrl, URLMeta } from "@rewriters/url";
import { htmlRules } from "@/shared/htmlRules";
import { rewriteCss } from "@rewriters/css";
import { rewriteJs } from "@rewriters/js";
import { CookieJar } from "@/shared/cookie";

let wasm_u8: Uint8Array;
export function setWasm(u8: Uint8Array | ArrayBuffer) {
	wasm_u8 = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
}

export const textDecoder = new TextDecoder();
let MAGIC = "\0asm".split("").map((x) => x.charCodeAt(0));

function initWasm() {
	if (!(wasm_u8 instanceof Uint8Array))
		throw new Error("rewriter wasm not found (was setWasm called?)");

	if (![...wasm_u8.slice(0, 4)].every((x, i) => x === MAGIC[i]))
		throw new Error(
			"rewriter wasm does not have wasm magic (was it fetched correctly?)\nrewriter wasm contents: " +
				textDecoder.decode(wasm_u8)
		);

	initSync({
		module: new WebAssembly.Module(wasm_u8 as unknown as BufferSource),
	});
}

let rewriters = [];
export function getRewriter(meta: URLMeta): [Rewriter, () => void] {
	initWasm();

	let obj: { rewriter: Rewriter; inUse: boolean };
	let index = rewriters.findIndex((x) => !x.inUse);
	let len = rewriters.length;

	if (index === -1) {
		if (flagEnabled("rewriterLogs", meta.base))
			console.log(`creating new rewriter, ${len} rewriters made already`);

		let rewriter = new Rewriter({
			config,
			shared: {
				rewrite: {
					htmlRules,
					rewriteUrl,
					rewriteCss,
					rewriteJs,
				},
			},
			flagEnabled,
			codec: {
				encode: codecEncode,
				decode: codecDecode,
			},
		});
		obj = { rewriter, inUse: false };
		rewriters.push(obj);
	} else {
		if (flagEnabled("rewriterLogs", meta.base))
			console.log(
				`using cached rewriter ${index} from list of ${len} rewriters`
			);

		obj = rewriters[index];
	}
	obj.inUse = true;

	return [obj.rewriter, () => (obj.inUse = false)];
}
