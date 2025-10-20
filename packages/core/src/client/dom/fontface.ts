import { rewriteCss } from "@rewriters/css";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("FontFace", {
		construct(ctx) {
			ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});
}
