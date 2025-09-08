import { BareClient, BareResponseFetch } from "../bare-mux-custom";

import { MessageW2C, ScramjetServiceWorker } from "@/worker";
import { renderError } from "@/worker/error";
import { FakeServiceWorker } from "@/worker/fakesw";
import { CookieStore } from "@/shared/cookie";

import { getSiteDirective } from "@/shared/security/siteTests";
import {
	initializeTracker,
	updateTracker,
	cleanTracker,
	getMostRestrictiveSite,
	storeReferrerPolicy,
	getReferrerPolicy,
} from "@/shared/security/forceReferrer";

import { unrewriteBlob, unrewriteUrl, type URLMeta } from "@rewriters/url";
import { rewriteJs } from "@rewriters/js";
import { ScramjetHeaders } from "@/shared/headers";
import { config, flagEnabled } from "@/shared";
import { rewriteHeaders } from "@rewriters/headers";
import { rewriteHtml } from "@rewriters/html";
import { rewriteCss } from "@rewriters/css";
import { rewriteWorkers } from "@rewriters/worker";
import { ScramjetDownload } from "@client/events";
import { ScramjetConfig } from "@/types";

function isRedirect(response: BareResponseFetch) {
	return response.status >= 300 && response.status < 400;
}

function isDownload(responseHeaders: object, destination: string): boolean {
	if (["document", "iframe"].includes(destination)) {
		const header = responseHeaders["content-disposition"];
		if (header) {
			if (header === "inline") {
				return false; // force it to show in browser
			} else {
				return true;
			}
		} else {
			// check mime type as fallback
			const displayableMimes = [
				// Text types
				"text/html",
				"text/plain",
				"text/css",
				"text/javascript",
				"text/xml",
				"application/javascript",
				"application/json",
				"application/xml",
				"application/pdf",
			];
			const contentType = responseHeaders["content-type"]
				?.split(";")[0]
				.trim()
				.toLowerCase();
			if (
				contentType &&
				!displayableMimes.includes(contentType) &&
				!contentType.startsWith("text") &&
				!contentType.startsWith("image") &&
				!contentType.startsWith("font") &&
				!contentType.startsWith("video")
			) {
				return true;
			}
		}
	}

	return false;
}

export interface ScramjetFetchContext {
	rawUrl: URL;
	destination: RequestDestination;
	mode: RequestMode;
	referrer: string;
	method: string;
	body: BodyType | null;
	cache: RequestCache;

	forceCrossOriginIsolated: boolean;
	initialHeaders: ScramjetHeaders;
	cookieStore: CookieStore;

	rawClientUrl?: URL;
}

export interface ScramjetFetchParsed {
	url: URL;
	clientUrl?: URL;

	meta: URLMeta;
	scriptType: string;
}

export function parseRequest(
	request: ScramjetFetchContext
): ScramjetFetchParsed {
	const strippedUrl = new URL(request.rawUrl.href);
	const extraParams: Record<string, string> = {};

	let scriptType = "";
	let topFrameName: string | undefined;
	let parentFrameName: string | undefined;
	for (const [param, value] of [...request.rawUrl.searchParams.entries()]) {
		switch (param) {
			case "type":
				scriptType = value;
				break;
			case "dest":
				break;
			case "topFrame":
				topFrameName = value;
				break;
			case "parentFrame":
				parentFrameName = value;
				break;
			default:
				dbg.warn(
					`${request.rawUrl.href} extraneous query parameter ${param}. Assuming <form> element`
				);
				extraParams[param] = value;
				break;
		}

		strippedUrl.searchParams.delete(param);
	}

	const url = new URL(unrewriteUrl(strippedUrl));

	if (url.origin === new URL(request.rawUrl).origin) {
		// uh oh!
		throw new Error(
			"attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting"
		);
	}

	// now that we're past unrewriting it's safe to add back the params
	for (const [param, value] of Object.entries(extraParams)) {
		url.searchParams.set(param, value);
	}

	// TODO: figure out what origin and base actually mean
	const meta: URLMeta = {
		origin: url,
		base: url,
		topFrameName,
		parentFrameName,
	};

	const parsed: ScramjetFetchParsed = {
		meta,
		url,
		scriptType,
	};

	if (request.rawClientUrl) {
		// TODO: probably need to make a meta for it
		parsed.clientUrl = new URL(unrewriteUrl(request.rawClientUrl));
	}

	return parsed;
}

function rewriteRequestHeaders(
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed
): ScramjetHeaders {
	const headers = context.initialHeaders.clone();

	if (
		context.rawClientUrl &&
		context.rawClientUrl.pathname.startsWith(config.prefix)
	) {
		// TODO: i was against cors emulation but we might actually break stuff if we send full origin/referrer always
		const clientURL = new URL(unrewriteUrl(context.rawClientUrl));
		if (clientURL.toString().includes("youtube.com")) {
			// console.log(headers);
		} else {
			// Force referrer to unsafe-url for all requests
			headers.set("Referer", clientURL.href);
			headers.set("Origin", clientURL.origin);
		}
	}

	const cookies = context.cookieStore.getCookies(parsed.url, false);

	if (cookies.length) {
		headers.set("Cookie", cookies);
	}

	// // Check if we should emulate a top-level navigation
	// let isTopLevelProxyNavigation = false;
	// if (
	// 	context.destination === "iframe" &&
	// 	context.mode === "navigate" &&
	// 	context.referrer &&
	// 	context.referrer !== "no-referrer"
	// ) {
	// 	// Trace back through the referrer chain, checking if each was an iframe navigation using the clients, until we find a non-iframe parent on a non-proxy page
	// 	let currentReferrer = context.referrer;
	// 	const allClients = await self.clients.matchAll({ type: "window" });

	// 	// Trace backwards
	// 	while (currentReferrer) {
	// 		if (!currentReferrer.includes(config.prefix)) {
	// 			isTopLevelProxyNavigation = true;
	// 			break;
	// 		}

	// 		// Find the parent for this iteration
	// 		const parentChainClient = allClients.find(
	// 			(c) => c.url === currentReferrer
	// 		);

	// 		// Get the next referrer policy that applies to this parent
	// 		// eslint-disable-next-line no-await-in-loop
	// 		const parentPolicyData = await getReferrerPolicy(currentReferrer);

	// 		if (!parentPolicyData || !parentPolicyData.referrer) {
	// 			// Check if this ends at the proxy origin
	// 			if (parentChainClient && currentReferrer.startsWith(location.origin)) {
	// 				isTopLevelProxyNavigation = true;
	// 			}
	// 			// Results are inclusive
	// 			break;
	// 		}

	// 		// Check if this was an iframe navigation by looking at the client
	// 		if (parentChainClient && parentChainClient.frameType === "nested") {
	// 			// Continue checking the chain
	// 			currentReferrer = parentPolicyData.referrer;
	// 		} else {
	// 			// Results are inclusive
	// 			break;
	// 		}
	// 	}
	// }

	// if (isTopLevelProxyNavigation) {
	// 	headers.set("Sec-Fetch-Dest", "document");
	// 	headers.set("Sec-Fetch-Mode", "navigate");
	// } else {
	// 	// Convert empty destination to "empty" string per spec
	// 	headers.set("Sec-Fetch-Dest", request.destination || "empty");
	// 	headers.set("Sec-Fetch-Mode", request.mode);
	// }

	// let siteDirective = "none";
	// if (
	// 	request.referrer &&
	// 	request.referrer !== "" &&
	// 	request.referrer !== "no-referrer"
	// ) {
	// 	if (request.referrer.includes(config.prefix)) {
	// 		const unrewrittenReferrer = unrewriteUrl(request.referrer);
	// 		if (unrewrittenReferrer) {
	// 			const referrerUrl = new URL(unrewrittenReferrer);
	// 			siteDirective = await getSiteDirective(meta, referrerUrl, this.client);
	// 		}
	// 	}
	// }

	// await initializeTracker(
	// 	url.toString(),
	// 	request.referrer ? unrewriteUrl(request.referrer) : null,
	// 	siteDirective
	// );

	// headers.set(
	// 	"Sec-Fetch-Site",
	// 	await getMostRestrictiveSite(url.toString(), siteDirective)
	// );
	return headers;
}

async function handleBlobOrDataUrlFetch(
	config: ScramjetConfig,
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed
): Promise<Response> {
	let dataUrl = context.rawUrl.pathname.substring(config.prefix.length);
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
			parsed.meta,
			context.destination,
			parsed.scriptType,
			thiscookieStore
		);
	}

	const headers = Object.fromEntries(response.headers.entries());

	if (context.forceCrossOriginIsolated) {
		headers["Cross-Origin-Opener-Policy"] = "same-origin";
		headers["Cross-Origin-Embedder-Policy"] = "require-corp";
	}

	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers: headers,
	});
}

async function handleDownload(
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed
) {
	if (flagEnabled("interceptDownloads", parsed.url)) {
		if (!client) {
			throw new Error("cant find client");
		}
		let filename: string | null = null;
		const disp = responseHeaders["content-disposition"];
		if (typeof disp === "string") {
			const filenameMatch = disp.match(/filename=["']?([^"';\n]*)["']?/i);
			if (filenameMatch && filenameMatch[1]) {
				filename = filenameMatch[1];
			}
		}
		const length = responseHeaders["content-length"];

		// there's no reliable way of finding the top level client that made the request
		// just take the first one and hope
		let clis = await clients.matchAll({
			type: "window",
		});
		// only want controller windows
		clis = clis.filter((e) => !e.url.includes(config.prefix));
		if (clis.length < 1) {
			throw Error("couldn't find a controller client to dispatch download to");
		}

		const download: ScramjetDownload = {
			filename,
			url: url.href,
			type: responseHeaders["content-type"],
			body: response.body,
			length: Number(length),
		};
		clis[0].postMessage(
			{
				scramjet$type: "download",
				download,
			} as MessageW2C,
			[response.body]
		);

		// endless vortex reference
		await new Promise(() => {});
	} else {
		// manually rewrite for regular browser download
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
}

export async function hFetch(
	context: ScramjetFetchContext,
	config: ScramjetConfig,
	client: BareClient
) {
	const parsed = parseRequest(context);

	if (
		context.rawUrl.pathname.startsWith(`${config.prefix}blob:`) ||
		context.rawUrl.pathname.startsWith(`${config.prefix}data:`)
	) {
		return handleBlobOrDataUrlFetch(config, context, parsed);
	}

	const newheaders = rewriteRequestHeaders(context, parsed);

	const init = {
		method: context.method,
		body: context.body,
		headers: newheaders.headers,
		credentials: "omit",
		mode: context.mode === "cors" ? context.mode : "same-origin",
		cache: context.cache,
		redirect: "manual",
		// @ts-ignore why the fuck is this not typed microsoft
		duplex: "half",
	} as RequestInit;

	const ev = new ScramjetRequestEvent(context, parsed.url, parsed, init);
	this.dispatchEvent(ev);

	// if the event listener overwrote response with a promise, use that. otherwise fetch normally
	const response =
		(await ev.response) ||
		((await client.fetch(ev.url, ev.init)) as BareResponseFetch);

	response.finalURL = ev.parsed.url.href;

	let responseBody: BodyType;

	const isNavigationRequest =
		context.mode === "navigate" &&
		["document", "iframe"].includes(context.destination);

	const responseHeaders = await rewriteHeaders(
		response.rawHeaders,
		meta,
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

	if (isRedirect(response)) {
		const redirectUrl = new URL(unrewriteUrl(responseHeaders["location"]));

		await updateTracker(
			url.toString(),
			redirectUrl.toString(),
			responseHeaders["referrer-policy"]
		);

		const redirectMeta = {
			origin: redirectUrl,
			base: redirectUrl,
		};
		const newSiteDirective = await getSiteDirective(
			redirectMeta,
			url,
			bareClient
		);
		await getMostRestrictiveSite(redirectUrl.toString(), newSiteDirective);

		// ensure that ?type=module is not lost in a redirect
		if (scriptType) {
			const url = new URL(responseHeaders["location"]);
			url.searchParams.set("type", scriptType);
			responseHeaders["location"] = url.href;
		}
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

	if (
		isDownload(responseHeaders, context.destination) &&
		!isRedirect(response)
	) {
		handleDownload();
	}

	if (response.body && !isRedirect(response)) {
		responseBody = await rewriteBody(
			response,
			meta,
			destination,
			scriptType,
			cookieStore
		);
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

	// Clean up tracker if not a redirect
	if (!isRedirect(response)) {
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
			return rewriteJs(
				new Uint8Array(await response.arrayBuffer()),
				response.finalURL,
				meta,
				workertype === "module"
			) as unknown as ArrayBuffer;
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
		public context: ScramjetFetchContext,
		public url: URL,
		public parsed: ScramjetFetchParsed,
		public init: RequestInit
	) {
		super("request");
	}
	public response?: BareResponseFetch | Promise<BareResponseFetch>;
}
