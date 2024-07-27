// ts throws an error if you dont do window.fetch

import { encodeUrl, rewriteHeaders } from "../../shared";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("fetch", {
		apply(ctx) {
			ctx.args[0] = encodeUrl(ctx.args[0]);
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
