import { AkClient } from "@client/index";
import { String } from "@/shared/snapshot";

export default function (client: AkClient) {
	client.Proxy("EventSource", {
		construct(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Trap("EventSource.prototype.url", {
		get(ctx) {
			return client.unrewriteUrl(ctx.get());
		},
	});
}
