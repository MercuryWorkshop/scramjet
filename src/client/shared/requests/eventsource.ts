import { rewriteUrl, unrewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("EventSource", {
		construct(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});

	client.Trap("EventSource.prototype.url", {
		get(ctx) {
			unrewriteUrl(ctx.get() as string);
		},
	});
}
