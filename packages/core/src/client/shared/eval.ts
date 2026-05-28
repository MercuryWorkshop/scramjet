import { rewriteJs } from "@rewriters/js";
import { ScramjetClient } from "@client/index";
import { Object_defineProperty, String } from "@/shared/snapshot";

export default function (client: ScramjetClient, self: Self) {
	// used for proxying *direct eval*
	// eval("...") -> eval($scramjet$rewrite("..."))
	Object_defineProperty(self, client.config.globals.rewritefn, {
		value: function (js: any) {
			// if eval is called on anything other than a string, we should just return it unchanged
			// the one exception is TrustedScript, which can just be stringified and rewritten
			if (client.box.instanceof(js, "TrustedScript")) js = String(js);
			if (typeof js !== "string") return js;

			const rewritten = rewriteJs(
				js,
				"(direct eval proxy)",
				client.context,
				client.meta
			);

			return rewritten;
		},
		writable: false,
		configurable: false,
	});
}

export function indirectEval(this: ScramjetClient, strict: boolean, js: any) {
	// > If the argument of eval() is not a string, eval() returns the argument unchanged
	// the one exception is TrustedScript, which can just be stringified and rewritten
	if (this.box.instanceof(js, "TrustedScript")) js = String(js);
	if (typeof js !== "string") return js;

	const indirection: typeof eval = this.global.eval;

	return indirection(
		rewriteJs(js, "(indirect eval proxy)", this.context, this.meta) as string
	);
}
