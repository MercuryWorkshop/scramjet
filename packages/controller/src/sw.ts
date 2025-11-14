declare var clients: Clients;
import { RpcHelper } from "@mercuryworkshop/rpc";
import { Controllerbound, SWbound } from "./types";
import type { BareHeaders } from "@mercuryworkshop/bare-mux-custom";

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

let cookieResolvers: Record<string, (value: void) => void> = {};
addEventListener("message", (e) => {
	if (!e.data) return;
	if (typeof e.data != "object") return;
	if (!e.data.$sw$setCookieDone) return;
	if (typeof e.data.$sw$setCookieDone != "object") return;
	const done = e.data.$sw$setCookieDone;

	const resolver = cookieResolvers[done.id];
	if (resolver) {
		resolver();
		delete cookieResolvers[done.id];
	}
});

class Tab {
	rpc: RpcHelper<SWbound, Controllerbound>;

	constructor(
		public prefix: string,
		public id: string,
		port: MessagePort
	) {
		this.rpc = new RpcHelper(
			{
				sendSetCookie: async ({ url, cookie }) => {
					let clients = await self.clients.matchAll();
					let promises = [];

					for (const client of clients) {
						let id = makeId();
						client.postMessage({
							$controller$setCookie: {
								url,
								cookie,
								id,
							},
						});
						promises.push(
							new Promise<void>((resolve) => {
								cookieResolvers[id] = resolve;
							})
						);
					}
					await Promise.race([
						new Promise<void>((resolve) =>
							setTimeout(() => {
								console.error(
									"timed out waiting for set cookie response (deadlock?)"
								);
								resolve();
							}, 1000)
						),
						promises,
					]);
				},
			},
			"tabchannel-" + id,
			(data, transfer) => {
				port.postMessage(data, transfer);
			}
		);
		port.addEventListener("message", (e) => {
			this.rpc.recieve(e.data);
		});
		port.onmessageerror = console.error;

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

export function shouldRoute(event: FetchEvent): boolean {
	const url = new URL(event.request.url);
	const tab = tabs.find((tab) => url.pathname.startsWith(tab.prefix));
	return tab !== undefined;
}

export async function route(event: FetchEvent): Promise<Response> {
	try {
		const url = new URL(event.request.url);
		const tab = tabs.find((tab) => url.pathname.startsWith(tab.prefix))!;
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
			let val =
				typeof values === "string" ? values : (values?.[0] ?? undefined);
			if (val !== undefined) {
				realHeaders.set(key, val);
			}
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: realHeaders,
		});
	} catch (e) {
		return new Response(
			"Internal Service Worker Error: " + (e as Error).message,
			{
				status: 500,
			}
		);
	}
}
