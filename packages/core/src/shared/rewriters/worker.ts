import { flagEnabled, ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { URLMeta } from "@rewriters/url";

function base64Encode(text: string) {
	return btoa(
		new TextEncoder()
			.encode(text)
			.reduce(
				(data, byte) => (data.push(String.fromCharCode(byte)), data),
				[] as any
			)
			.join("")
	);
}

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
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
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
