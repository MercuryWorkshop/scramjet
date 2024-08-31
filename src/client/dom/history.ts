import { ScramjetClient } from "../client";
import { encodeUrl } from "../../shared";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("history.pushState", {
		apply(ctx) {
			ctx.args[2] = encodeUrl(ctx.args[2]);
		},
	});

	client.Proxy("history.replaceState", {
		apply(ctx) {
			ctx.args[2] = encodeUrl(ctx.args[2]);
		},
	});
}
