// ts throws an error if you dont do window.fetch

import { ScramjetClient } from "../../client";
import { encodeUrl, rewriteHeaders } from "../../shared";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("fetch", {
		apply(ctx) {
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0].toString();
				ctx.args[0] = encodeUrl(ctx.args[0].toString());
			} else if (ctx.args[0] instanceof Request && ctx.args[0].url) {
				Object.defineProperty(ctx.args[0], "url", {
					value: encodeUrl(ctx.args[0].url)
				});
			}
		},
	});

	client.Proxy("Headers", {
		construct(ctx) {
			ctx.args[0] = rewriteHeaders(ctx.args[0]);
		},
	});

	client.Proxy("Request", {
		construct(ctx) {
			if (typeof ctx.args[0] === "string") ctx.args[0] = encodeUrl(ctx.args[0]);
		},
	});

	client.Proxy("Response.redirect", {
		apply(ctx) {
			ctx.args[0] = encodeUrl(ctx.args[0]);
		},
	});
}
