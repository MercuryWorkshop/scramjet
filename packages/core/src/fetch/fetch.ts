import {
	BareRequestInit,
	BareResponse,
	RawHeaders,
} from "@mercuryworkshop/proxy-transports";
import {
	BodyType,
	ScramjetFetchHandler,
	ScramjetFetchParsed,
	ScramjetFetchRequest,
	ScramjetFetchResponse,
	ScramjetFetchTrackedClient,
} from ".";
import {
	rewriteUrl,
	unrewriteBlob,
	unrewriteUrl,
	URLMeta,
} from "@rewriters/url";
import { ScramjetHeaders } from "@/shared";
import { isDocument, isRedirect, normalizeContentType } from "./util";
import { rewriteBody } from "./body";
import { Tap } from "@/Tap";
import { rewriteRequestHeaders, rewriteResponseHeaders } from "./headers";
import { Object_entries, Object_keys, _URL, Error } from "@/shared/snapshot";

export async function doHandleFetch(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest
): Promise<ScramjetFetchResponse> {
	const parsed = parseRequest(request, handler);

	if (isBlobOrDataUrl(parsed.url)) {
		return handleBlobOrDataUrlFetch(handler, request, parsed);
	}

	if (parsed.hadExtraParams && isDocument(request)) {
		const location = rewriteUrl(parsed.url, handler.context, parsed.meta);
		if (location !== request.rawUrl.href) {
			const responseHeaders = new ScramjetHeaders();
			responseHeaders.set("location", location);
			return {
				body: "",
				headers: responseHeaders,
				status: 307,
				statusText: "Temporary Redirect",
			};
		}
	}

	const newheaders = rewriteRequestHeaders(request, handler, parsed);

	let responseBody: BodyType;
	const response = await doNetworkFetch(handler, request, parsed, newheaders);

	// set-cookie needs to take the raw headers. after this, we can flatten the headers into a ScramjetHeaders object
	await handleCookies(handler, request, parsed, response.rawHeaders);

	if (isDocument(request)) {
		// for document.referer
		parsed.trackedClient?.history.push({
			url: parsed.url.href,
			refererPolicy: ScramjetHeaders.fromRawHeaders(response.rawHeaders).get(
				"referrer-policy"
			),
		});
	}

	const responseHeaders = await rewriteResponseHeaders(
		handler,
		request,
		parsed,
		response.rawHeaders
	);

	if (isRedirect(response)) {
		const location = new _URL(responseHeaders.get("location"));
		const referer = newheaders.get("Referer");
		// when going through a redirect, we need to hold on to the original referer, because it can change origins during a redirect
		// easiest way of accomplishing this is just tacking on an extra query parameter that's read below
		location.searchParams.set("rfs", referer ?? "");

		// Cross-site redirect poisoning (SameSite): if this hop was cross-site, or a
		// previous hop already was, propagate the flag so the final destination enforces
		// cross-site SameSite restrictions.
		if (!parsed.crossSiteRedirect) {
			// Compute originUrl the same way rewriteRequestHeaders does
			const rawOUrl =
				parsed.referrerSourceUrl !== undefined
					? parsed.referrerSourceUrl
					: request.rawClientUrl ||
						(request.rawReferrer ? new URL(request.rawReferrer) : undefined);
			if (
				rawOUrl &&
				rawOUrl.pathname.startsWith(handler.context.prefix.pathname)
			) {
				const originUrl = new URL(unrewriteUrl(rawOUrl, handler.context));
				if (
					registrableDomainForRedirect(originUrl.hostname) !==
					registrableDomainForRedirect(parsed.url.hostname)
				) {
					location.searchParams.set("sj$csr", "1");
				}
			}
		} else {
			location.searchParams.set("sj$csr", "1");
		}

		responseHeaders.set("location", location.href);

		// ensure that ?type=module is not lost in a redirect
		if (parsed.scriptType === "module") {
			const url = new _URL(responseHeaders.get("location"));
			url.searchParams.set("type", parsed.scriptType);
			responseHeaders.set("location", url.href);
		}
	}

	if (response.body && !isRedirect(response)) {
		responseBody = await rewriteBody(handler, request, parsed, response);

		// After rewriting HTML, the body is a JS string which will be encoded as
		// UTF-8 by the Response constructor. Normalize the Content-Type charset so
		// the browser doesn't try to decode UTF-8 bytes with the original encoding.
		normalizeContentType(request, responseHeaders);
	}

	const respcontext: typeof handler.hooks.fetch.response.context = {
		request,
		parsed,
	};
	const respprops: typeof handler.hooks.fetch.response.props = {
		response: {
			body: responseBody,
			headers: responseHeaders,
			status: response.status,
			statusText: response.statusText,
		},
	};

	await Tap.dispatch(handler.hooks.fetch.response, respcontext, respprops);

	return respprops.response;
}

export async function doNetworkFetch(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	newheaders: ScramjetHeaders
): Promise<BareResponse> {
	const init = {
		body: request.body,
		headers: newheaders.toRawHeaders(),
		method: request.method,
		redirect: "manual",
	} as BareRequestInit;

	const reqcontext: typeof handler.hooks.fetch.request.context = {
		client: handler.client,
		request,
		parsed,
	};
	const reqprops: typeof handler.hooks.fetch.request.props = {
		init,
		url: parsed.url,
	};
	await Tap.dispatch(handler.hooks.fetch.request, reqcontext, reqprops);
	let earlyResponse: BareResponse;

	if (reqprops.earlyResponse) {
		const resp = reqprops.earlyResponse;
		if ("rawHeaders" in resp) {
			// it's a bare response
			earlyResponse = resp;
		} else {
			// it's a native response, convert it
			earlyResponse = BareResponse.fromNativeResponse(resp);
		}
	} else {
		earlyResponse = await handler.client.fetch(reqprops.url, reqprops.init);
	}

	const prerespcontext: typeof handler.hooks.fetch.preresponse.context = {
		request,
		parsed,
	};

	const prerespprops: typeof handler.hooks.fetch.preresponse.props = {
		response: earlyResponse,
	};

	await Tap.dispatch(
		handler.hooks.fetch.preresponse,
		prerespcontext,
		prerespprops
	);

	return prerespprops.response;
}

export function parseRequest(
	request: ScramjetFetchRequest,
	handler: ScramjetFetchHandler
): ScramjetFetchParsed {
	const strippedUrl = new _URL(request.rawUrl.href);
	const extraParams: Record<string, string> = {};

	let scriptType: "module" | "regular" = "regular";
	let topFrameName: string | undefined;
	let parentFrameName: string | undefined;
	let referrerPolicy: string | undefined;
	let referrerSourceUrl: _URL | null | undefined;
	let crossSiteRedirect = false;
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
			case "rfp":
				referrerPolicy = value;
				break;
			case "rfs":
				referrerSourceUrl = value ? new _URL(value) : null;
				break;
			case "sj$csr":
				// Cross-site redirect flag: set when any hop in the redirect chain was cross-site
				crossSiteRedirect = value === "1";
				break;
			default:
				dbg.warn(
					`${request.rawUrl.href} extraneous query parameter ${param}. Assuming <form> element`
				);
				extraParams[param] = value;
				break;
		}
	}
	strippedUrl.search = "";

	const hadExtraParams = Object_keys(extraParams).length > 0;

	if (!_URL.canParse(unrewriteUrl(strippedUrl, handler.context))) {
		throw new Error(`unable to parse rewritten url: ${strippedUrl.href}`);
	}
	const url = new _URL(unrewriteUrl(strippedUrl, handler.context));

	if (url.origin === new _URL(request.rawUrl).origin) {
		// uh oh!
		throw new Error(
			"attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting"
		);
	}

	// now that we're past unrewriting it's safe to add back the params
	for (const [param, value] of Object_entries(extraParams)) {
		url.searchParams.set(param, value);
	}

	const clientId = request.clientId;

	let trackedClient: ScramjetFetchTrackedClient | undefined;
	// realistically, this will always be true
	// but try not to blow up if it's not
	if (clientId) {
		trackedClient = handler.trackedClients.get(clientId);
		if (!trackedClient) {
			trackedClient = new ScramjetFetchTrackedClient(clientId);
			handler.trackedClients.set(clientId, trackedClient);
		}
	}

	// TODO: figure out what origin and base actually mean
	const meta: URLMeta = {
		origin: url,
		base: url,
		topFrameName,
		parentFrameName,
		referrerPolicy: referrerPolicy,
	};

	const parsed: ScramjetFetchParsed = {
		meta,
		url,
		scriptType,
		referrerPolicy,
		referrerSourceUrl,
		trackedClient,
		hadExtraParams,
		crossSiteRedirect,
	};

	if (request.rawClientUrl) {
		// TODO: probably need to make a meta for it
		parsed.clientUrl = new _URL(
			unrewriteUrl(request.rawClientUrl, handler.context)
		);
	}

	return parsed;
}

function isBlobOrDataUrl(url: _URL): boolean {
	return url.protocol === "blob:" || url.protocol === "data:";
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

	// blob urls actually *can* set charsets, so we need to normalize them if it goes down the html path
	normalizeContentType(request, headers);

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

/** Simplified registrable-domain check used for cross-site redirect detection. */
export function registrableDomainForRedirect(hostname: string): string {
	if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return hostname;
	const labels = hostname.split(".");
	if (labels.length <= 1) return hostname;
	if (labels[0] === "www") return labels.slice(1).join(".");
	if (labels.length === 2) return hostname;
	return labels.slice(-2).join(".");
}

async function handleCookies(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest,
	parsed: ScramjetFetchParsed,
	rawHeaders: RawHeaders
) {
	const cookies = [];

	for (const [key, value] of rawHeaders) {
		if (key.toLowerCase() !== "set-cookie") continue;

		handler.context.cookieJar.setCookies(value, parsed.url);
		cookies.push({
			url: parsed.url,
			cookie: value,
		});
	}

	if (cookies.length === 0) {
		return;
	}

	await handler.sendSetCookie(cookies, {
		destination: request.destination,
	});
}
