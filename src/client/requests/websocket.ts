import { client } from "..";
import { BareClient } from "../shared";
const bare = new BareClient();

client.Proxy(window, "WebSocket", {
	construct(ctx) {
		ctx.return(
			bare.createWebSocket(
				ctx.args[0],
				ctx.args[1],
				ctx.fn as typeof WebSocket,
				{
					"User-Agent": navigator.userAgent,
					Origin: client.url.origin,
				},
				ArrayBuffer.prototype
			)
		);
	},
});
