import { decodeUrl, encodeUrl } from "../../../shared";
import { ScramjetClient } from "../../client";

export default function (client: ScramjetClient) {
	client.Proxy("EventSource", {
		construct(ctx) {
			ctx.args[0] = encodeUrl(ctx.args[0], client.meta);
		},
	});

	client.Trap("EventSource.prototype.url", {
		get(ctx) {
			decodeUrl(ctx.get() as string);
		},
	});
}
