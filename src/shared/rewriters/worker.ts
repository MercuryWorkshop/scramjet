import { rewriteJs } from "./js";

const clientscripts = ["codecs", "config", "shared", "client"];
export function rewriteWorkers(js: string | ArrayBuffer, origin?: URL) {
	let dest = origin.searchParams.get("dest");
	let type = origin.searchParams.get("type");

	origin.search = "";

	let str = "";

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
	str += "\n" + rewritten;

	dbg.log("Rewrite", type, dest, str);

	return str;
}
