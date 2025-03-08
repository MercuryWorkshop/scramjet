import { $scramjet } from "../../scramjet";
import { rewriteJs } from "./js";
import { URLMeta } from "./url";

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
			str += `import "${$scramjet.config.files[script]}"\n`;
		} else {
			str += `importScripts("${$scramjet.config.files[script]}");\n`;
		}
	};

	script("wasm");
	script("shared");
	str += `self.$scramjet.config = ${JSON.stringify($scramjet.config)};`;
	script("client");

	let rewritten = rewriteJs(js, url, meta, module);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	str += rewritten;

	return str;
}
