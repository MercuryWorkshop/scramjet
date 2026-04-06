import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("EventSource", {
		construct(ctx) {
			ctx.args[0] = client.rewriteUrl(ctx.args[0]);
		},
	});

	client.Trap("EventSource.prototype.url", {
		get(ctx) {
			return client.unrewriteUrl(ctx.get());
		},
	});
}
