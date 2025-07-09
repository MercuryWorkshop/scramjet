import BareClient, { BareResponseFetch } from "@mercuryworkshop/bare-mux";
import { ScramjetServiceWorker } from ".";
import { renderError } from "./error";
import { FakeServiceWorker } from "./fakesw";
import { CookieStore } from "../shared/cookie";
import {
	ScramjetHeaders,
	unrewriteUrl,
	rewriteCss,
	rewriteHeaders,
	rewriteHtml,
	rewriteWorkers,
	unrewriteBlob,
} from "../shared";
import { getSiteDirective } from "../shared/security/siteTests";
import {
	initializeTracker,
	updateTracker,
	cleanTracker,
	getMostRestrictiveSite,
	storeReferrerPolicy,
	getReferrerPolicy,
} from "../shared/security/forceReferrer";

import type { URLMeta } from "../shared/rewriters/url";
import { $scramjet, flagEnabled } from "../scramjet";
import { rewriteJsWithMap } from "../shared/rewriters/js";

function newMeta(url: URL): URLMeta {
	return {
		origin: url,
		base: url,
	};
}

export async function handleFetch(
	this: ScramjetServiceWorker,
	request: Request,
	client: Client | null
) {
	try {
		const requestUrl = new URL(request.url);
		let workerType = "";
		if (requestUrl.searchParams.has("type")) {
			workerType = requestUrl.searchParams.get("type") as string;
			requestUrl.searchParams.delete("type");
		}
		if (requestUrl.searchParams.has("dest")) {
			requestUrl.searchParams.delete("dest");
		}

		if (requestUrl.pathname === this.config.files.wasm) {
			return fetch(this.config.files.wasm).then(async (x) => {
				const buf = await x.arrayBuffer();
				const b64 = btoa(
					new Uint8Array(buf)
						.reduce(
							(data, byte) => (data.push(String.fromCharCode(byte)), data),
							[]
						)
						.join("")
				);

				let payload = "";
				payload +=
					"if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
				payload += `self.WASM = '${b64}';`;

				return new Response(payload, {
					headers: { "content-type": "text/javascript" },
				});
			});
		}

		if (
			requestUrl.pathname.startsWith(`${this.config.prefix}blob:`) ||
			requestUrl.pathname.startsWith(`${this.config.prefix}data:`)
		) {
			let dataUrl = requestUrl.pathname.substring(this.config.prefix.length);
			if (dataUrl.startsWith("blob:")) {
				dataUrl = unrewriteBlob(dataUrl);
			}

			const response: Partial<BareResponseFetch> = await fetch(dataUrl, {});
			const url = dataUrl.startsWith("blob:") ? dataUrl : "(data url)";
			response.finalURL = url;
			let body: BodyType;

			if (response.body) {
				body = await rewriteBody(
					response as BareResponseFetch,
					client
						? {
								base: new URL(new URL(client.url).origin),
								origin: new URL(new URL(client.url).origin),
							}
						: newMeta(new URL(unrewriteUrl(request.referrer))),
					request.destination,
					workerType,
					this.cookieStore
				);
			}
			const headers = Object.fromEntries(response.headers.entries());

			if (crossOriginIsolated) {
				headers["Cross-Origin-Opener-Policy"] = "same-origin";
				headers["Cross-Origin-Embedder-Policy"] = "require-corp";
			}

			return new Response(body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers,
			});
		}

		const url = new URL(unrewriteUrl(requestUrl));

		const activeWorker: FakeServiceWorker | null = this.serviceWorkers.find(
			(w) => w.origin === url.origin
		);

		if (
			activeWorker?.connected &&
			requestUrl.searchParams.get("from") !== "swruntime"
		) {
			// TODO: check scope
			const r = await activeWorker.fetch(request);
			if (r) return r;
		}
		if (url.origin === new URL(request.url).origin) {
			throw new Error(
				"attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting"
			);
		}

		const headers = new ScramjetHeaders();
		for (const [key, value] of request.headers.entries()) {
			headers.set(key, value);
		}

		if (
			client &&
			new URL(client.url).pathname.startsWith($scramjet.config.prefix)
		) {
			// TODO: i was against cors emulation but we might actually break stuff if we send full origin/referrer always
			const clientURL = new URL(unrewriteUrl(client.url));
			if (clientURL.toString().includes("youtube.com")) {
				// console.log(headers);
			} else {
				// Force referrer to unsafe-url for all requests
				headers.set("Referer", clientURL.href);
				headers.set("Origin", clientURL.origin);
			}
		}

		const cookies = this.cookieStore.getCookies(url, false);

		if (cookies.length) {
			headers.set("Cookie", cookies);
		}

		// Check if we should emulate a top-level navigation
		let isTopLevelProxyNavigation = false;
		if (
			request.destination === "iframe" &&
			request.mode === "navigate" &&
			request.referrer &&
			request.referrer !== "no-referrer"
		) {
			// Trace back through the referrer chain, checking if each was an iframe navigation using the clients, until we find a non-iframe parent on a non-proxy page
			let currentReferrer = request.referrer;
			const allClients = await self.clients.matchAll({ type: "window" });

			// Trace backwards
			while (currentReferrer) {
				if (!currentReferrer.includes($scramjet.config.prefix)) {
					isTopLevelProxyNavigation = true;
					break;
				}

				// Find the parent for this iteration
				const parentChainClient = allClients.find(
					(c) => c.url === currentReferrer
				);

				// Get the next referrer policy that applies to this parent
				// eslint-disable-next-line no-await-in-loop
				const parentPolicyData = await getReferrerPolicy(currentReferrer);

				if (!parentPolicyData || !parentPolicyData.referrer) {
					// Check if this ends at the proxy origin
					if (
						parentChainClient &&
						currentReferrer.startsWith(location.origin)
					) {
						isTopLevelProxyNavigation = true;
					}
					// Results are inclusive
					break;
				}

				// Check if this was an iframe navigation by looking at the client
				if (parentChainClient && parentChainClient.frameType === "nested") {
					// Continue checking the chain
					currentReferrer = parentPolicyData.referrer;
				} else {
					// Results are inclusive
					break;
				}
			}
		}

		if (isTopLevelProxyNavigation) {
			headers.set("Sec-Fetch-Dest", "document");
			headers.set("Sec-Fetch-Mode", "navigate");
		} else {
			// Convert empty destination to "empty" string per spec
			headers.set("Sec-Fetch-Dest", request.destination || "empty");
			headers.set("Sec-Fetch-Mode", request.mode);
		}

		let siteDirective = "none";
		if (
			request.referrer &&
			request.referrer !== "" &&
			request.referrer !== "no-referrer"
		) {
			if (request.referrer.includes($scramjet.config.prefix)) {
				const unrewrittenReferrer = unrewriteUrl(request.referrer);
				if (unrewrittenReferrer) {
					const referrerUrl = new URL(unrewrittenReferrer);
					const meta = newMeta(url);
					siteDirective = await getSiteDirective(
						meta,
						referrerUrl,
						this.client
					);
				}
			}
		}

		await initializeTracker(
			url.toString(),
			request.referrer ? unrewriteUrl(request.referrer) : null,
			siteDirective
		);

		headers.set(
			"Sec-Fetch-Site",
			await getMostRestrictiveSite(url.toString(), siteDirective)
		);

		const ev = new ScramjetRequestEvent(
			url,
			headers.headers,
			request.body,
			request.method,
			request.destination,
			client
		);
		this.dispatchEvent(ev);

		const response: BareResponseFetch =
			ev.response ||
			(await this.client.fetch(ev.url, {
				method: ev.method,
				body: ev.body,
				headers: ev.requestHeaders,
				credentials: "omit",
				mode: request.mode === "cors" ? request.mode : "same-origin",
				cache: request.cache,
				redirect: "manual",
				// @ts-ignore why the fuck is this not typed microsoft
				duplex: "half",
			}));

		return await handleResponse(
			url,
			workerType,
			request.destination,
			request.mode,
			response,
			this.cookieStore,
			client,
			this.client,
			this,
			request.referrer
		);
	} catch (err) {
		const errorDetails = {
			message: err.message,
			url: request.url,
			destination: request.destination,
			timestamp: new Date().toISOString(),
		};
		if (err.stack) {
			errorDetails["stack"] = err.stack;
		}

		console.error("ERROR FROM SERVICE WORKER FETCH: ", errorDetails);

		if (!["document", "iframe"].includes(request.destination))
			return new Response(undefined, { status: 500 });

		const formattedError = Object.entries(errorDetails)
			.map(
				([key, value]) =>
					`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`
			)
			.join("\n\n");

		return renderError(formattedError, unrewriteUrl(request.url));
	}
}

async function handleResponse(
	url: URL,
	workertype: string,
	destination: RequestDestination,
	mode: RequestMode,
	response: BareResponseFetch,
	cookieStore: CookieStore,
	client: Client,
	bareClient: BareClient,
	swtarget: ScramjetServiceWorker,
	referrer: string
): Promise<Response> {
	let responseBody: BodyType;
	const isNavigationRequest =
		mode === "navigate" && ["document", "iframe"].includes(destination);
	const responseHeaders = await rewriteHeaders(
		response.rawHeaders,
		newMeta(url),
		bareClient,
		{ get: getReferrerPolicy, set: storeReferrerPolicy }
	);

	// Store referrer policy from navigation responses for Force Referrer
	if (isNavigationRequest && responseHeaders["referrer-policy"] && referrer) {
		await storeReferrerPolicy(
			url.href,
			responseHeaders["referrer-policy"],
			referrer
		);
	}

	if (
		response.status >= 300 &&
		response.status < 400 &&
		responseHeaders["location"]
	) {
		const redirectUrl = new URL(unrewriteUrl(responseHeaders["location"]));

		await updateTracker(
			url.toString(),
			redirectUrl.toString(),
			responseHeaders["referrer-policy"]
		);

		const redirectMeta = newMeta(redirectUrl);
		const newSiteDirective = await getSiteDirective(
			redirectMeta,
			url,
			bareClient
		);
		await getMostRestrictiveSite(redirectUrl.toString(), newSiteDirective);
	}

	const maybeHeaders = responseHeaders["set-cookie"] || [];
	for (const cookie in maybeHeaders) {
		if (client) {
			const promise = swtarget.dispatch(client, {
				scramjet$type: "cookie",
				cookie,
				url: url.href,
			});
			if (destination !== "document" && destination !== "iframe") {
				await promise;
			}
		}
	}

	await cookieStore.setCookies(
		maybeHeaders instanceof Array ? maybeHeaders : [maybeHeaders],
		url
	);

	for (const header in responseHeaders) {
		// flatten everything past here
		if (Array.isArray(responseHeaders[header]))
			responseHeaders[header] = responseHeaders[header][0];
	}

	if (response.body) {
		responseBody = await rewriteBody(
			response,
			newMeta(url),
			destination,
			workertype,
			cookieStore
		);
	}

	// downloads
	if (["document", "iframe"].includes(destination)) {
		const header = responseHeaders["content-disposition"];

		// validate header and test for filename
		if (!/\s*?((inline|attachment);\s*?)filename=/i.test(header)) {
			// if filename= wasn"t specified then maybe the remote specified to download this as an attachment?
			// if it"s invalid then we can still possibly test for the attachment/inline type
			const type = /^\s*?attachment/i.test(header) ? "attachment" : "inline";

			// set the filename
			const [filename] = new URL(response.finalURL).pathname
				.split("/")
				.slice(-1);

			responseHeaders["content-disposition"] =
				`${type}; filename=${JSON.stringify(filename)}`;
		}
	}
	if (responseHeaders["accept"] === "text/event-stream") {
		responseHeaders["content-type"] = "text/event-stream";
	}

	// scramjet runtime can use features that permissions-policy blocks
	delete responseHeaders["permissions-policy"];

	if (
		crossOriginIsolated &&
		[
			"document",
			"iframe",
			"worker",
			"sharedworker",
			"style",
			"script",
		].includes(destination)
	) {
		responseHeaders["Cross-Origin-Embedder-Policy"] = "require-corp";
		responseHeaders["Cross-Origin-Opener-Policy"] = "same-origin";
	}

	const ev = new ScramjetHandleResponseEvent(
		responseBody,
		responseHeaders,
		response.status,
		response.statusText,
		destination,
		url,
		response,
		client
	);
	swtarget.dispatchEvent(ev);

	// Clean up tracker if not a redirect
	if (!(response.status >= 300 && response.status < 400)) {
		await cleanTracker(url.toString());
	}

	return new Response(ev.responseBody, {
		headers: ev.responseHeaders as HeadersInit,
		status: ev.status,
		statusText: ev.statusText,
	});
}

async function rewriteBody(
	response: BareResponseFetch,
	meta: URLMeta,
	destination: RequestDestination,
	workertype: string,
	cookieStore: CookieStore
): Promise<BodyType> {
	switch (destination) {
		case "iframe":
		case "document":
			if (response.headers.get("content-type")?.startsWith("text/html")) {
				// note from percs: i think this has the potential to be slow asf, but for right now its fine (we should probably look for a better solution)
				// another note from percs: regex seems to be broken, gonna comment this out
				/*
        const buf = await response.arrayBuffer();
        const decode = new TextDecoder("utf-8").decode(buf);
        const charsetHeader = response.headers.get("content-type");
        const charset =
          charsetHeader?.split("charset=")[1] ||
          decode.match(/charset=([^"]+)/)?.[1] ||
          "utf-8";
        const htmlContent = charset
          ? new TextDecoder(charset).decode(buf)
          : decode;
        */
				return rewriteHtml(await response.text(), cookieStore, meta, true);
			} else {
				return response.body;
			}
		case "script": {
			let { js, tag, map } = rewriteJsWithMap(
				new Uint8Array(await response.arrayBuffer()),
				response.finalURL,
				meta,
				workertype === "module"
			);
			if (flagEnabled("sourcemaps", meta.base) && map) {
				if (js instanceof Uint8Array) {
					js = new TextDecoder().decode(js);
				}
				const sourcemapfn = `${globalThis.$scramjet.config.globals.pushsourcemapfn}([${map.join(",")}], "${tag}");`;
				const strictMode = /^\s*(['"])use strict\1;?/;
				if (strictMode.test(js)) {
					js = js.replace(strictMode, `$&\n${sourcemapfn}`);
				} else {
					js = `${sourcemapfn}\n${js}`;
				}
			}

			return js as unknown as ArrayBuffer;
		}
		case "style":
			return rewriteCss(await response.text(), meta);
		case "sharedworker":
		case "worker":
			return rewriteWorkers(
				new Uint8Array(await response.arrayBuffer()),
				workertype,
				response.finalURL,
				meta
			);
		default:
			return response.body;
	}
}

type BodyType = string | ArrayBuffer | Blob | ReadableStream<any>;

export class ScramjetHandleResponseEvent extends Event {
	constructor(
		public responseBody: BodyType,
		public responseHeaders: Record<string, string>,
		public status: number,
		public statusText: string,
		public destination: string,
		public url: URL,
		public rawResponse: BareResponseFetch,
		public client: Client
	) {
		super("handleResponse");
	}
}

export class ScramjetRequestEvent extends Event {
	constructor(
		public url: URL,
		public requestHeaders: Record<string, string>,
		public body: BodyType,
		public method: string,
		public destination: string,
		public client: Client
	) {
		super("request");
	}
	public response?: BareResponseFetch;
}
