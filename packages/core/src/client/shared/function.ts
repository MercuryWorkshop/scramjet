import { rewriteJs } from "@rewriters/js";
import { ScramjetClient, ProxyCtx, Proxy } from "@client/index";

function rewriteFunction(ctx: ProxyCtx, client: ScramjetClient) {
	const stringifiedFunction = ctx.call().toString();

	const content = rewriteJs(
		`return ${stringifiedFunction}`,
		"(function proxy)",
		client.meta
	);
	ctx.return(ctx.fn(content)());
}

export default function (client: ScramjetClient, _self: Self) {
	const handler: Proxy = {
		apply(ctx: ProxyCtx) {
			rewriteFunction(ctx, client);
		},
		construct(ctx) {
			rewriteFunction(ctx, client);
		},
	};

	client.Proxy("Function", handler);

	const RawFunction = client.natives.call(
		"eval",
		null,
		"(function () {})"
	).constructor;
	const RawAsyncFunction = client.natives.call(
		"eval",
		null,
		"(async function () {})"
	).constructor;
	const RawGeneratorFunction = client.natives.call(
		"eval",
		null,
		"(function* () {})"
	).constructor;
	const RawAsyncGeneratorFunction = client.natives.call(
		"eval",
		null,
		"(async function* () {})"
	).constructor;

	client.RawProxy(RawFunction.prototype, "constructor", handler);
	client.RawProxy(RawAsyncFunction.prototype, "constructor", handler);
	client.RawProxy(RawGeneratorFunction.prototype, "constructor", handler);
	client.RawProxy(RawAsyncGeneratorFunction.prototype, "constructor", handler);
}
