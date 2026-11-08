/// <reference lib="WebWorker" />
/// <reference types="@types/serviceworker" />
import { RpcHelper } from "@mercuryworkshop/rpc";
import type { Controllerbound, SWbound } from "./types";
import type { RawHeaders } from "@mercuryworkshop/proxy-transports";
import { DEFAULT_PREFIX } from "./prefix";

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

/** How long a request waits for its controller to register with a fresh instance. */
const REVIVE_TIMEOUT = 5000;

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

		const relevantcontroller = tabs.find((tab) =>
			new URL(prefix).pathname.startsWith(tab.prefix)
		);
		if (!relevantcontroller) {
			console.error("No relevant controller found for transport init");
			return;
		}
		relevantcontroller.rpc.call("initRemoteTransport", port, [port]);
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

const tabs: ControllerReference[] = [];

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

	for (const waiter of waiters.filter((w) =>
		w.pathname.startsWith(tab.prefix)
	)) {
		waiters.splice(waiters.indexOf(waiter), 1);
		waiter.resolve(tab);
	}
});

type Waiter = {
	pathname: string;
	resolve: (tab: ControllerReference | undefined) => void;
};

/**
 * Requests routed before their controller registered with this instance. Browsers stop idle
 * service workers and start a fresh instance for the next event, which knows no `tabs`
 * until each controller registers again.
 */
const waiters: Waiter[] = [];

function findTab(pathname: string): ControllerReference | undefined {
	return tabs.find((tab) => pathname.startsWith(tab.prefix));
}

let revived = false;

/**
 * Asks every client to register its controller with this instance, once per instance.
 * Clients already registered, listed in the message, ignore it.
 */
async function reviveClients() {
	if (revived) return;
	revived = true;
	for (const client of await clients.matchAll()) {
		client.postMessage({
			$controller$swrevive: { registered: tabs.map((tab) => tab.id) },
		});
	}
}

/**
 * The controller for a path, waiting for it to register if this instance doesn't know it
 * yet. Resolves undefined if none registers in time.
 */
function waitForTab(
	pathname: string
): Promise<ControllerReference | undefined> {
	const tab = findTab(pathname);
	if (tab) return Promise.resolve(tab);

	return new Promise((resolve) => {
		const waiter: Waiter = { pathname, resolve };
		waiters.push(waiter);
		// Ask now rather than waiting for the startup broadcast below.
		reviveClients();
		setTimeout(() => {
			const index = waiters.indexOf(waiter);
			if (index === -1) return;
			waiters.splice(index, 1);
			resolve(undefined);
		}, REVIVE_TIMEOUT);
	});
}

export function shouldRoute(event: FetchEvent): boolean {
	const url = new URL(event.request.url);
	if (findTab(url.pathname)) return true;
	// A fresh instance knows no controllers until they register again, so the request that
	// woke it would otherwise fall through to the network. Claim anything under the default
	// prefix; route() waits for its controller. (A custom prefix can't be known here.)
	return (
		url.origin === location.origin && url.pathname.startsWith(DEFAULT_PREFIX)
	);
}

export async function route(event: FetchEvent): Promise<Response> {
	const url = new URL(event.request.url);
	const tab = await waitForTab(url.pathname);
	// No controller claimed it, so handle it as if it had never been routed.
	if (!tab) return fetch(event.request);

	try {
		const client = await clients.get(event.clientId);

		const rawheaders: RawHeaders = [...event.request.headers];

		const response = await tab.rpc.call(
			"request",
			{
				rawUrl: event.request.url,
				rawReferrer: event.request.referrer,
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

// the only way to know if a service worker has suddenly died is if this code runs again
// notify all clients to send over their messageports again
setTimeout(() => {
	console.log("service worker activated, notifying clients to revive");
	reviveClients();
	// short delay is apparently needed
}, 100);
