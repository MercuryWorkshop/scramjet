import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				ctx.args[i] = rewriteUrl(ctx.args[i], client.meta);
			}
		},
	});
}
