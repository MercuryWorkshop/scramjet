import { client } from ".";
import { encodeUrl } from "./shared";

client.Proxy(window.history, "pushState", {
	apply(ctx) {
		ctx.args[2] = encodeUrl(ctx.args[2]);
	},
});

client.Proxy(window.history, "replaceState", {
	apply(ctx) {
		ctx.args[2] = encodeUrl(ctx.args[2]);
	},
});
