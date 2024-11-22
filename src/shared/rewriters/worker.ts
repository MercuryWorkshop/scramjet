import { $scramjet } from "../../scramjet";
import { rewriteJs } from "./js";
import { URLMeta } from "./url";

export function rewriteWorkers(
	js: string | ArrayBuffer,
	type: string,
	url: string,
	meta: URLMeta
) {
	let str = "";

	const script = (script) => {
		if (type === "module") {
			str += `import "${$scramjet.config.files[script]}"\n`;
		} else {
			str += `importScripts("${$scramjet.config.files[script]}");\n`;
		}
	};

	script("wasm");
	script("shared");
	str += `self.$scramjet.config = ${JSON.stringify($scramjet.config)};`;
	script("client");

	let rewritten = rewriteJs(js, url, meta);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	str += rewritten;

	// dbg.log("Rewrite", type, str);

	return str;
}
