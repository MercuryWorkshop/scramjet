import { ScramjetClient } from "@client/index";
import { unrewriteLinkHeader } from "./xmlhttprequest";
import { String } from "@/shared/snapshot";

export default function (client: ScramjetClient) {
	client.Proxy("fetch", {
		apply(ctx) {
			if (client.box.instanceof(ctx.args[0], "Request")) return;
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("Request", {
		construct(ctx) {
			if (client.box.instanceof(ctx.args[0], "Request")) return;
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Trap(["Request.prototype.url", "Response.prototype.url"], {
		get(ctx) {
			return client.unrewriteUrl(ctx.get() as string);
		},
	});

	// TODO: this needs to be only for response objects created from a fetch
	client.Trap("Response.prototype.headers", {
		get(ctx) {
			const headers = ctx.get() as Headers;
			const newHeaders = new Headers();

			for (const [key, value] of headers.entries()) {
				if (key.toLowerCase() === "link") {
					newHeaders.append(key, unrewriteLinkHeader(value, client.context));
				} else {
					newHeaders.append(key, value);
				}
			}

			return newHeaders;
		},
	});
}
