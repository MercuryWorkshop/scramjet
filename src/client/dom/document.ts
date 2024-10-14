import { rewriteHtml } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	client.Proxy("Document.prototype.write", {
		apply(ctx) {
			if (ctx.args[0])
				ctx.args[0] = rewriteHtml(
					ctx.args[0],
					client.cookieStore,
					client.meta,
					true
				);
		},
	});

	client.Proxy("Document.prototype.writeln", {
		apply(ctx) {
			if (ctx.args[0])
				ctx.args[0] = rewriteHtml(
					ctx.args[0],
					client.cookieStore,
					client.meta,
					false
				);
		},
	});
}
