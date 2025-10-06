import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { rewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, _self: typeof globalThis) {
	client.Proxy("Worker", {
		construct(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta) + "?dest=worker";

			if (ctx.args[1] && ctx.args[1].type === "module") {
				ctx.args[0] += "&type=module";
			}

			const worker = ctx.call();
			const conn = new BareMuxConnection();

			(async () => {
				const port = await conn.getInnerPort();
				client.natives.call(
					"Worker.prototype.postMessage",
					worker,
					{
						$scramjet$type: "baremuxinit",
						port,
					},
					[port]
				);
			})();
		},
	});

	// sharedworkers can only be constructed from window
	client.Proxy("SharedWorker", {
		construct(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta) + "?dest=sharedworker";

			if (ctx.args[1] && typeof ctx.args[1] === "string")
				ctx.args[1] = `${client.url.origin}@${ctx.args[1]}`;

			if (ctx.args[1] && typeof ctx.args[1] === "object") {
				if (ctx.args[1].type === "module") {
					ctx.args[0] += "&type=module";
				}

				if (ctx.args[1].name) {
					ctx.args[1].name = `${client.url.origin}@${ctx.args[1].name}`;
				}
			}

			const worker = ctx.call();
			const conn = new BareMuxConnection();

			(async () => {
				const port = await conn.getInnerPort();
				client.natives.call(
					"MessagePort.prototype.postMessage",
					worker.port,
					{
						$scramjet$type: "baremuxinit",
						port,
					},
					[port]
				);
			})();
		},
	});

	client.Proxy("Worklet.prototype.addModule", {
		apply(ctx) {
			if (ctx.args[0])
				ctx.args[0] = rewriteUrl(ctx.args[0], client.meta) + "?dest=worklet";
		},
	});
}
