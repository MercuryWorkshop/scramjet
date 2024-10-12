import { unrewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Trap("PerformanceEntry.prototype.name", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string);
		},
	});
}
