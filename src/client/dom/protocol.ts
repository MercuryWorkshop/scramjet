import { rewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, self: Self) {
	client.Proxy("Navigator.prototype.registerProtocolHandler", {
		apply(ctx) {
			ctx.args[1] = rewriteUrl(ctx.args[1], client.meta);
		},
	});
	client.Proxy("Navigator.prototype.unregisterProtocolHandler", {
		apply(ctx) {
			ctx.args[1] = rewriteUrl(ctx.args[1], client.meta);
		},
	});
}
