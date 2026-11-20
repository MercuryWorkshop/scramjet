/// <reference lib="WebWorker" />
/// <reference types="@types/serviceworker" />
import { RpcHelper } from "@mercuryworkshop/rpc";
import type { Controllerbound, SWbound } from "./types";
import type { RawHeaders } from "@mercuryworkshop/proxy-transports";

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

const cookieResolvers: Record<string, (value: void) => void> = {};
addEventListener("message", (e) => {
	if (!e.data) return;
	if (typeof e.data != "object") return;
	if (e.data.$sw$setCookieDone && typeof e.data.$sw$setCookieDone == "object") {
		const done = e.data.$sw$setCookieDone;

		const resolver = cookieResolvers[done.id];
		if (resolver) {
			resolver();
			delete cookieResolvers[done.id];
		}
	}

	if (
		e.data.$sw$initRemoteTransport &&
		typeof e.data.$sw$initRemoteTransport == "object"
	) {
		const { port, prefix } = e.data.$sw$initRemoteTransport;

		const pending = findTabForPath(new URL(prefix).pathname).then((tab) => {
			if (!tab) {
				console.error("No relevant controller found for transport init");
				return;
			}
			tab.rpc.call("initRemoteTransport", port, [port]);
		});
		(e as ExtendableMessageEvent).waitUntil(pending);
	}
});

class ControllerReference {
	rpc: RpcHelper<SWbound, Controllerbound>;

	constructor(
		public prefix: string,
		public id: string,
		port: MessagePort
	) {
		this.rpc = new RpcHelper(
			{
				sendSetCookie: async ({ cookies, options }) => {
					const clients = await self.clients.matchAll();
					const ids: string[] = [];
					const promises: Promise<string>[] = [];

					// Navigation fetches (document/iframe) deliver cookies via the inject
					// script's embedded cookieJar dump — the destination page doesn't have
					// inject.ts loaded yet to ack, so awaiting would deadlock. Broadcast
					// so any already-loaded clients can update their jars, but don't wait.
					const isNavigation =
						options?.destination === "document" ||
						options?.destination === "iframe";

					for (const client of clients) {
						const id = makeId();
						ids.push(id);
						client.postMessage({
							$controller$setCookie: {
								cookies,
								options,
								id,
							},
						});
						if (!isNavigation) {
							promises.push(
								new Promise<string>((resolve) => {
									// Resolve with the id so we know which client replied.
									cookieResolvers[id] = () => resolve(id);
								})
							);
						}
					}
					// Wait for the first client to acknowledge the cookie sync.
					// Using Promise.any (not Promise.all) so that extra SW clients created by
					// window.open (e.g. test popup windows) don't cause timeouts — only the
					// main controller client needs to respond.
					if (promises.length > 0) {
						let timeoutId: ReturnType<typeof setTimeout> | undefined;
						let responded = false;
						const timeoutPromise = new Promise<void>((resolve) => {
							timeoutId = setTimeout(() => {
								if (!responded) {
									const pending = ids.filter(
										(id) => cookieResolvers[id] !== undefined
									);
									console.error(
										"timed out waiting for set cookie response (deadlock?): " +
											`cookies=${cookies.length} clients=${clients.length} ` +
											`pending=${pending.length}/${ids.length} ` +
											`clientUrls=${clients.map((c) => c.url).join(",")}`
									);
								}
								resolve();
							}, 1000);
						});

						try {
							await Promise.race([
								timeoutPromise,
								Promise.any(promises)
									.then(() => {
										responded = true;
									})
									.catch(() => {}),
							]);
						} finally {
							// Clear the timeout so it doesn't fire spuriously after the
							// race has already been won by Promise.any.
							if (timeoutId !== undefined) clearTimeout(timeoutId);
							// Clean up any pending resolvers so clients that never
							// responded don't leak entries in cookieResolvers.
							for (const id of ids) {
								delete cookieResolvers[id];
							}
						}
					}
				},
			},
			"tabchannel-" + id,
			(data, transfer) => {
				port.postMessage(data, transfer);
			}
		);
		port.onmessage = (e: MessageEvent) => {
			this.rpc.recieve(e.data);
		};
		port.onmessageerror = console.error;

		this.rpc.call("ready", undefined);
	}
}

// tab registrations only live in memory, so they vanish whenever the browser
// stops this worker. routing therefore keys off the static prefix in the url,
// and a request for a tab we don't know about asks the owning page to
// reconnect and waits for it instead of falling through to the network.
export const config = {
	prefix: "/~/sj/",
	reviveTimeout: 10000,
};

const tabs: ControllerReference[] = [];
const tabWaiters = new Map<string, Array<(tab: ControllerReference) => void>>();

addEventListener("message", (e) => {
	if (!e.data) return;
	if (typeof e.data != "object") return;
	if (!e.data.$controller$init) return;
	if (typeof e.data.$controller$init != "object") return;
	const init = e.data.$controller$init;

	const existing = tabs.findIndex((t) => t.id === init.id);
	if (existing !== -1) {
		tabs.splice(existing, 1);
	}
	const tab = new ControllerReference(init.prefix, init.id, e.ports[0]);
	tabs.push(tab);

	const waiters = tabWaiters.get(init.id);
	if (waiters) {
		tabWaiters.delete(init.id);
		for (const resolve of waiters) resolve(tab);
	}
});

function tabIdFromPath(pathname: string): string | null {
	if (!pathname.startsWith(config.prefix)) return null;
	const id = pathname.slice(config.prefix.length).split("/")[0];
	return id || null;
}

function findTabForPath(
	pathname: string
): Promise<ControllerReference | undefined> {
	const tab = tabs.find((tab) => pathname.startsWith(tab.prefix));
	if (tab) return Promise.resolve(tab);

	const id = tabIdFromPath(pathname);
	if (!id) return Promise.resolve(undefined);

	return new Promise((resolve) => {
		let waiters = tabWaiters.get(id);
		const first = !waiters;
		if (!waiters) {
			waiters = [];
			tabWaiters.set(id, waiters);
		}

		const timeout = setTimeout(() => {
			const list = tabWaiters.get(id);
			if (list) {
				const idx = list.indexOf(onTab);
				if (idx !== -1) list.splice(idx, 1);
				if (list.length === 0) tabWaiters.delete(id);
			}
			resolve(undefined);
		}, config.reviveTimeout);
		const onTab = (tab: ControllerReference) => {
			clearTimeout(timeout);
			resolve(tab);
		};
		waiters.push(onTab);

		if (first) requestRevive(id);
	});
}

async function requestRevive(id: string) {
	const all = await self.clients.matchAll({ includeUncontrolled: true });
	for (const client of all) {
		client.postMessage({
			$controller$swrevive: { id },
		});
	}
}

export function shouldRoute(event: FetchEvent): boolean {
	const url = new URL(event.request.url);
	if (tabIdFromPath(url.pathname)) return true;
	return tabs.some((tab) => url.pathname.startsWith(tab.prefix));
}

export async function route(event: FetchEvent): Promise<Response> {
	try {
		const url = new URL(event.request.url);
		const tab = await findTabForPath(url.pathname);
		if (!tab) {
			return new Response(
				"Proxy controller for this page is gone; reload the proxy page.",
				{ status: 503, headers: { "content-type": "text/plain" } }
			);
		}
		const client = await clients.get(event.clientId);

		const rawheaders: RawHeaders = [...event.request.headers];

		const response = await tab.rpc.call(
			"request",
			{
				rawUrl: event.request.url,
				rawReferrer: event.request.referrer,
				rawReferrerPolicy: event.request.referrerPolicy,
				destination: event.request.destination,
				mode: event.request.mode,
				referrer: event.request.referrer,
				method: event.request.method,
				body: event.request.body,
				cache: event.request.cache,
				forceCrossOriginIsolated: false,
				initialHeaders: rawheaders,
				rawClientUrl: client ? client.url : undefined,
				clientId: event.clientId || event.resultingClientId,
			},
			event.request.body instanceof ReadableStream ||
				// @ts-expect-error the types for fetchevent are messed up
				event.request.body instanceof ArrayBuffer
				? [event.request.body]
				: undefined
		);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (e) {
		console.error("Service Worker error:", e);
		return new Response(
			"Internal Service Worker Error: " + (e as Error).message,
			{
				status: 500,
			}
		);
	}
}

addEventListener("install", () => {
	self.skipWaiting();
});

addEventListener("activate", (event: ExtendableEvent) => {
	event.waitUntil(clients.claim());
});
