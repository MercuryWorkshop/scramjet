import { ScramjetClient } from "../client";

export default function (client: ScramjetClient) {
    client.Proxy("IntersectionObserver", {
		construct(ctx) {
			// Set to the real document
			if (ctx.args[1] && ctx.args[1].root) ctx.args[1].root = document;
			ctx.call();
		}
	})
}