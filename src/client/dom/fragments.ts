import { rewriteHtml } from "../../shared/rewriters/html";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("Range.prototype.createContextualFragment", {
		apply(ctx) {
			ctx.args[0] = rewriteHtml(ctx.args[0], client.cookieStore, client.meta);
		},
	});
}
