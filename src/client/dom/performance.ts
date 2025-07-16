import { unrewriteUrl } from "../../shared/rewriters/url";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: Self) {
	client.Trap("PerformanceEntry.prototype.name", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string);
		},
	});
}
