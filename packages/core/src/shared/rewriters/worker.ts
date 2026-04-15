import { flagEnabled, ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { URLMeta } from "@rewriters/url";
import { TextDecoder_decode } from "@/shared/snapshot";
import { base64Encode } from "@/shared/util";

export function rewriteWorkers(
	context: ScramjetContext,
	js: string | Uint8Array,
	type: "module" | "regular",
	url: string,
	meta: URLMeta
) {
	const module = type === "module";
	const script = (script: string) => {
		if (module) {
			return `import "${script}"\n`;
		}
		return `importScripts("${script}");\n`;
	};
	const b64 = (script: string) =>
		`data:text/javascript;charset=utf-8;base64,${base64Encode(script)}`;
	let str = context.interface.getWorkerInjectScripts(meta, type, script);

	let rewritten = rewriteJs(js, url, context, meta, module);
	if (typeof rewritten !== "string") {
		rewritten = TextDecoder_decode(rewritten);
	}

	if (flagEnabled("encapsulateWorkers", context, meta.origin)) {
		// TODO: check if there's already a sourceURL/sourcemap before appending another?
		rewritten += `//# sourceURL=${url}`;
		str += script(b64(rewritten));
	} else {
		str += rewritten;
	}
	return str;
}
