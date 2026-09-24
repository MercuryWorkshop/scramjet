import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("console.clear", {
		apply(ctx) {
			// fuck you
			ctx.return(undefined);
		},
	});

	// taken once, before page code can replace it
	// eslint-disable-next-line scramjet-core/no-globals
	const log = console.log;
	client.Trap("console.log", {
		set(_ctx, _v) {
			// is there a legitimate reason to let sites do this?
		},
		get(_ctx) {
			return log;
		},
	});
}
