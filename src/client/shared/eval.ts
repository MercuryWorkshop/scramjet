import { ScramjetClient } from "../client";
import { config, rewriteJs } from "../../shared";

export default function (client: ScramjetClient, self: Self) {
	// used for proxying *direct eval*
	// eval("...") -> eval($scramjet$rewrite("..."))
	Object.defineProperty(self, config.rewritefn, {
		value: function (js: any) {
			if (typeof js !== "string") return js;

			const rewritten = rewriteJs(js, client.meta);

			return rewritten;
		},
		writable: false,
		configurable: false,
	});
}

export function indirectEval(this: ScramjetClient, js: any) {
	// > If the argument of eval() is not a string, eval() returns the argument unchanged
	if (typeof js !== "string") return js;

	const indirection = this.global.eval;

	return indirection(rewriteJs(js, this.meta) as string);
}
