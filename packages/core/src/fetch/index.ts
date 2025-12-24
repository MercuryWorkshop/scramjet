import {
	BareCompatibleClient,
	BareResponse,
	ProxyTransport,
	RawHeaders,
	TransferrableResponse,
	BareRequestInit,
} from "@mercuryworkshop/proxy-transports";

import {
	rewriteUrl,
	unrewriteBlob,
	unrewriteUrl,
	type URLMeta,
} from "@rewriters/url";
import { rewriteJs } from "@rewriters/js";
import { ScramjetHeaders } from "@/shared/headers";
import { flagEnabled, ScramjetContext } from "@/shared";
import { rewriteHtml } from "@rewriters/html";
import { rewriteCss } from "@rewriters/css";
import { rewriteWorkers } from "@rewriters/worker";
import { ScramjetConfig } from "@/types";
import DomHandler from "domhandler";

export interface ScramjetFetchRequest {
	rawUrl: URL;
	destination: RequestDestination;
	mode: RequestMode;
	referrer: string;
	method: string;
	body: BodyType | null;
	cache: RequestCache;

	initialHeaders: ScramjetHeaders;

	rawClientUrl?: URL;
}

export interface ScramjetFetchParsed {
	url: URL;
	clientUrl?: URL;

	meta: URLMeta;
	scriptType: "module" | "regular";
}

export interface ScramjetFetchResponse {
	body: BodyType;
	headers: ScramjetHeaders;
	status: number;
	statusText: string;
}

export type FetchHandlerInit = {
	transport: ProxyTransport;
	context: ScramjetContext;
	crossOriginIsolated?: boolean;

	sendSetCookie: (url: URL, cookie: string) => Promise<void>;
	fetchDataUrl(dataUrl: string): Promise<BareResponse>;
	fetchBlobUrl(blobUrl: string): Promise<BareResponse>;
};

export class ScramjetFetchHandler extends EventTarget {
	public client: BareCompatibleClient;
	public crossOriginIsolated: boolean = false;
	public context: ScramjetContext;

	public fetchDataUrl: (dataUrl: string) => Promise<Response>;
	public fetchBlobUrl: (blobUrl: string) => Promise<Response>;
	public sendSetCookie: (url: URL, cookie: string) => Promise<void>;

	constructor(init: FetchHandlerInit) {
		super();
		this.client = new BareCompatibleClient(init.transport);
		this.context = init.context;
		this.crossOriginIsolated = init.crossOriginIsolated || false;
		this.sendSetCookie = init.sendSetCookie;
		this.fetchDataUrl = init.fetchDataUrl;
		this.fetchBlobUrl = init.fetchBlobUrl;
	}

	async handleFetch(
		request: ScramjetFetchRequest
	): Promise<ScramjetFetchResponse> {
		return doHandleFetch(this, request);
	}
}

async function doHandleFetch(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest
): Promise<ScramjetFetchResponse> {
	const parsed = parseRequest(request, handler);

	if (
		request.rawUrl.pathname.startsWith(
			`${handler.context.prefix.pathname}blob:`
		) ||
		request.rawUrl.pathname.startsWith(
			`${handler.context.prefix.pathname}data:`
		)
	) {
		return handleBlobOrDataUrlFetch(handler, request, parsed);
	}

	const newheaders = rewriteRequestHeaders(request, handler, parsed);

	const init = {
		body: request.body,
		headers: newheaders.toRawHeaders(),
		method: request.method,
		redirect: "manual",
	} as BareRequestInit;

	const req = new ScramjetRequestEvent(
		request,
		parsed.url,
		parsed,
		init,
		handler.client
	);
	handler.dispatchEvent(req);

	let response: BareResponse;

	if (req._response) {
		let resp = req._response;
		if ("then" in resp) {
			resp = await resp;
		}
		if ("rawHeaders" in resp) {
			// it's a bare response
			response = resp;
		} else {
			// it's a native response, convert it
			response = BareResponse.fromNativeResponse(resp);
		}
	} else {
		response = await handler.client.fetch(req.url, req.init);
	}

	let responseBody: BodyType;

	// set-cookie needs to take the raw headers. after this, we can flatten the headers into a ScramjetHeaders object
	await handleCookies(handler, request, parsed, response.rawHeaders);

	const responseHeaders = await rewriteHeaders(
		handler,
		request,
		parsed,
		response.rawHeaders
	);

	if (isRedirect(response)) {
		const redirectUrl = new URL(
			unrewriteUrl(responseHeaders.get("location"), handler.context)
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
			const url = new URL(responseHeaders.get("location"));
			url.searchParams.set("type", parsed.scriptType);
			responseHeaders.set("location", url.href);
		}
	}

	if (response.body && !isRedirect(response)) {
		responseBody = await rewriteBody(handler, request, parsed, response);
	}

	// Clean up tracker if not a redirect
	// if (!isRedirect(response)) {
	// await cleanTracker(parsed.url.toString());
	// }

	const resp = new ScramjetResponseEvent(request, parsed, {
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

function isRedirect(response: BareResponse) {
	return response.status >= 300 && response.status < 400;
}

export function parseRequest(
	request: ScramjetFetchRequest,
	handler: ScramjetFetchHandler
): ScramjetFetchParsed {
	const strippedUrl = new URL(request.rawUrl.href);
	const extraParams: Record<string, string> = {};

	let scriptType: "module" | "regular" = "regular";
	let topFrameName: string | undefined;
	let parentFrameName: string | undefined;
	for (const [param, value] of [...request.rawUrl.searchParams.entries()]) {
		switch (param) {
			case "type":
				if (value === "module") scriptType = value;
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

	if (!URL.canParse(unrewriteUrl(strippedUrl, handler.context))) {
		throw new Error(`unable to parse rewritten url: ${strippedUrl.href}`);
	}
	const url = new URL(unrewriteUrl(strippedUrl, handler.context));

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
		parsed.clientUrl = new URL(
			unrewriteUrl(request.rawClientUrl, handler.context)
		);
	}

	return parsed;
}

function rewriteRequestHeaders(
	request: ScramjetFetchRequest,
	handler: ScramjetFetchHandler,
	parsed: ScramjetFetchParsed
): ScramjetHeaders {
	const headers = request.initialHeaders.clone();

	if (
		request.rawClientUrl &&
		request.rawClientUrl.pathname.startsWith(handler.context.prefix.pathname)
	) {
		// TODO: i was against cors emulation but we might actually break stuff if we send full origin/referrer always
		let clientURL = new URL(
			unrewriteUrl(request.rawClientUrl, handler.context)
		);

		if (clientURL.protocol !== "http:" && clientURL.protocol !== "https:") {
			// sites will explode if we send them a data url referer
			clientURL = new URL("https://example.com/");
		}

		if (clientURL.toString().includes("youtube.com")) {
			// console.log(headers);
		} else {
			// Force referrer to unsafe-url for all requests
			headers.set("Referer", clientURL.href);
			headers.set("Origin", clientURL.origin);
		}
	}

	const cookies = handler.context.cookieJar.getCookies(parsed.url, false);

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
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed
): Promise<ScramjetFetchResponse> {
	let dataUrl = request.rawUrl.pathname.substring(
		handler.context.prefix.pathname.length
	);
	let response: BareResponse;

	if (dataUrl.startsWith("blob:")) {
		dataUrl = unrewriteBlob(dataUrl, handler.context, parsed.meta);
		response = BareResponse.fromNativeResponse(
			await handler.fetchBlobUrl(dataUrl)
		);
	} else {
		response = BareResponse.fromNativeResponse(
			await handler.fetchDataUrl(dataUrl)
		);
	}

	let body: BodyType;
	if (response.body) {
		body = await rewriteBody(
			handler,
			request,
			parsed,
			response as BareResponse
		);
	}
	const headers = ScramjetHeaders.fromRawHeaders(response.rawHeaders);
	if (handler.crossOriginIsolated) {
		headers.set("Cross-Origin-Opener-Policy", "same-origin");
		headers.set("Cross-Origin-Embedder-Policy", "require-corp");
	}

	return {
		body,
		status: response.status,
		statusText: response.statusText,
		headers: headers,
	};
}

async function handleCookies(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	rawHeaders: RawHeaders
) {
	for (const [key, value] of rawHeaders) {
		if (key.toLowerCase() !== "set-cookie") continue;

		handler.context.cookieJar.setCookies([value], parsed.url);
		const promise = handler.sendSetCookie(parsed.url, value);

		// we want the client to have the cookies before fetch returns
		// for navigations though, there's no race since we send the entire cookie dump in the same request
		if (
			request.destination !== "document" &&
			request.destination !== "iframe"
		) {
			await promise;
		}
	}
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

function rewriteLinkHeader(
	link: string,
	context: ScramjetContext,
	meta: URLMeta
) {
	return link.replace(
		/<([^>]+)>/gi,
		(match) => `<${rewriteUrl(match, context, meta)}>`
	);
}

export async function rewriteHeaders(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	rawHeaders: RawHeaders
): Promise<ScramjetHeaders> {
	const headers = ScramjetHeaders.fromRawHeaders(rawHeaders);

	for (const cspHeader of SEC_HEADERS) {
		headers.delete(cspHeader);
	}

	for (const urlHeader of URL_HEADERS) {
		if (headers.has(urlHeader)) {
			let url = headers.get(urlHeader)!;
			let rewrittenUrl = rewriteUrl(url, handler.context, parsed.meta);
			headers.set(urlHeader, rewrittenUrl);
		}
	}

	if (headers.has("link")) {
		let link = headers.get("link")!;
		let rewritten = rewriteLinkHeader(link, handler.context, parsed.meta);
		headers.set("link", rewritten);
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
	if (headers.has("sec-fetch-dest") && headers.get("sec-fetch-dest") === "") {
		headers["sec-fetch-dest"] = "empty";
	}

	if (
		headers.has("sec-fetch-site") &&
		headers.get("sec-fetch-site") !== "none"
	) {
		if (headers.has("referer")) {
			// headers["sec-fetch-site"] = await getSiteDirective(
			// 	meta,
			// 	new URL(headers["referer"]),
			// 	client
			// );
		} else {
			console.warn(
				"Missing referrer header; can't rewrite sec-fetch-site properly. Falling back to unsafe deletion."
			);
			headers.delete("sec-fetch-site");
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

	if (headers.get("accept") === "text/event-stream") {
		headers.set("content-type", "text/event-stream");
	}

	// scramjet runtime can use features that permissions-policy blocks
	headers.delete("permissions-policy");

	if (
		handler.crossOriginIsolated &&
		[
			"document",
			"iframe",
			"worker",
			"sharedworker",
			"style",
			"script",
		].includes(request.destination)
	) {
		headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		headers.set("Cross-Origin-Opener-Policy", "same-origin");
	}

	return headers;
}

async function rewriteBody(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	response: BareResponse
): Promise<BodyType> {
	switch (request.destination) {
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
					handler.context,
					parsed.meta,
					true,
					(domhandler) => {
						const evt = new ScramjetHTMLPreRewriteEvent(
							domhandler,
							request,
							parsed
						);
						handler.dispatchEvent(evt);
					},
					(domhandler) => {
						const evt = new ScramjetHTMLPostRewriteEvent(
							domhandler,
							request,
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
				response.url,
				handler.context,
				parsed.meta,
				parsed.scriptType === "module"
			) as unknown as ArrayBuffer;
		}
		case "style":
			return rewriteCss(await response.text(), handler.context, parsed.meta);
		case "sharedworker":
		case "worker":
			return rewriteWorkers(
				handler.context,
				new Uint8Array(await response.arrayBuffer()),
				// TODO: this takes a scriptType and rewritejs takes a bool..
				parsed.scriptType,
				response.url,
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
		public context: ScramjetFetchRequest,
		public parsed: ScramjetFetchParsed
	) {
		super("htmlPreRewrite");
	}
}

export class ScramjetHTMLPostRewriteEvent extends Event {
	constructor(
		public handler: DomHandler,
		public context: ScramjetFetchRequest,
		public parsed: ScramjetFetchParsed
	) {
		super("htmlPostRewrite");
	}
}

export class ScramjetResponseEvent extends Event {
	_response?: ScramjetFetchResponse | Promise<ScramjetFetchResponse>;
	constructor(
		public context: ScramjetFetchRequest,
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
	_response?:
		| BareResponse
		| Promise<BareResponse>
		| Response
		| Promise<Response>;
	constructor(
		public context: ScramjetFetchRequest,
		public url: URL,
		public parsed: ScramjetFetchParsed,
		public init: BareRequestInit,
		public client: BareCompatibleClient
	) {
		super("request");
	}
	respondWith(response: BareResponse | Promise<BareResponse>) {
		this._response = response;
	}
}
