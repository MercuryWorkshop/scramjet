import { encodeUrl } from "../shared";

export default function (client, self) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				ctx.args[i] = encodeUrl(ctx.args[i]);
			}
		},
	});
}
