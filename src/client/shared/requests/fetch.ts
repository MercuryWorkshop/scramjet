// ts throws an error if you dont do window.fetch

import { isemulatedsw } from "../..";
import { unrewriteUrl } from "../../../shared";
import { ScramjetClient } from "../../client";
import { rewriteUrl } from "../../../shared";

export default function (client: ScramjetClient, _self: typeof globalThis) {
	client.Proxy("fetch", {
		apply(ctx) {
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);

				if (isemulatedsw) ctx.args[0] += "?from=swruntime";
			}
		},
	});

	client.Proxy("Request", {
		construct(ctx) {
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);

				if (isemulatedsw) ctx.args[0] += "?from=swruntime";
			}
		},
	});

	client.Trap("Response.prototype.url", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string);
		},
	});

	client.Trap("Request.prototype.url", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string);
		},
	});
}
