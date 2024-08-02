import { ScramjetClient, ProxyCtx, Proxy } from "../client";
import { rewriteJs } from "../shared";

function rewriteFunction(ctx: ProxyCtx) {
	const stringifiedFunction = ctx.fn(...ctx.args).toString();

	ctx.return(Function(`return ${rewriteJs(stringifiedFunction)}`)());
}

export default function (client: ScramjetClient, self: Self) {
	const handler: Proxy = {
		apply(ctx) {
			rewriteFunction(ctx);
		},
		construct(ctx) {
			rewriteFunction(ctx);
		},
	};

	client.Proxy("Function", handler);

	// god i love javascript
	client.RawProxy(function () {}.constructor.prototype, "constructor", handler);
	client.RawProxy(
		async function () {}.constructor.prototype,
		"constructor",
		handler
	);
	client.RawProxy(
		function* () {}.constructor.prototype,
		"constructor",
		handler
	);
	client.RawProxy(
		async function* () {}.constructor.prototype,
		"constructor",
		handler
	);
}