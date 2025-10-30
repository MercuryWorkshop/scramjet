import {
	BareClient,
	BareHeaders,
	BareResponseFetch,
	TransferrableResponse,
} from "@mercuryworkshop/bare-mux-custom";

import { CookieJar } from "@/shared/cookie";

import {
	rewriteUrl,
	unrewriteBlob,
	unrewriteUrl,
	type URLMeta,
} from "@rewriters/url";
import { rewriteJs } from "@rewriters/js";
import { ScramjetHeaders } from "@/shared/headers";
import { Clientbound, config, flagEnabled, iface, Serverbound } from "@/shared";
import { rewriteHtml } from "@rewriters/html";
import { rewriteCss } from "@rewriters/css";
import { rewriteWorkers } from "@rewriters/worker";
import { ScramjetConfig } from "@/types";
import DomHandler from "domhandler";

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
	cookieStore: CookieJar;

	rawClientUrl?: URL;
}

export interface ScramjetFetchParsed {
	url: URL;
	clientUrl?: URL;

	meta: URLMeta;
	scriptType: string;
}

export interface ScramjetFetchResponse {
	body: BodyType;
	headers: BareHeaders;
	status: number;
	statusText: string;
}

export type FetchHandler = {
	client: BareClient;
	cookieJar: CookieJar;
	crossOriginIsolated?: boolean;
	prefix: URL;

	sendClientbound<K extends keyof Clientbound>(
		type: K,
		msg: Clientbound[K][0]
	): Promise<Clientbound[K][1]>;
	onServerbound<K extends keyof Serverbound>(
		type: K,
		listener: (msg: Serverbound[K][0]) => Promise<Serverbound[K][1]>
	): void;
	fetchDataUrl(dataUrl: string): Promise<BareResponseFetch>;
	fetchBlobUrl(blobUrl: string): Promise<BareResponseFetch>;
};

export class ScramjetFetchHandler extends EventTarget {
	public client: BareClient;
	public cookieJar: CookieJar;
	public crossOriginIsolated: boolean = false;
	public prefix: URL;

	public sendClientbound: <K extends keyof Clientbound>(
		type: K,
		msg: Clientbound[K][0]
	) => Promise<Clientbound[K][1]>;

	public fetchDataUrl: (dataUrl: string) => Promise<BareResponseFetch>;
	public fetchBlobUrl: (blobUrl: string) => Promise<BareResponseFetch>;

	constructor(init: FetchHandler) {
		super();
		this.client = init.client;
		this.cookieJar = init.cookieJar;
		this.crossOriginIsolated = init.crossOriginIsolated || false;
		this.prefix = init.prefix;
		this.sendClientbound = init.sendClientbound;
		this.fetchDataUrl = init.fetchDataUrl;
		this.fetchBlobUrl = init.fetchBlobUrl;

		init.onServerbound("setCookie", ({ cookie, url }) => {
			console.log("recv'd cookies");
			this.cookieJar.setCookies([cookie], new URL(url));

			return undefined;
		});
	}

	async handleFetch(
		context: ScramjetFetchContext
	): Promise<ScramjetFetchResponse> {
		return doHandleFetch(this, context);
	}
}

async function doHandleFetch(
	handler: ScramjetFetchHandler,
	context: ScramjetFetchContext
): Promise<ScramjetFetchResponse> {
	const parsed = parseRequest(context, handler.prefix);

	if (
		context.rawUrl.pathname.startsWith(`${config.prefix}blob:`) ||
		context.rawUrl.pathname.startsWith(`${config.prefix}data:`)
	) {
		return handleBlobOrDataUrlFetch(handler, context, parsed);
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

	const req = new ScramjetRequestEvent(
		context,
		parsed.url,
		parsed,
		init,
		handler.client
	);
	handler.dispatchEvent(req);

	// if the event listener overwrote response with a promise, use that. otherwise fetch normally
	const response =
		(await req._response) ||
		((await handler.client.fetch(req.url, req.init)) as BareResponseFetch);

	response.finalURL = req.parsed.url.href;

	let responseBody: BodyType;

	// multi headers only needed here everything else should be flat

	const responseHeaders = await rewriteHeaders(
		context,
		parsed,
		response.rawHeaders
	);
	await handleCookies(context, parsed, responseHeaders);

	if (isRedirect(response)) {
		const redirectUrl = new URL(
			unrewriteUrl(responseHeaders["location"], parsed.meta)
		);

		// await updateTracker(
		// 	url.toString(),
		// 	redirectUrl.toString(),
		// 	responseHeaders["referrer-policy"]
		// );

		// const redirectMeta = {
		// 	origin: redirectUrl,
		// 	base: redirectUrl,
		// };
		// const newSiteDirective = await getSiteDirective(
		// 	redirectMeta,
		// 	parsed.url,
		// 	bareClient
		// );
		// await getMostRestrictiveSite(redirectUrl.toString(), newSiteDirective);

		// ensure that ?type=module is not lost in a redirect
		if (parsed.scriptType) {
			const url = new URL(responseHeaders["location"]);
			url.searchParams.set("type", parsed.scriptType);
			responseHeaders["location"] = url.href;
		}
	}

	if (response.body && !isRedirect(response)) {
		responseBody = await rewriteBody(handler, context, parsed, response);
	}

	// Clean up tracker if not a redirect
	// if (!isRedirect(response)) {
	// await cleanTracker(parsed.url.toString());
	// }

	const resp = new ScramjetResponseEvent(context, parsed, {
		body: responseBody,
		headers: responseHeaders,
		status: response.status,
		statusText: response.statusText,
	});
	handler.dispatchEvent(resp);

	let r = resp.response;
	if (resp._response) r = await resp._response;

	return r;
}

function isRedirect(response: BareResponseFetch) {
	return response.status >= 300 && response.status < 400;
}

export function parseRequest(
	request: ScramjetFetchContext,
	prefix: URL
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

	const url = new URL(unrewriteUrl(strippedUrl, { prefix } as URLMeta));

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
		prefix,
	};

	const parsed: ScramjetFetchParsed = {
		meta,
		url,
		scriptType,
	};

	if (request.rawClientUrl) {
		// TODO: probably need to make a meta for it
		parsed.clientUrl = new URL(unrewriteUrl(request.rawClientUrl, parsed.meta));
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
		const clientURL = new URL(unrewriteUrl(context.rawClientUrl, parsed.meta));
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
	handler: ScramjetFetchHandler,
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed
): Promise<ScramjetFetchResponse> {
	let dataUrl = context.rawUrl.pathname.substring(config.prefix.length);
	let response: BareResponseFetch;

	if (dataUrl.startsWith("blob:")) {
		dataUrl = unrewriteBlob(dataUrl, parsed.meta);
		response = await handler.fetchBlobUrl(dataUrl);
	} else {
		response = await handler.fetchDataUrl(dataUrl);
	}

	const url = dataUrl.startsWith("blob:") ? dataUrl : "(data url)";
	response.finalURL = url;

	let body: BodyType;
	if (response.body) {
		body = await rewriteBody(
			handler,
			context,
			parsed,
			response as BareResponseFetch
		);
	}
	const headers = Object.fromEntries(response.headers.entries());
	if (context.forceCrossOriginIsolated) {
		headers["Cross-Origin-Opener-Policy"] = "same-origin";
		headers["Cross-Origin-Embedder-Policy"] = "require-corp";
	}

	return {
		body,
		status: response.status,
		statusText: response.statusText,
		headers: headers,
	};
}

async function handleCookies(
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed,
	responseHeaders: BareHeaders
) {
	const maybeHeaders = responseHeaders["set-cookie"] || [];
	// if (Array.isArray(maybeHeaders))
	// 	for (const cookie in maybeHeaders) {
	// 		if (client) {
	// 			const promise = swtarget.dispatch(client, {
	// 				scramjet$type: "cookie",
	// 				cookie,
	// 				url: url.href,
	// 			});
	// 			if (destination !== "document" && destination !== "iframe") {
	// 				await promise;
	// 			}
	// 		}
	// 	}

	context.cookieStore.setCookies(
		maybeHeaders instanceof Array ? maybeHeaders : [maybeHeaders],
		parsed.url
	);
}

/**
 * Headers for security policy features that haven't been emulated yet
 */
const SEC_HEADERS = new Set([
	"cross-origin-embedder-policy",
	"cross-origin-opener-policy",
	"cross-origin-resource-policy",
	"content-security-policy",
	"content-security-policy-report-only",
	"expect-ct",
	"feature-policy",
	"origin-isolation",
	"strict-transport-security",
	"upgrade-insecure-requests",
	"x-content-type-options",
	"x-download-options",
	"x-frame-options",
	"x-permitted-cross-domain-policies",
	"x-powered-by",
	"x-xss-protection",
	// This needs to be emulated, but for right now it isn't that important of a feature to be worried about
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Clear-Site-Data
	"clear-site-data",
]);

/**
 * Headers that are actually URLs that need to be rewritten
 */
const URL_HEADERS = new Set(["location", "content-location", "referer"]);

function rewriteLinkHeader(link: string, meta: URLMeta) {
	return link.replace(/<([^>]+)>/gi, (match) => `<${rewriteUrl(match, meta)}>`);
}

export async function rewriteHeaders(
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed,
	rawHeaders: BareHeaders
) {
	const headers = {};

	// TODO: use scrmajetheaders
	for (const key in rawHeaders) {
		headers[key.toLowerCase()] = rawHeaders[key];
	}

	for (const cspHeader of SEC_HEADERS) {
		delete headers[cspHeader];
	}

	for (const urlHeader of URL_HEADERS) {
		if (headers[urlHeader])
			headers[urlHeader] = rewriteUrl(
				headers[urlHeader]?.toString() as string,
				parsed.meta
			);
	}

	if (typeof headers["link"] === "string") {
		headers["link"] = rewriteLinkHeader(headers["link"], parsed.meta);
	} else if (Array.isArray(headers["link"])) {
		headers["link"] = headers["link"].map((link) =>
			rewriteLinkHeader(link, parsed.meta)
		);
	}

	// Emulate the referrer policy to set it back to what it should've been without Force Referrer in place
	if (typeof headers["referer"] === "string") {
		const referrerUrl = new URL(headers["referer"]);
		// const storedPolicyData = await getReferrerPolicy(referrerUrl.href);
		// if (storedPolicyData) {
		// 	const storedReferrerPolicy = storedPolicyData.policy
		// 		.toLowerCase()
		// 		.split(",")
		// 		.map((rawDir) => rawDir.trim());
		// 	if (
		// 		storedReferrerPolicy.includes("no-referrer") ||
		// 		(storedReferrerPolicy.includes("no-referrer-when-downgrade") &&
		// 			parsed.meta.origin.protocol === "http:" &&
		// 			referrerUrl.protocol === "https:")
		// 	) {
		// 		delete headers["referer"];
		// 	} else if (storedReferrerPolicy.includes("origin")) {
		// 		headers["referer"] = referrerUrl.origin;
		// 	} else if (storedReferrerPolicy.includes("origin-when-cross-origin")) {
		// 		if (referrerUrl.origin !== parsed.meta.origin.origin) {
		// 			headers["referer"] = referrerUrl.origin;
		// 		} else {
		// 			headers["referer"] = referrerUrl.href;
		// 		}
		// 	} else if (storedReferrerPolicy.includes("same-origin")) {
		// 		if (referrerUrl.origin === parsed.meta.origin.origin) {
		// 			headers["referer"] = referrerUrl.href;
		// 		} else {
		// 			delete headers["referer"];
		// 		}
		// 	} else if (storedReferrerPolicy.includes("strict-origin")) {
		// 		if (
		// 			parsed.meta.origin.protocol === "http:" &&
		// 			referrerUrl.protocol === "https:"
		// 		) {
		// 			delete headers["referer"];
		// 		} else {
		// 			headers["referer"] = referrerUrl.origin;
		// 		}
		// 	}
		// 	// `strict-origin-when-cross-origin` is the default behavior anyway
		// 	else {
		if (referrerUrl.origin === parsed.meta.origin.origin) {
			headers["referer"] = referrerUrl.href;
		} else if (
			parsed.meta.origin.protocol === "http:" &&
			referrerUrl.protocol === "https:"
		) {
			delete headers["referer"];
		} else {
			headers["referer"] = referrerUrl.origin;
		}
		// }
		// }
	}
	if (
		typeof headers["sec-fetch-dest"] === "string" &&
		headers["sec-fetch-dest"] === ""
	) {
		headers["sec-fetch-dest"] = "empty";
	}

	if (
		typeof headers["sec-fetch-site"] === "string" &&
		headers["sec-fetch-site"] !== "none"
	) {
		if (typeof headers["referer"] === "string") {
			// headers["sec-fetch-site"] = await getSiteDirective(
			// 	meta,
			// 	new URL(headers["referer"]),
			// 	client
			// );
		} else {
			console.warn(
				"Missing referrer header; can't rewrite sec-fetch-site properly. Falling back to unsafe deletion."
			);
			delete headers["sec-fetch-site"];
		}
	}

	// const isNavigationRequest =
	// 	context.mode === "navigate" &&
	// 	["document", "iframe"].includes(context.destination);

	// Store referrer policy from navigation responses for Force Referrer
	// if (isNavigationRequest && headers["referrer-policy"] && context.referrer) {
	// 	await storeReferrerPolicy(
	// 		parsed.url.href,
	// 		headers["referrer-policy"],
	// 		context.referrer
	// 	);
	// }

	if (headers["accept"] === "text/event-stream") {
		headers["content-type"] = "text/event-stream";
	}

	// scramjet runtime can use features that permissions-policy blocks
	delete headers["permissions-policy"];

	if (
		context.forceCrossOriginIsolated &&
		[
			"document",
			"iframe",
			"worker",
			"sharedworker",
			"style",
			"script",
		].includes(context.destination)
	) {
		headers["Cross-Origin-Embedder-Policy"] = "require-corp";
		headers["Cross-Origin-Opener-Policy"] = "same-origin";
	}

	return headers;
}

async function rewriteBody(
	handler: ScramjetFetchHandler,
	context: ScramjetFetchContext,
	parsed: ScramjetFetchParsed,
	response: BareResponseFetch
): Promise<BodyType> {
	switch (context.destination) {
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
				return rewriteHtml(
					await response.text(),
					context.cookieStore,
					parsed.meta,
					true,
					(domhandler) => {
						const evt = new ScramjetHTMLPreRewriteEvent(
							domhandler,
							context,
							parsed
						);
						handler.dispatchEvent(evt);
					},
					(domhandler) => {
						const evt = new ScramjetHTMLPostRewriteEvent(
							domhandler,
							context,
							parsed
						);
						handler.dispatchEvent(evt);
					}
				);
			} else {
				return response.body;
			}
		case "script": {
			return rewriteJs(
				new Uint8Array(await response.arrayBuffer()),
				response.finalURL,
				parsed.meta,
				parsed.scriptType === "module"
			) as unknown as ArrayBuffer;
		}
		case "style":
			return rewriteCss(await response.text(), parsed.meta);
		case "sharedworker":
		case "worker":
			return rewriteWorkers(
				new Uint8Array(await response.arrayBuffer()),
				// TODO: this takes a scriptType and rewritejs takes a bool..
				parsed.scriptType,
				response.finalURL,
				parsed.meta
			);
		default:
			return response.body;
	}
}

type BodyType = string | ArrayBuffer | Blob | ReadableStream<any>;

export class ScramjetHTMLPreRewriteEvent extends Event {
	constructor(
		public handler: DomHandler,
		public context: ScramjetFetchContext,
		public parsed: ScramjetFetchParsed
	) {
		super("htmlPreRewrite");
	}
}

export class ScramjetHTMLPostRewriteEvent extends Event {
	constructor(
		public handler: DomHandler,
		public context: ScramjetFetchContext,
		public parsed: ScramjetFetchParsed
	) {
		super("htmlPostRewrite");
	}
}

export class ScramjetResponseEvent extends Event {
	_response?: ScramjetFetchResponse | Promise<ScramjetFetchResponse>;
	constructor(
		public context: ScramjetFetchContext,
		public parsed: ScramjetFetchParsed,
		public response: ScramjetFetchResponse
	) {
		super("handleResponse");
	}
	respondWith(
		response: ScramjetFetchResponse | Promise<ScramjetFetchResponse>
	) {
		this._response = response;
	}
}

export class ScramjetRequestEvent extends Event {
	_response?: BareResponseFetch | Promise<BareResponseFetch>;
	constructor(
		public context: ScramjetFetchContext,
		public url: URL,
		public parsed: ScramjetFetchParsed,
		public init: RequestInit,
		public client: BareClient
	) {
		super("request");
	}
	respondWith(response: BareResponseFetch | Promise<BareResponseFetch>) {
		this._response = response;
	}
}
