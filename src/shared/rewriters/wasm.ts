// i am a cat. i like to be petted. i like to be fed. i like to be
import { initSync, Rewriter } from "../../../rewriter/wasm/out/wasm.js";
import type { JsRewriterOutput } from "../../../rewriter/wasm/out/wasm.js";

export type { JsRewriterOutput, Rewriter };

import { $scramjet, flagEnabled } from "../../scramjet";
import { URLMeta } from "./url.js";

if (self.WASM)
	self.REAL_WASM = Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0));

// only use in sw
export async function asyncSetWasm() {
	const buf = await fetch($scramjet.config.files.wasm).then((r) =>
		r.arrayBuffer()
	);
	self.REAL_WASM = new Uint8Array(buf);
}

const decoder = new TextDecoder();
let MAGIC = "\0asm".split("").map((x) => x.charCodeAt(0));

function initWasm() {
	if (!(self.REAL_WASM && self.REAL_WASM instanceof Uint8Array))
		throw new Error("rewriter wasm not found (was it fetched correctly?)");

	if (![...self.REAL_WASM.slice(0, 4)].every((x, i) => x === MAGIC[i]))
		throw new Error(
			"rewriter wasm does not have wasm magic (was it fetched correctly?)\nrewriter wasm contents: " +
				decoder.decode(self.REAL_WASM)
		);

	initSync({
		module: new WebAssembly.Module(self.REAL_WASM),
	});
}

export function getRewriter(meta: URLMeta): [Rewriter, () => void] {
	initWasm();
	if (!$scramjet.shared.rewriter) $scramjet.shared.rewriter = [];

	let obj: { rewriter: Rewriter; inUse: boolean };
	let index = $scramjet.shared.rewriter.findIndex((x) => !x.inUse);
	let len = $scramjet.shared.rewriter.length;

	if (index === -1) {
		if (flagEnabled("rewriterLogs", meta.base))
			console.log(`creating new rewriter, ${len} rewriters made already`);

		let rewriter = new Rewriter($scramjet);
		obj = { rewriter, inUse: true };
		$scramjet.shared.rewriter.push(obj);
	} else {
		if (flagEnabled("rewriterLogs", meta.base))
			console.log(
				`using cached rewriter ${index} from list of ${len} rewriters`
			);

		obj = $scramjet.shared.rewriter[index];
	}
	return [obj.rewriter, () => (obj.inUse = false)];
}
