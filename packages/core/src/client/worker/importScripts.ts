import { AkClient } from "@client/index";
import { String } from "@/shared/snapshot";

export default function (client: AkClient) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				const url = String(ctx.args[i]);
				ctx.args[i] = client.rewriteUrl(url);
			}
		},
	});
}
