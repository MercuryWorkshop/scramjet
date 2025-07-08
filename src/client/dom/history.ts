import { ScramjetClient } from "../client";
import { rewriteUrl } from "../../shared";
import { UrlChangeEvent } from "../events";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("History.prototype.pushState", {
		apply(ctx) {
			if (ctx.args[2] || ctx.args[2] === "")
				ctx.args[2] = rewriteUrl(ctx.args[2], client.meta);
			ctx.call();

			const ev = new UrlChangeEvent(client.url.href);
			if (!client.isSubframe) client.frame?.dispatchEvent(ev);
		},
	});

	client.Proxy("History.prototype.replaceState", {
		apply(ctx) {
			if (ctx.args[2] || ctx.args[2] === "")
				ctx.args[2] = rewriteUrl(ctx.args[2], client.meta);
			ctx.call();

			const ev = new UrlChangeEvent(client.url.href);
			if (!client.isSubframe) client.frame?.dispatchEvent(ev);
		},
	});
}
