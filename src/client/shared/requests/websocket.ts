import { ScramjetClient } from "../../client";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("WebSocket", {
		construct(ctx) {
			ctx.return(
				client.bare.createWebSocket(
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
