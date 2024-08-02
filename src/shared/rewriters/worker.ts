import { rewriteJs } from "./js";

const clientscripts = ["wasm", "codecs", "shared", "client"];
export function rewriteWorkers(js: string | ArrayBuffer, origin?: URL) {
	const dest = origin.searchParams.get("dest");
	const type = origin.searchParams.get("type");

	origin.search = "";

	let str = "";

	str += `self.$scramjet = {}; self.$scramjet.config = ${JSON.stringify(self.$scramjet.config)};\n`;
	str += "";
	if (type === "module") {
		for (const script of clientscripts) {
			console.log("Import", script, self.$scramjet);
			str += `import "${self.$scramjet.config[script]}"\n`;
		}
	} else {
		for (const script of clientscripts) {
			str += `importScripts("${self.$scramjet.config[script]}");\n`;
		}
	}

	let rewritten = rewriteJs(js, origin);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	str +=
		"self.$scramjet.codec = self.$scramjet.codecs[self.$scramjet.config.codec];\n";
	str += rewritten;

	dbg.log("Rewrite", type, dest, str);

	return str;
}
