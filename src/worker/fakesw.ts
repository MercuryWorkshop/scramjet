import { type MessageW2R, type MessageR2W } from "../client/swruntime";

export class FakeServiceWorker {
	syncToken = 0;
	promises: Record<number, (val?: MessageR2W) => void> = {};
	messageChannel = new MessageChannel();

	constructor(
		public handle: MessagePort,
		public origin: string
	) {
		this.messageChannel.port1.addEventListener("message", (event) => {
			if ("scramjet$type" in event.data) {
				this.handleMessage(event.data);
			}
		});
		this.messageChannel.port1.start();
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
			scramjet$port: this.messageChannel.port2,
			scramjet$request: {
				url: request.url,
				body: request.body,
				headers: Array.from(request.headers.entries()),
				method: request.method,
				mode: request.mode,
				destinitation: request.destination,
			},
		};

		const transfer: any = request.body ? [request.body] : [];
		transfer.push(this.messageChannel.port2);

		this.handle.postMessage(message, transfer);

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
