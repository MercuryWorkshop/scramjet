import { encodeUrl } from "../../shared/rewriters/url";

export default function (client, self) {
	client.Proxy("importScripts", {
		apply(ctx) {
			for (const i in ctx.args) {
				ctx.args[i] = encodeUrl(ctx.args[i]);
			}
		},
	});
}
