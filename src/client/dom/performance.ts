import { unrewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, _self: Self) {
	client.Trap("PerformanceEntry.prototype.name", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string);
		},
	});
}
