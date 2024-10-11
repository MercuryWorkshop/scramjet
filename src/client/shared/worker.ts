import { iswindow } from "..";
import { BareMuxConnection } from "../../shared";
import { encodeUrl } from "../../shared/rewriters/url";
import type { MessageC2W } from "../../worker";
import { ScramjetClient } from "../client";

const workerpostmessage = Worker.prototype.postMessage;

export default function (client: ScramjetClient, self: typeof globalThis) {
	const handler = {
		construct({ args, call }) {
			if (args[0] instanceof URL) args[0] = args[0].href;
			if (args[0].startsWith("blob:") || args[0].startsWith("data:")) {
				const data = syncfetch(client, args[0]);
				const id = Math.random().toString(8).slice(5);

				args[0] = "/scramjet/worker?id=" + id;
				if (args[1] && args[1].type === "module") {
					args[0] += "&type=module";
				}

				args[0] += "&origin=" + encodeURIComponent(client.url.origin);

				client.serviceWorker.controller?.postMessage({
					scramjet$type: "dataworker",
					data,
					id,
				} as MessageC2W);
			} else {
				args[0] = encodeUrl(args[0], client.meta) + "?dest=worker";

				if (args[1] && args[1].type === "module") {
					args[0] += "&type=module";
				}
			}

			const worker = call();
			const conn = new BareMuxConnection();

			(async () => {
				const port = await conn.getInnerPort();
				workerpostmessage.call(
					worker,
					{
						$scramjet$type: "baremuxinit",
						port,
					},
					[port]
				);
			})();
		},
	};

	if (self.Worker) {
		client.Proxy("Worker", handler);
	}

	if (iswindow) {
		client.Proxy("Worklet.prototype.addModule", {
			apply(ctx) {
				if (ctx.args[0]) ctx.args[0] = encodeUrl(ctx.args[0], client.meta);
			},
		});

		// sharedworkers can only be constructed from window
		client.Proxy("SharedWorker", handler);
	}
}

function syncfetch(client: ScramjetClient, url: string) {
	const xhr = new XMLHttpRequest();

	const realOpen = client.natives["XMLHttpRequest.prototype.open"].bind(xhr);

	realOpen("GET", url, false);
	xhr.send();

	return xhr.responseText;
}
