import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";
import { SCRAMJETCLIENT } from "../../symbols";

export default function (client: ScramjetClient) {
	client.Proxy("window.open", {
		apply(ctx) {
			if (ctx.args[0]) ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);

			if (["_parent", "_top", "_unfencedTop"].includes(ctx.args[1]))
				ctx.args[1] = "_self";

			const realwin = ctx.call();

			if (!realwin) return ctx.return(realwin);

			if (SCRAMJETCLIENT in realwin) {
				return ctx.return(realwin[SCRAMJETCLIENT].globalProxy);
			} else {
				const newclient = new ScramjetClient(realwin);
				// hook the opened window
				newclient.hook();

				return ctx.return(newclient.globalProxy);
			}
		},
	});

	// opener will refer to the real window if it was opened by window.open
	client.Trap("opener", {
		get(ctx) {
			const realwin = ctx.get() as Window;

			if (realwin && SCRAMJETCLIENT in realwin) {
				return realwin[SCRAMJETCLIENT].globalProxy;
			} else {
				// the opener has to have been already hooked, so if we reach here then it's a real window
				return undefined;
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
