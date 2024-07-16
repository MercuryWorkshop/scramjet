import { rewriteJs } from "./js";
export function rewriteWorkers(js: string, origin?: URL) {
	let str = new String().toString();

	["codecs", "config", "shared", "client"].forEach((script) => {
		str += `import "${self.$scramjet.config[script]}"\n`;
	});
	str += rewriteJs(js, origin);

	return str;
}
