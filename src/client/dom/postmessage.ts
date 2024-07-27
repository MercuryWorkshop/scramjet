import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	client.Proxy("window.postMessage", {
		apply(ctx) {
			if (typeof ctx.args[1] === "string") ctx.args[1] = "*";
		},
	});
}
