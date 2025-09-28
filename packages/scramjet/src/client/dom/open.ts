import { ScramjetClient } from "@client/index";
import { SCRAMJETCLIENT } from "@/symbols";
import { rewriteUrl } from "@rewriters/url";

export default function (client: ScramjetClient) {
	client.Proxy("window.open", {
		apply(ctx) {
			if (ctx.args[0]) ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);

			if (ctx.args[1] === "_top" || ctx.args[1] === "_unfencedTop")
				ctx.args[1] = client.meta.topFrameName;
			if (ctx.args[1] === "_parent") ctx.args[1] = client.meta.parentFrameName;

			const realwin = ctx.call();

			if (!realwin) return ctx.return(realwin);

			if (SCRAMJETCLIENT in realwin) {
				return ctx.return(realwin[SCRAMJETCLIENT].global);
			} else {
				const newclient = new ScramjetClient(realwin);
				// hook the opened window
				newclient.hook();

				return ctx.return(newclient.global);
			}
		},
	});

	client.Trap("window.frameElement", {
		get(ctx) {
			const f = ctx.get() as HTMLIFrameElement | null;
			if (!f) return f;

			const win = f.ownerDocument.defaultView;
			if (win[SCRAMJETCLIENT]) {
				// then this is a subframe in a scramjet context, and it's safe to pass back the real iframe
				return f;
			} else {
				// no, the top frame is outside the sandbox
				return null;
			}
		},
	});
}
