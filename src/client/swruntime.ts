import { ScramjetClient } from "./client";
import { encodeUrl } from "./shared";

export class ScramjetServiceWorkerRuntime {
	constructor(public client: ScramjetClient) {
		addEventListener("connect", (cevent: MessageEvent) => {
			const port = cevent.ports[0];

			port.addEventListener("message", (event) => {
				if ("scramjet$type" in event.data) {
					handleMessage(client, event.data, port);
				}
			});

			port.start();
		});
	}

	hook() {}
}

function handleMessage(
	client: ScramjetClient,
	data: MessageW2R,
	port: MessagePort
) {
	const type = data.scramjet$type;
	const token = data.scramjet$token;

	if (type === "fetch") {
		const fetchhandlers = client.eventcallbacks.get("fetch");
		if (!fetchhandlers) return;

		for (const handler of fetchhandlers) {
			const request = data.scramjet$request;
			const fakeRequest = new Request(request.url, {
				body: request.body,
				headers: new Headers(request.headers),
				method: request.method,
				mode: request.mode,
			});

			Object.defineProperty(fakeRequest, "destination", {
				value: request.destinitation,
			});

			const fakeFetchEvent = new FetchEvent("fetch", {
				request: fakeRequest,
			});

			fakeFetchEvent.respondWith = async (
				response: Response | Promise<Response>
			) => {
				response = await response;

				response.body;
				port.postMessage({
					scramjet$type: "fetch",
					scramjet$token: token,
					scramjet$response: {
						body: response.body,
						headers: Array.from(response.headers.entries()),
						status: response.status,
						statusText: response.statusText,
					},
				} as MessageR2W);
			};

			handler.proxiedCallback(trustEvent(fakeFetchEvent));
		}
	}
}

function trustEvent(event: Event): Event {
	return new Proxy(event, {
		get(target, prop, reciever) {
			if (prop === "isTrusted") return true;

			return Reflect.get(target, prop, reciever);
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
export type MessageW2R = MessageCommon & MessageTypeW2R;
