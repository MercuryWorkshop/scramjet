// ts throws an error if you dont do window.fetch

import { isemulatedsw } from "../..";
import { ScramjetClient } from "../../client";
import { encodeUrl, rewriteHeaders } from "../../shared";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("fetch", {
		apply(ctx) {
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0] = encodeUrl(ctx.args[0].toString());

				if (isemulatedsw) ctx.args[0] += "?from=swruntime";
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
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0] = encodeUrl(ctx.args[0].toString());

				if (isemulatedsw) ctx.args[0] += "?from=swruntime";
			}
		},
	});

	client.Proxy("Response.redirect", {
		apply(ctx) {
			ctx.args[0] = encodeUrl(ctx.args[0]);
		},
	});
}
