/// <reference lib="WebWorker" />
/// <reference types="@types/serviceworker" />
import { RpcHelper } from "@mercuryworkshop/rpc";
import type { Controllerbound, SWbound } from "./types";
import type { RawHeaders } from "@mercuryworkshop/proxy-transports";
import {
	CHUNKED_STREAM,
	isChunkedStream,
	streamOfChunked,
} from "./streamfallback";

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
// stops this worker. routing therefore keys off the prefix in the url, and a
// request for a tab we don't know about asks the owning page to reconnect and
// waits for it instead of falling through to the network.
//
// the prefix is whatever the page configured, so it can't be baked in here.
// every controller reports its prefix on init, and the worker keeps the set it
// has seen in cache storage, which (unlike the worker's memory) survives the
// worker being stopped.
export const config = {
	reviveTimeout: 10000,
};

const PREFIX_CACHE = "$controller$sw";
const PREFIX_KEY = new URL("/$controller$/prefixes", location.origin).href;

let knownPrefixes: string[] = [];
let prefixesLoaded = false;
const prefixesReady: Promise<void> = (async () => {
	try {
		const cache = await caches.open(PREFIX_CACHE);
		const res = await cache.match(PREFIX_KEY);
		if (res) {
			const stored = await res.json();
			if (Array.isArray(stored)) {
				for (const prefix of stored) {
					if (typeof prefix === "string") addPrefix(prefix);
				}
			}
		}
	} catch (e) {
		console.error("failed to load stored controller prefixes", e);
	} finally {
		prefixesLoaded = true;
	}
})();

function addPrefix(prefix: string): boolean {
	if (!prefix || knownPrefixes.includes(prefix)) return false;
	knownPrefixes.push(prefix);
	// longest first, so a nested prefix wins over the one containing it
	knownPrefixes.sort((a, b) => b.length - a.length);
	return true;
}

async function rememberPrefix(prefix: string) {
	await prefixesReady;
	if (!addPrefix(prefix)) return;
	try {
		const cache = await caches.open(PREFIX_CACHE);
		await cache.put(
			PREFIX_KEY,
			new Response(JSON.stringify(knownPrefixes), {
				headers: { "content-type": "application/json" },
			})
		);
	} catch (e) {
		console.error("failed to store controller prefix", e);
	}
}

const tabs: ControllerReference[] = [];
const tabWaiters = new Map<string, Array<(tab: ControllerReference) => void>>();

addEventListener("message", (e) => {
	if (!e.data) return;
	if (typeof e.data != "object") return;
	if (!e.data.$controller$init) return;
	if (typeof e.data.$controller$init != "object") return;
	const init = e.data.$controller$init;

	// older controllers don't send basePrefix; their tab prefix is always
	// `${basePrefix}${id}/`, so it can be recovered from that
	let basePrefix: string | undefined = init.basePrefix;
	if (typeof basePrefix !== "string" && init.prefix.endsWith(init.id + "/")) {
		basePrefix = init.prefix.slice(0, -(init.id.length + 1));
	}
	if (basePrefix) {
		(e as ExtendableMessageEvent).waitUntil(rememberPrefix(basePrefix));
	}

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
	const prefix = knownPrefixes.find((p) => pathname.startsWith(p));
	if (!prefix) return null;
	const id = pathname.slice(prefix.length).split("/")[0];
	return id || null;
}

async function findTabForPath(
	pathname: string
): Promise<ControllerReference | undefined> {
	const tab = tabs.find((tab) => pathname.startsWith(tab.prefix));
	if (tab) return tab;

	await prefixesReady;
	const id = tabIdFromPath(pathname);
	if (!id) return undefined;

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
	// respondWith has to be called synchronously, but the stored prefixes are
	// read asynchronously. a fetch that wakes a stopped worker lands before
	// they are back, so until then claim everything and let route() pass
	// through whatever turns out not to be ours.
	if (!prefixesLoaded) return true;
	const url = new URL(event.request.url);
	if (tabIdFromPath(url.pathname)) return true;
	return tabs.some((tab) => url.pathname.startsWith(tab.prefix));
}

export async function route(event: FetchEvent): Promise<Response> {
	try {
		const url = new URL(event.request.url);
		const tab = await findTabForPath(url.pathname);
		if (!tab && !tabIdFromPath(url.pathname)) {
			// only reachable for requests claimed before the prefixes loaded
			return fetch(event.request);
		}
		if (!tab) {
			return new Response(
				"Proxy controller for this page is gone; reload the proxy page.",
				{ status: 503, headers: { "content-type": "text/plain" } }
			);
		}
		const client = await clients.get(event.clientId);

		const rawheaders: RawHeaders = [...event.request.headers];

		// The body as BYTES, so the transport knows how long it is.
		//
		// `event.request.body` is a ReadableStream whatever the page passed --
		// a service worker sees every body that way, even the string an XHR
		// sent -- and a transport handed a stream cannot say how many bytes are
		// coming. epoxy therefore framed it as `transfer-encoding: chunked` on
		// HTTP/1.1 and with no length at all on HTTP/2, where Chromium sends
		// `content-length` on every POST that is not an explicit
		// `duplex: "half"` upload, third in the framing block:
		//
		//     Host, Connection, Content-Length, Cache-Control, sec-ch-ua, ...
		//
		// The fix cannot be to copy the header across: `content-length` is a
		// forbidden header name in fetch, so the shim can never read the one
		// the page sent. It does not have to -- reading the body gives the same
		// number, and a transport given bytes rather than a stream frames the
		// length itself.
		//
		// The cost is that an upload is no longer streamed. That is also what
		// Chromium does for every body except a `duplex: "half"` stream, which
		// a service worker cannot distinguish anyway.
		//
		// `null` stays `null`. A bodyless GET handed a zero-length buffer is
		// not the same request -- the transport then sends a body on something
		// that must not have one, and epoxy refuses the very first GET.
		const requestBody = event.request.body
			? await event.request.arrayBuffer()
			: null;

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
				body: requestBody,
				cache: event.request.cache,
				forceCrossOriginIsolated: false,
				initialHeaders: rawheaders,
				rawClientUrl: client ? client.url : undefined,
				clientId: event.clientId || event.resultingClientId,
			},
			requestBody instanceof ReadableStream ||
				requestBody instanceof ArrayBuffer
				? [requestBody]
				: undefined
		);

		// Where the stream couldn't be transferred, the controller sent a port instead — rebuild the
		// stream from it so Response gets exactly what it gets everywhere else.
		const body = isChunkedStream(response.body)
			? streamOfChunked(response.body[CHUNKED_STREAM])
			: response.body;

		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (e) {
		console.error("Service Worker error:", e);
		// A network error, not a 500. When a request cannot be made at all --
		// DNS does not resolve, the handshake dies, the transport is gone -- a
		// browser produces no response and the fetch rejects. Answering with a
		// status turns "could not reach the server" into "the server said
		// something", which is a thing no browser does and a difference the
		// page can read.
		//
		// Cloudflare's challenge reads exactly this. It probes
		// `brunhild.challenges.cloudflare.com`, which resolves nowhere for
		// anyone, and records HOW the request failed: a direct load reports
		// `fetch_error`, where answering from here reported `http_error:500`.
		// The probe exists to be failed; what it grades is the shape of the
		// failure.
		//
		// The error is still logged above, so an internal bug stays as visible
		// to whoever is debugging as it ever was -- just not to the page.
		return Response.error();
	}
}

addEventListener("install", () => {
	self.skipWaiting();
});

addEventListener("activate", (event: ExtendableEvent) => {
	event.waitUntil(clients.claim());
});
