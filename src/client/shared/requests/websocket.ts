import { ScramjetClient } from "../../client";
import { BareClient } from "../../shared";

export default function (client: ScramjetClient, self: typeof globalThis) {
	const bare = new BareClient();

	client.Proxy("WebSocket", {
		construct(ctx) {
			ctx.return(
				bare.createWebSocket(
					ctx.args[0],
					ctx.args[1],
					ctx.fn as typeof WebSocket,
					{
						"User-Agent": self.navigator.userAgent,
						Origin: client.url.origin,
					},
					ArrayBuffer.prototype
				)
			);
		},
	});
}
