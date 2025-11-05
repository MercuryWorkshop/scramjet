import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("EventSource", {
		construct(ctx) {
			ctx.args[0] = client.rewriteUrl(ctx.args[0]);
		},
	});

	client.Trap("EventSource.prototype.url", {
		get(ctx) {
			client.unrewriteUrl(ctx.get() as string);
		},
	});
}
