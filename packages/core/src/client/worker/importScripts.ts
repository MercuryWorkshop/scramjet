import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				ctx.args[i] = client.rewriteUrl(ctx.args[i]);
			}
		},
	});
}
