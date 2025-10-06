import { rewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";
import { UrlChangeEvent } from "@client/events";
import { SCRAMJETCLIENT } from "@/symbols";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy(
		["History.prototype.pushState", "History.prototype.replaceState"],
		{
			apply(ctx) {
				if (ctx.args[2] || ctx.args[2] === "")
					ctx.args[2] = rewriteUrl(ctx.args[2], client.meta);
				ctx.call();
				const {
					constructor: { constructor: Function },
				} = ctx.this;
				const callerGlobalThisProxied: Self = Function("return globalThis")();
				const callerClient = callerGlobalThisProxied[SCRAMJETCLIENT];

				if (callerGlobalThisProxied.name === client.meta.topFrameName) {
					const ev = new UrlChangeEvent(callerClient.url.href);
					client.frame?.dispatchEvent(ev);
				}
			},
		}
	);
}
