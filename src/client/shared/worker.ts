import { iswindow } from "..";
import { BareMuxConnection } from "../../shared";
import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof globalThis) {
	if (self.Worker) {
		client.Proxy("Worker", {
			construct({ args, call }) {
				if (args[0] instanceof URL) args[0] = args[0].href;

				args[0] = rewriteUrl(args[0], client.meta) + "?dest=worker";

				if (args[1] && args[1].type === "module") {
					args[0] += "&type=module";
				}

				const worker = call();
				const conn = new BareMuxConnection();

				(async () => {
					const port = await conn.getInnerPort();
					client.natives["Worker.prototype.postMessage"].call(
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
	}

	if (iswindow) {
		client.Proxy("Worklet.prototype.addModule", {
			apply(ctx) {
				if (ctx.args[0]) ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
			},
		});

		// sharedworkers can only be constructed from window
		client.Proxy("SharedWorker", {
			construct({ args, call }) {
				if (args[0] instanceof URL) args[0] = args[0].href;

				args[0] = rewriteUrl(args[0], client.meta) + "?dest=worker";

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
					client.natives["MessagePort.prototype.postMessage"].call(
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
	}
}
