import { rewriteJs } from "./js";

const clientscripts = ["wasm", "shared", "client"];
export function rewriteWorkers(
	js: string | ArrayBuffer,
	type: string,
	origin?: URL
) {
	origin.search = "";

	let str = "";

	str += `self.$scramjet = {}; self.$scramjet.config = ${JSON.stringify(self.$scramjet.config)};
	`;
	str += "";
	if (type === "module") {
		str += `import "${self.$scramjet.config["codecs"]}"
self.$scramjet.codec = self.$scramjet.codecs[self.$scramjet.config.codec];
`;
		for (const script of clientscripts) {
			str += `import "${self.$scramjet.config[script]}"\n`;
		}
	} else {
		str += `importScripts("${self.$scramjet.config["codecs"]}");
self.$scramjet.codec = self.$scramjet.codecs[self.$scramjet.config.codec];
`;
		for (const script of clientscripts) {
			str += `importScripts("${self.$scramjet.config[script]}");\n`;
		}
	}

	let rewritten = rewriteJs(js, origin);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	str += rewritten;

	dbg.log("Rewrite", type, str);

	return str;
}
