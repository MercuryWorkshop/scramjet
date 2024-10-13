import { ScramjetClient } from "../client";

export default function (client: ScramjetClient) {
	client.Proxy("console.clear", {
		apply(ctx) {
			// fuck you
			ctx.return(undefined);
		},
	});

	const log = console.log;
	client.Trap("console.log", {
		set(ctx, v) {
			// is there a legitimate reason to let sites do this?
		},
		get(ctx) {
			return log;
		},
	});
}
