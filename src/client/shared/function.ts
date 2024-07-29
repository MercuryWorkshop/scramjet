import { ScramjetClient, ProxyCtx } from "../client";
import { rewriteJs } from "../shared";

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
}
