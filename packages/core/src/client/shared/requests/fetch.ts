import { rewriteUrl, unrewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";
import { unrewriteLinkHeader } from "./xmlhttprequest";

export default function (client: ScramjetClient) {
	client.Proxy("fetch", {
		apply(ctx) {
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
			}
		},
	});

	client.Proxy("Request", {
		construct(ctx) {
			if (typeof ctx.args[0] === "string" || ctx.args[0] instanceof URL) {
				ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
			}
		},
	});

	client.Trap("Response.prototype.url", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string, client.meta);
		},
	});

	client.Trap("Request.prototype.url", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string, client.meta);
		},
	});

	// TODO: this needs to be only for response objects created from a fetch
	client.Trap("Response.prototype.headers", {
		get(ctx) {
			const headers = ctx.get() as Headers;
			const newHeaders = new Headers();

			for (const [key, value] of headers.entries()) {
				if (key.toLowerCase() === "link") {
					newHeaders.append(key, unrewriteLinkHeader(value, client.meta));
				} else {
					newHeaders.append(key, value);
				}
			}

			return newHeaders;
		},
	});
}
