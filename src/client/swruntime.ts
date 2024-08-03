import { ScramjetClient } from "./client";
import { encodeUrl } from "./shared";

export class ScramjetServiceWorkerRuntime {
	recvport: MessagePort;
	constructor(public client: ScramjetClient) {
		// @ts-ignore
		self.onconnect = (cevent: MessageEvent) => {
			const port = cevent.ports[0];
			dbg.log("sw", "connected");

			port.addEventListener("message", (event) => {
				console.log("sw", event.data);
				if ("scramjet$type" in event.data) {
					handleMessage.call(this, client, event.data);
				}
			});

			port.start();
		};
	}

	hook() {}
}

function handleMessage(
	this: ScramjetServiceWorkerRuntime,
	client: ScramjetClient,
	data: MessageW2R
) {
	if (data.scramjet$port) this.recvport = data.scramjet$port;
	const port = this.recvport;
	const type = data.scramjet$type;
	const token = data.scramjet$token;

	if (type === "fetch") {
		dbg.log("ee", data);
		const fetchhandlers = client.eventcallbacks.get(self);
		if (!fetchhandlers) return;

		for (const handler of fetchhandlers) {
			const request = data.scramjet$request;
			const fakeRequest = new Request(request.url, {
				body: request.body,
				headers: new Headers(request.headers),
				method: request.method,
				mode: "same-origin",
			});

			Object.defineProperty(fakeRequest, "destination", {
				value: request.destinitation,
			});

			// TODO: clean up, maybe put into a class
			const fakeFetchEvent: any = new Event("fetch");
			fakeFetchEvent.request = fakeRequest;
			fakeFetchEvent.respondWith = async (
				response: Response | Promise<Response>
			) => {
				response = await response;
				const message: MessageR2W = {
					scramjet$type: "fetch",
					scramjet$token: token,
					scramjet$response: {
						body: response.body,
						headers: Array.from(response.headers.entries()),
						status: response.status,
						statusText: response.statusText,
					},
				};

				port.postMessage(message, [response.body]);
			};

			handler.proxiedCallback(trustEvent(fakeFetchEvent));
		}
	}
}

function trustEvent(event: Event): Event {
	return new Proxy(event, {
		get(target, prop, reciever) {
			if (prop === "isTrusted") return true;

			return Reflect.get(target, prop);
		},
	});
}

export type TransferrableResponse = {
	body: ReadableStream;
	headers: [string, string][];
	status: number;
	statusText: string;
};

export type TransferrableRequest = {
	body: ReadableStream;
	headers: [string, string][];
	destinitation: RequestDestination;
	method: Request["method"];
	mode: Request["mode"];
	url: string;
};

type FetchResponseMessage = {
	scramjet$type: "fetch";
	scramjet$response: TransferrableResponse;
};

type FetchRequestMessage = {
	scramjet$type: "fetch";
	scramjet$request: TransferrableRequest;
};

// r2w = runtime to (service) worker

type MessageTypeR2W = FetchResponseMessage;
type MessageTypeW2R = FetchRequestMessage;

type MessageCommon = {
	scramjet$type: string;
	scramjet$token: number;
};

export type MessageR2W = MessageCommon & MessageTypeR2W;
export type MessageW2R = MessageCommon &
	MessageTypeW2R & { scramjet$port: MessagePort | undefined };
