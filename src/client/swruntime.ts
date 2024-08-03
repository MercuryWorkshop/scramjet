import { ScramjetClient } from "./client";
import { encodeUrl } from "./shared";

export class ScramjetServiceWorkerRuntime {
	constructor(public client: ScramjetClient) {
		// @ts-ignore
		self.onconnect = (cevent: MessageEvent) => {
			const port = cevent.ports[0];

			port.addEventListener("message", (event) => {
				if ("scramjet$type" in event.data) {
					handleMessage(client, event.data);
				}
			});

			port.start();
		};
	}

	hook() {}
}

function handleMessage(client: ScramjetClient, data: MessageW2R) {
	const port = data.scramjet$port;
	const type = data.scramjet$type;
	const token = data.scramjet$token;

	if (type === "fetch") {
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
	MessageTypeW2R & { scramjet$port: MessagePort };
