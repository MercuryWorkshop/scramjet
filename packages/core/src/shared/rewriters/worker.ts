import { flagEnabled, ScramjetContext } from "@/shared";
import { rewriteJs } from "@rewriters/js";
import { URLMeta } from "@rewriters/url";

function hasSourceUrlOrSourceMapHint(code: string) {
	// Detect existing devtools hints to avoid duplicating them.
	// Matches both //# and //@ forms used in the wild.
	return /\/\/[@#]\s*source(?:Mapping)?URL\s*=/.test(code);
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
	let str = context.interface.getWorkerInjectScripts(meta, type, script);
	let rewritten = rewriteJs(js, url, context, meta, module);
	if (rewritten instanceof Uint8Array) {
		rewritten = new TextDecoder().decode(rewritten);
	}

	if (flagEnabled("encapsulateWorkers", context, meta.origin)) {
		if (!hasSourceUrlOrSourceMapHint(rewritten)) {
			// Helps devtools attribute eval'd worker sources.
			if (!rewritten.endsWith("\n")) rewritten += "\n";
			rewritten += `//# sourceURL=${url}\n`;
		}
		str += script(`data:text/javascript;base64,${btoa(rewritten)}`);
	} else {
		str += rewritten;
	}

	return str;
}
