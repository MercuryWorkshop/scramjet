import { ScramjetClient } from "@client/index";
import { Tap } from "@/Tap";
import { String, _URL } from "@/shared/snapshot";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy(
		["History.prototype.pushState", "History.prototype.replaceState"],
		{
			apply(ctx) {
				const url = String(ctx.args[2]);

				if (_URL.canParse(url)) {
					const parsedUrl = new _URL(url);
					if (parsedUrl.origin !== client.url.origin) {
						// TODO: we want to emulate the proper security error here. right now this will leak the origin in the error message
						return;
					}
				}

				if (url || url === "")
					ctx.args[2] = client.rewriteUrl(url);
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
