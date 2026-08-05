import { AkClient } from "@client/index";

export default function (client: AkClient) {
	client.Proxy("console.clear", {
		apply(ctx) {
			// fuck you
			ctx.return(undefined);
		},
	});

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
