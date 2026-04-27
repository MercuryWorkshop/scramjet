import { ScramjetClient } from "@client/index";
import { Tap } from "@/Tap";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy(
		["History.prototype.pushState", "History.prototype.replaceState"],
		{
			apply(ctx) {
				if (ctx.args[2] || ctx.args[2] === "")
					ctx.args[2] = client.rewriteUrl(ctx.args[2]);
				ctx.call();
				Tap.dispatch(
					client.hooks.lifecycle.navigate,
					{
						type: "history",
					},
					{
						url: client.url.href,
					}
				);
			},
		}
	);
}
