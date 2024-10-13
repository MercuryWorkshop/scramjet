import { rewriteUrl } from "../../../shared";
import { ScramjetClient } from "../../client";

export default function (client: ScramjetClient, _self) {
	client.Proxy("navigator.sendBeacon", {
		apply(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});
}
