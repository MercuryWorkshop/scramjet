declare var clients: Clients;
import { RpcHelper } from "@mercuryworkshop/rpc";
import { Controllerbound, SWbound } from "./types";
import type { BareHeaders } from "@mercuryworkshop/bare-mux-custom";

class Tab {
	rpc: RpcHelper<SWbound, Controllerbound>;

	constructor(
		public prefix: string,
		public id: string,
		port: MessagePort
	) {
		this.rpc = new RpcHelper({}, "tabchannel" + id, (data, transfer) => {
			port.postMessage(data, transfer);
		});
		port.addEventListener("message", (e) => {
			this.rpc.recieve(e.data);
		});

		this.rpc.call("ready", null);
	}
}

const tabs: Tab[] = [];

addEventListener("message", (e) => {
	if (!e.data) return;
	if (typeof e.data != "object") return;
	if (!e.data.$controller$init) return;
	if (typeof e.data.$controller$init != "object") return;
	const init = e.data.$controller$init;

	tabs.push(new Tab(init.prefix, init.id, e.ports[0]));
});

function shouldRoute(event: FetchEvent): boolean {
	const tab = tabs.find((tab) => event.request.url.startsWith(tab.prefix));
	return tab !== undefined;
}

async function route(event: FetchEvent): Promise<Response> {
	const tab = tabs.find((tab) => event.request.url.startsWith(tab.prefix))!;
	const client = await clients.get(event.clientId);

	const bareheaders: BareHeaders = {};

	// @ts-expect-error for some reason it thinks headers.entries doesn't exist?
	for (const [key, value] of event.request.headers.entries()) {
		bareheaders[key] = [value];
	}

	const response = await tab.rpc.call(
		"request",
		{
			rawUrl: event.request.url,
			destination: event.request.destination,
			mode: event.request.mode,
			referrer: event.request.referrer,
			method: event.request.method,
			body: event.request.body,
			cache: event.request.cache,
			forceCrossOriginIsolated: false,
			initialHeaders: bareheaders,
			rawClientUrl: client ? client.url : undefined,
		},
		event.request.body instanceof ReadableStream ||
			// @ts-expect-error the types for fetchevent are messed up
			event.request.body instanceof ArrayBuffer
			? [event.request.body]
			: undefined
	);

	const realHeaders = new Headers();
	for (const [key, values] of Object.entries(response.headers)) {
		let val = typeof values === "string" ? values : (values?.[0] ?? undefined);
		if (val !== undefined) {
			realHeaders.set(key, val);
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: realHeaders,
	});
}
