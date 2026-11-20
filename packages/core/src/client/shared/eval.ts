import { rewriteJs } from "@rewriters/js";
import { ScramjetClient } from "@client/index";
import { Object_defineProperty } from "@/shared/snapshot";
import { isTrustedScript, trustedEvalString } from "@client/trustedtypes";
import { assertEvalAllowed } from "@client/csp";

export default function (client: ScramjetClient, self: Self) {
	// used for proxying *direct eval*
	// eval("...") -> eval($scramjet$rewrite("..."))
	Object_defineProperty(self, client.config.globals.rewritefn, {
		value: function (js: any) {
			// if eval is called on anything other than a string, we should just return it unchanged
			// the one exception is TrustedScript, which can just be stringified and rewritten
			if (typeof js !== "string" && !isTrustedScript(client, js)) return js;
			js = trustedEvalString(client, js);
			assertEvalAllowed(client);

			const rewritten = rewriteJs(
				js,
				"(direct eval proxy)",
				client.context,
				client.meta,
				false,
				client
			);

			return rewritten;
		},
		writable: false,
		configurable: false,
	});
}

export function createIndirectEval(client: ScramjetClient) {
	const indirection = client.global.eval;
	const proxy = new Proxy(client.global.eval, {
		apply(_target, _thisArg, args) {
			let js = args[0];
			// > If the argument of eval() is not a string, eval() returns the argument unchanged
			// the one exception is TrustedScript, which can just be stringified and rewritten
			if (typeof js !== "string" && !isTrustedScript(client, js)) return js;
			js = trustedEvalString(client, js);
			assertEvalAllowed(client);

			return indirection(
				rewriteJs(
					js,
					"(indirect eval proxy)",
					client.context,
					client.meta,
					false,
					client
				) as string
			);
		},
	});
	client.box.unproxy.set(proxy, client.global.eval);

	return proxy;
}
