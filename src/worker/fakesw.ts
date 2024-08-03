import { type MessageW2R, type MessageR2W } from "../client/swruntime";

export class FakeServiceWorker {
	syncToken = 0;
	promises: Record<number, (val?: MessageR2W) => void> = {};

	constructor(
		public handle: MessagePort,
		public origin: string
	) {
		this.handle.start();

		this.handle.addEventListener("message", (event) => {
			if ("scramjet$type" in event.data) {
				this.handleMessage(event.data);
			}
		});
	}

	handleMessage(data: MessageR2W) {
		const cb = this.promises[data.scramjet$token];
		if (cb) {
			cb(data);
			delete this.promises[data.scramjet$token];
		}
	}

	async fetch(request: Request): Promise<Response> {
		const token = this.syncToken++;

		const message: MessageW2R = {
			scramjet$type: "fetch",
			scramjet$token: token,
			scramjet$request: {
				url: request.url,
				body: request.body,
				headers: Array.from(request.headers.entries()),
				method: request.method,
				mode: request.mode,
				destinitation: request.destination,
			},
		};

		this.handle.postMessage(message);

		const { scramjet$response: r } = (await new Promise((resolve) => {
			this.promises[token] = resolve;
		})) as MessageR2W;

		return new Response(r.body, {
			headers: r.headers,
			status: r.status,
			statusText: r.statusText,
		});
	}
}
