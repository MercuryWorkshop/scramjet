import { iswindow } from "..";
import { BareMuxConnection } from "../../shared";
import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";

const sharedworkerpostmessage = MessagePort.prototype.postMessage;
let workerpostmessage;
if (self.Worker) {
	workerpostmessage = Worker.prototype.postMessage;
}
export default function (client: ScramjetClient, self: typeof globalThis) {
	const handler = {
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
				if (worker instanceof Worker) {
					workerpostmessage.call(
						worker,
						{
							$scramjet$type: "baremuxinit",
							port,
						},
						[port]
					);
				}
				if (worker instanceof SharedWorker) {
					sharedworkerpostmessage.call(
						worker.port,
						{
							$scramjet$type: "baremuxinit",
							port,
						},
						[port]
					);
				}
			})();
		},
	};

	if (self.Worker) {
		client.Proxy("Worker", handler);
	}

	if (iswindow) {
		client.Proxy("Worklet.prototype.addModule", {
			apply(ctx) {
				if (ctx.args[0]) ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
			},
		});

		// sharedworkers can only be constructed from window
		client.Proxy("SharedWorker", handler);
	}
}
