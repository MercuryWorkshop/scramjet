import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof globalThis) {
	// do we need this?
	client.Proxy(
		[
			"Function.prototype.call",
			"Function.prototype.bind",
			"Function.prototype.apply",
		],
		{
			apply(ctx) {
				if (ctx.args[0] === client.windowProxy) ctx.args[0] = self;
				if (ctx.args[0] === client.documentProxy) ctx.args[0] = self.document;
			},
		}
	);
}
