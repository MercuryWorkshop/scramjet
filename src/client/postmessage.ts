import { client } from ".";

client.Proxy(window, "postMessage", {
	apply(ctx) {
		if (typeof ctx.args[1] === "string") ctx.args[1] = "*";
	},
});
