import { config } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { URLMeta } from "@rewriters/url";

export function rewriteWorkers(
	js: string | Uint8Array,
	type: string,
	url: string,
	meta: URLMeta
) {
	let str = "";
	const module = type === "module";
	const script = (script) => {
		if (module) {
			str += `import "${config.files[script]}"\n`;
		} else {
			str += `importScripts("${config.files[script]}");\n`;
		}
	};

	script("wasm");
	script("all");
	str += `$scramjetLoadClient().loadAndHook(${JSON.stringify(config)});`;

	let rewritten = rewriteJs(js, url, meta, module);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	str += rewritten;

	return str;
}
