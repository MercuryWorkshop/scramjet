import { ScramjetClient, ProxyCtx, Proxy } from "../client";
import { rewriteJs } from "../../shared";

function rewriteFunction(ctx: ProxyCtx, client: ScramjetClient) {
	const stringifiedFunction = ctx.call().toString();

	const content =
		"return " + rewriteJs(`return ${stringifiedFunction}`, false, client.meta);
	console.log(content);
	ctx.return(ctx.fn(content)());
}

export default function (client: ScramjetClient, self: Self) {
	const handler: Proxy = {
		apply(ctx) {
			rewriteFunction(ctx, client);
		},
		construct(ctx) {
			rewriteFunction(ctx, client);
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
