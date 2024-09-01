import { decodeUrl, encodeUrl, rewriteHeaders } from "../../../shared";
import { ScramjetClient } from "../../client";

export default function (client: ScramjetClient, self: Self) {
	client.Proxy("XMLHttpRequest.prototype.open", {
		apply(ctx) {
			if (ctx.args[1]) ctx.args[1] = encodeUrl(ctx.args[1], client.meta);
		},
	});

	client.Proxy("XMLHttpRequest.prototype.setRequestHeader", {
		apply(ctx) {
			let headerObject = Object.fromEntries([ctx.args]);
			headerObject = rewriteHeaders(headerObject, client.meta);

			ctx.args = Object.entries(headerObject)[0];
		},
	});

	client.Trap("XMLHttpRequest.prototype.responseURL", {
		get(ctx) {
			return decodeUrl(ctx.get() as string);
		},
	});
}
