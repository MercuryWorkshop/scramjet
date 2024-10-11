import { ScramjetClient } from "../client";
import { rewriteCss } from "../../shared";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("FontFace", {
		construct(ctx) {
			ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});
}
