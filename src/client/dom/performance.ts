import { decodeUrl } from "../../shared";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Trap("PerformanceEntry.prototype.name", {
		get(ctx) {
			return decodeUrl(ctx.get());
		},
	});
}
