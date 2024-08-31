import { ScramjetClient } from "../client";
import { encodeUrl } from "../../shared";
import { UrlChangeEvent } from "../events";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("history.pushState", {
		apply(ctx) {
			ctx.args[2] = encodeUrl(ctx.args[2]);
			ctx.call();

			const ev = new UrlChangeEvent(client.url.href);
			if (client.frame) client.frame.dispatchEvent(ev);
		},
	});

	client.Proxy("history.replaceState", {
		apply(ctx) {
			ctx.args[2] = encodeUrl(ctx.args[2]);
			ctx.call();

			const ev = new UrlChangeEvent(client.url.href);
			if (client.frame) client.frame.dispatchEvent(ev);
		},
	});
}
