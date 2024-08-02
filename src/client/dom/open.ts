import { encodeUrl } from "../../shared/rewriters/url";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient) {
	client.Proxy("window.open", {
		apply(ctx) {
			if (ctx.args[0]) ctx.args[0] = encodeUrl(ctx.args[0]);

			if (["_parent", "_top", "_unfencedTop"].includes(ctx.args[1]))
				ctx.args[1] = "_self";

			const realwin = ctx.fn.apply(ctx.this, ctx.args);

			if (ScramjetClient.SCRAMJET in realwin.self) {
				return ctx.return(realwin.self[ScramjetClient.SCRAMJET].windowProxy);
			} else {
				const newclient = new ScramjetClient(realwin.self);
				// hook the opened window
				newclient.hook();

				return ctx.return(newclient.windowProxy);
			}
		},
	});

	// opener will refer to the real window if it was opened by window.open
	client.Trap("opener", {
		get(ctx) {
			const realwin = ctx.get() as Window;

			if (realwin && ScramjetClient.SCRAMJET in realwin.self) {
				return realwin.self[ScramjetClient.SCRAMJET].windowProxy;
			} else {
				// the opener has to have been already hooked, so if we reach here then it's a real window
				return undefined;
			}
		},
	});
}
