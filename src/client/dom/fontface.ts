import { rewriteCss } from "../../shared/rewriters/css";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("FontFace", {
		construct(ctx) {
			ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});
}
