import { rewriteUrl } from "../../shared/rewriters/url";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				ctx.args[i] = rewriteUrl(ctx.args[i], client.meta);
			}
		},
	});
}
