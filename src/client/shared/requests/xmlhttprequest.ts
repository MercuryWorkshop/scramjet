import { encodeUrl, rewriteHeaders } from "../../../shared";

export default function (client, self) {
	client.Proxy("XMLHttpRequest.prototype.open", {
		apply(ctx) {
			if (ctx.args[1]) ctx.args[1] = encodeUrl(ctx.args[1]);
		},
	});

	client.Proxy("XMLHttpRequest.prototype.setRequestHeader", {
		apply(ctx) {
			let headerObject = Object.fromEntries([ctx.args]);
			headerObject = rewriteHeaders(headerObject);

			ctx.args = Object.entries(headerObject)[0];
		},
	});
}
