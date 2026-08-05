import { rewriteJs } from "@rewriters/js";
import { AkClient } from "@client/index";
import { Object_defineProperty, String } from "@/shared/snapshot";

export default function (client: AkClient, self: Self) {
	// used for proxying *direct eval*
	// eval("...") -> eval($ak$rewrite("..."))
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

export function createIndirectEval(client: AkClient) {
	const indirection = client.global.eval;
	const proxy = new Proxy(client.global.eval, {
		apply(_target, _thisArg, args) {
			let js = args[0];
			// > If the argument of eval() is not a string, eval() returns the argument unchanged
			// the one exception is TrustedScript, which can just be stringified and rewritten
			if (client.box.instanceof(js, "TrustedScript")) js = String(js);
			if (typeof js !== "string") return js;

			return indirection(
				rewriteJs(
					js,
					"(indirect eval proxy)",
					client.context,
					client.meta
				) as string
			);
		},
	});
	client.box.unproxy.set(proxy, client.global.eval);

	return proxy;
}
