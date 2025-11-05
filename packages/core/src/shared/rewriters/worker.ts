import { config, ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { URLMeta } from "@rewriters/url";

export function rewriteWorkers(
	context: ScramjetContext,
	js: string | Uint8Array,
	type: string,
	url: string,
	meta: URLMeta
) {
	const module = type === "module";
	let str = context.interface.getWorkerInjectScripts(meta, js, type, url);
	let rewritten = rewriteJs(js, url, meta, module);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	str += rewritten;

	return str;
}
