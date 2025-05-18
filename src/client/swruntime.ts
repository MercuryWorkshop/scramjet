import { ScramjetClient } from "./client";
import { unrewriteUrl } from "../shared";

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
					if (event.data.scramjet$type === "init") {
						this.recvport = event.data.scramjet$port;
						this.recvport.postMessage({ scramjet$type: "init" });
					} else {
						handleMessage.call(this, client, event.data);
					}
				}
			});

			port.start();
		};
	}

	hook() {
		// @ts-ignore
		this.client.global.registration = {
			// TODO IMPLEMENT SCOPES
			scope: this.client.url.href,
			active: {
				scriptURL: this.client.url.href,
				state: "activated",
				onstatechange: null,
				onerror: null,

				postMessage: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: (_e: Event): boolean => {
					return false;
				},
			},
			showNotification: async () => {},
			unregister: async () => true,
			//@ts-ignore
			update: async () => {},
			installing: null,
			waiting: null,
		};

		// @ts-ignore
		this.client.global.ServiceWorkerGlobalScope = this.client.global;
	}
}

function handleMessage(
	this: ScramjetServiceWorkerRuntime,
	client: ScramjetClient,
	data: MessageW2R
) {
	const port = this.recvport;
	const type = data.scramjet$type;
	const token = data.scramjet$token;
	const handlers = client.eventcallbacks.get(self);

	if (type === "fetch") {
		dbg.log("ee", data);
		const fetchhandlers = handlers.filter((event) => event.event === "fetch");
		if (!fetchhandlers) return;

		for (const handler of fetchhandlers) {
			const request = data.scramjet$request;

			const Request = client.natives["Request"];
			const fakeRequest = new Request(unrewriteUrl(request.url), {
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
			let responded = false;
			fakeFetchEvent.respondWith = (response: Response | Promise<Response>) => {
				responded = true;
				(async () => {
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

					dbg.log("sw", "responding", message);
					port.postMessage(message, [response.body]);
				})();
			};

			dbg.log("to fn", fakeFetchEvent);
			handler.proxiedCallback(trustEvent(fakeFetchEvent));
			if (!responded) {
				console.log("sw", "no response");
				port.postMessage({
					scramjet$type: "fetch",
					scramjet$token: token,
					scramjet$response: false,
				});
			}
		}
	}
}

function trustEvent(event: Event): Event {
	return new Proxy(event, {
		get(target, prop, _reciever) {
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
	MessageTypeW2R & { scramjet$port?: MessagePort };
