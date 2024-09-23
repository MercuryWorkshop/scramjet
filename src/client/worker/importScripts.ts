import { encodeUrl } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				ctx.args[i] = encodeUrl(ctx.args[i], client.meta);
			}
		},
	});
}
