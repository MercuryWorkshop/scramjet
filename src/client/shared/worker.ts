import { BareMuxConnection } from "../../shared";
import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: typeof globalThis) {
	client.Proxy("Worker", {
		construct({ args, call }) {
			args[0] = rewriteUrl(args[0], client.meta) + "?dest=worker";

			if (args[1] && args[1].type === "module") {
				args[0] += "&type=module";
			}

			const worker = call();
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
		construct({ args, call }) {
			args[0] = rewriteUrl(args[0], client.meta) + "?dest=sharedworker";

			if (args[1] && typeof args[1] === "string")
				args[1] = `${client.url.origin}@${args[1]}`;

			if (args[1] && typeof args[1] === "object") {
				if (args[1].type === "module") {
					args[0] += "&type=module";
				}

				if (args[1].name) {
					args[1].name = `${client.url.origin}@${args[1].name}`;
				}
			}

			const worker = call();
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
