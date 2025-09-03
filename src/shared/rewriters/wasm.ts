// i am a cat. i like to be petted. i like to be fed. i like to be
import { initSync, Rewriter } from "../../../rewriter/wasm/out/wasm.js";
import type { JsRewriterOutput } from "../../../rewriter/wasm/out/wasm.js";
import { codecDecode, codecEncode, config, flagEnabled } from "@/shared";

export type { JsRewriterOutput, Rewriter };

import { rewriteUrl, URLMeta } from "@rewriters/url";
import { htmlRules } from "@/shared/htmlRules";
import { rewriteCss } from "@rewriters/css";
import { rewriteJs } from "@rewriters/js";
import { getInjectScripts } from "@rewriters/html";
import { CookieStore } from "@/shared/cookie";

let wasm_u8: Uint8Array<ArrayBuffer>;

declare const REWRITERWASM: string | undefined;
if (REWRITERWASM)
	wasm_u8 = Uint8Array.from(atob(REWRITERWASM), (c) => c.charCodeAt(0));
else if (self.WASM)
	wasm_u8 = Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0));

// only use in sw
export async function asyncSetWasm() {
	const buf = await fetch(config.files.wasm).then((r) => r.arrayBuffer());
	wasm_u8 = new Uint8Array(buf);
}

export const textDecoder = new TextDecoder();
let MAGIC = "\0asm".split("").map((x) => x.charCodeAt(0));

function initWasm() {
	if (!(wasm_u8 instanceof Uint8Array))
		throw new Error("rewriter wasm not found (was it fetched correctly?)");

	if (![...wasm_u8.slice(0, 4)].every((x, i) => x === MAGIC[i]))
		throw new Error(
			"rewriter wasm does not have wasm magic (was it fetched correctly?)\nrewriter wasm contents: " +
				textDecoder.decode(wasm_u8)
		);

	initSync({
		module: new WebAssembly.Module(wasm_u8),
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
					getHtmlInjectCode(cookieStore: CookieStore, foundHead: boolean) {
						let inject = getInjectScripts(
							cookieStore,
							(src) => `<script src="${src}"></script>`
						).join("");
						return foundHead ? `<head>${inject}</head>` : inject;
					},
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
