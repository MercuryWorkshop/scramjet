import { ScramjetClient, ProxyCtx } from "../client";
import { config, rewriteJs } from "../shared";

function rewriteFunction(ctx: ProxyCtx) {
	const stringifiedFunction = ctx.fn(...ctx.args).toString();

	ctx.return(ctx.fn(`return ${rewriteJs(stringifiedFunction)}`)());
}

export default function (client: ScramjetClient, self: Self) {
	client.Proxy("Function", {
		apply(ctx) {
			rewriteFunction(ctx);
		},

		construct(ctx) {
			rewriteFunction(ctx);
		},
	});

	Function.prototype.constructor = Function;

	// used for proxying *direct eval*
	// eval("...") -> eval($scramjet$rewrite("..."))
	Object.defineProperty(self, config.rewritefn, {
		value: function (js: any) {
			if (typeof js !== "string") return js;

			const rewritten = rewriteJs(js, client.url);

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

	return indirection(rewriteJs(js, this.url) as string);
}
