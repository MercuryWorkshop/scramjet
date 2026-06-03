import { flagEnabled, ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { URLMeta } from "@rewriters/url";
import { TextDecoder_decode } from "@/shared/snapshot";
import { base64Encode } from "@/shared/util";

export function rewriteWorkers(
	js: string | Uint8Array,
	url: string,
	context: ScramjetContext,
	meta: URLMeta,
	isModule: boolean
) {
	const script = (script: string) => {
		if (isModule) {
			return `import "${script}"\n`;
		}
		return `importScripts("${script}");\n`;
	};
	const b64 = (script: string) =>
		`data:text/javascript;charset=utf-8;base64,${base64Encode(script)}`;
	let str = context.interface.getWorkerInjectScripts(meta, isModule, script);

	let rewritten = rewriteJs(js, url, context, meta, isModule);
	if (typeof rewritten !== "string") {
		rewritten = TextDecoder_decode(rewritten);
	}

	if (flagEnabled("encapsulateWorkers", context, meta.origin)) {
		// TODO: check if there's already a sourceURL/sourcemap before appending another?
		rewritten += `//# sourceURL=${url}`;
		str += script(b64(rewritten as string));
	} else {
		str += rewritten;
	}
	return str;
}
