// i am a cat. i like to be petted. i like to be fed. i like to be
import { initSync, Rewriter } from "../../../rewriter/wasm/out/wasm.js";
import type { JsRewriterOutput } from "../../../rewriter/wasm/out/wasm.js";
import { flagEnabled, ScramjetContext } from "@/shared";

export type { JsRewriterOutput, Rewriter };

import { URLMeta } from "@rewriters/url";
import { Error, TextDecoder_decode } from "@/shared/snapshot";

let wasm_u8: Uint8Array;
export function setWasm(u8: Uint8Array | ArrayBuffer) {
	wasm_u8 = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
}

const MAGIC = "\0asm".split("").map((x) => x.charCodeAt(0));

function initWasm() {
	if (!(wasm_u8 instanceof Uint8Array))
		throw new Error("rewriter wasm not found (was setWasm called?)");

	if (![...wasm_u8.slice(0, 4)].every((x, i) => x === MAGIC[i]))
		throw new Error(
			"rewriter wasm does not have wasm magic (was it fetched correctly?)\nrewriter wasm contents: " +
				TextDecoder_decode(wasm_u8)
		);

	initSync({
		module: new WebAssembly.Module(wasm_u8 as unknown as BufferSource),
	});
}

type RewriterBox = { rewriter: Rewriter; inUse: boolean };
const rewriters: RewriterBox[] = [];
export function getRewriter(
	context: ScramjetContext,
	meta: URLMeta
): [Rewriter, () => void] {
	initWasm();

	let obj: RewriterBox;
	const index = rewriters.findIndex((x) => !x.inUse);
	const len = rewriters.length;

	if (index === -1) {
		if (flagEnabled("rewriterLogs", context, meta.base))
			dbg.log(`creating new rewriter, ${len} rewriters made already`);

		const rewriter = new Rewriter();
		obj = { rewriter, inUse: false };
		rewriters.push(obj);
	} else {
		obj = rewriters[index];
	}
	obj.inUse = true;

	return [obj.rewriter, () => (obj.inUse = false)];
}
