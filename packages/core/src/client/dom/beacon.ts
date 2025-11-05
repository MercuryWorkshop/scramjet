import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("Navigator.prototype.sendBeacon", {
		apply(ctx) {
			ctx.args[0] = client.rewriteUrl(ctx.args[0]);
		},
	});
}
