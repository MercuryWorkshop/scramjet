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
import { unrewriteBlob, unrewriteUrl, URLMeta } from "@rewriters/url";
import { isHtmlMimeType, rewriteHtml, ScramjetHeaders } from "@/shared";
import { isDocument, isRedirect, normalizeContentType } from "./util";
import { sniffEncoding } from "@/shared/sniffEncoding";
import { rewriteBody } from "./body";
import { generateClientId } from "@/shared/util";
import { Tap } from "@/Tap";
import { rewriteRequestHeaders, rewriteResponseHeaders } from "./headers";

export async function doHandleFetch(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest
): Promise<ScramjetFetchResponse> {
	const parsed = parseRequest(request, handler);

	if (isBlobOrDataUrl(parsed.url)) {
		return handleBlobOrDataUrlFetch(handler, request, parsed);
	}

	const newheaders = rewriteRequestHeaders(request, handler, parsed);

	let responseBody: BodyType;
	let response = await doNetworkFetch(handler, request, parsed, newheaders);

	// set-cookie needs to take the raw headers. after this, we can flatten the headers into a ScramjetHeaders object
	await handleCookies(handler, request, parsed, response.rawHeaders);

	if (isDocument(request)) {
		// for document.referer
		parsed.trackedClient.history.push({
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
		const location = new URL(responseHeaders.get("location"));
		const referer = newheaders.get("Referer");
		// when going through a redirect, we need to hold on to the original referer, because it can change origins during a redirect
		// easiest way of accomplishing this is just tacking on an extra query parameter that's read below
		location.searchParams.set("rfs", referer ?? "");
		responseHeaders.set("location", location.href);

		// ensure that ?type=module is not lost in a redirect
		if (parsed.scriptType === "module") {
			const url = new URL(responseHeaders.get("location"));
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

	let respcontext: typeof handler.hooks.fetch.response.context = {
		request,
		parsed,
	};
	let respprops: typeof handler.hooks.fetch.response.props = {
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

	let reqcontext: typeof handler.hooks.fetch.request.context = {
		client: handler.client,
		request,
		parsed,
	};
	let reqprops: typeof handler.hooks.fetch.request.props = {
		init,
		url: parsed.url,
	};
	await Tap.dispatch(handler.hooks.fetch.request, reqcontext, reqprops);
	let earlyResponse: BareResponse;

	if (reqprops.earlyResponse) {
		let resp = reqprops.earlyResponse;
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

	let prerespcontext: typeof handler.hooks.fetch.preresponse.context = {
		request,
		parsed,
	};

	let prerespprops: typeof handler.hooks.fetch.preresponse.props = {
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
	const strippedUrl = new URL(request.rawUrl.href);
	const extraParams: Record<string, string> = {};

	let scriptType: "module" | "regular" = "regular";
	let topFrameName: string | undefined;
	let parentFrameName: string | undefined;
	let clientId: string | undefined;
	let referrerPolicy: string | undefined;
	let referrerSourceUrl: URL | null | undefined;
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
			case "cid":
				clientId = value;
				break;
			case "rfp":
				referrerPolicy = value;
				break;
			case "rfs":
				referrerSourceUrl = value ? new URL(value) : null;
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

	let documentFetch =
		request.destination === "document" || request.destination === "iframe";
	if (!clientId) {
		if (
			!documentFetch &&
			(url.protocol === "https:" || url.protocol === "http:")
		) {
			console.error(
				`no clientId provided for non-document/iframe fetch: ${request.rawUrl.href}`
			);
		}

		clientId = generateClientId();
		let client = new ScramjetFetchTrackedClient(clientId);
		handler.trackedClients.set(clientId, client);
	}

	// TODO: figure out what origin and base actually mean
	const meta: URLMeta = {
		origin: url,
		base: url,
		topFrameName,
		parentFrameName,
		clientId,
		referrerPolicy: referrerPolicy,
	};

	const parsed: ScramjetFetchParsed = {
		meta,
		url,
		scriptType,
		referrerPolicy,
		referrerSourceUrl,
		trackedClient: clientId ? handler.trackedClients.get(clientId) : undefined,
	};

	if (request.rawClientUrl) {
		// TODO: probably need to make a meta for it
		parsed.clientUrl = new URL(
			unrewriteUrl(request.rawClientUrl, handler.context)
		);
	}

	return parsed;
}

function isBlobOrDataUrl(url: URL): boolean {
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
