// ts throws an error if you dont do window.fetch

import { client } from "..";
import { encodeUrl, rewriteHeaders } from "../shared";

client.Proxy(window, "fetch", {
	apply(ctx) {
		ctx.args[0] = encodeUrl(ctx.args[0]);
	},
});

client.Proxy(window, "Headers", {
	construct(ctx) {
		ctx.args[0] = rewriteHeaders(ctx.args[0]);
	},
});

client.Proxy(window, "Request", {
	construct(ctx) {
		if (typeof ctx.args[0] === "string") ctx.args[0] = encodeUrl(ctx.args[0]);
	},
});

client.Proxy(Response, "redirect", {
	apply(ctx) {
		ctx.args[0] = encodeUrl(ctx.args[0]);
	},
});
