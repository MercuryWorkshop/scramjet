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
} from ".";
import { rewriteUrl, unrewriteBlob, unrewriteUrl } from "@rewriters/url";
import { QP, parseRequest } from "./parse";
import { ScramjetHeaders } from "@/shared";
import { isDocument, isRedirect, normalizeContentType } from "./util";
import { rewriteBody } from "./body";
import { Tap } from "@/Tap";
import {
	computeFetchSite,
	rewriteRequestHeaders,
	rewriteResponseHeaders,
	worstFetchSite,
} from "./headers";
import { _URL } from "@/shared/snapshot";

export async function doHandleFetch(
	handler: ScramjetFetchHandler,
	request: ScramjetFetchRequest
): Promise<ScramjetFetchResponse> {
	const parsed = parseRequest(request, handler);

	if (isBlobOrDataUrl(parsed.url)) {
		return handleBlobOrDataUrlFetch(handler, request, parsed);
	}

	const interceptCtx: typeof handler.hooks.fetch.intercept.context = {
		request,
		parsed,
	};
	const interceptProps: typeof handler.hooks.fetch.intercept.props = {};
	await Tap.dispatch(
		handler.hooks.fetch.intercept,
		interceptCtx,
		interceptProps
	);
	if (interceptProps.response) {
		return interceptProps.response;
	}

	if (parsed.hadExtraParams && isDocument(parsed)) {
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

	if (isDocument(parsed)) {
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

		// Compute the page (initiator) URL once. The initiator never changes
		// through a redirect chain, so prefer the propagated `sj$io` value if
		// the chain has already started; otherwise fall back to rawClientUrl
		// or rawReferrer (which point at the page for the *first* hop).
		let initiatorOriginUrl: URL | undefined;
		if (parsed.fetchInitiatorOrigin) {
			try {
				initiatorOriginUrl = new URL(parsed.fetchInitiatorOrigin);
			} catch {
				initiatorOriginUrl = undefined;
			}
		}
		if (!initiatorOriginUrl) {
			const rawClient =
				request.rawClientUrl ||
				(request.rawReferrer ? new URL(request.rawReferrer) : undefined);
			initiatorOriginUrl =
				rawClient &&
				rawClient.pathname.startsWith(handler.context.prefix.pathname)
					? new URL(unrewriteUrl(rawClient, handler.context))
					: undefined;
		}

		// Cross-site redirect poisoning (SameSite): if this hop was cross-site, or a
		// previous hop already was, propagate the flag so the final destination
		// enforces cross-site SameSite restrictions.
		const crossSiteRedirect =
			parsed.crossSiteRedirect ||
			(!!initiatorOriginUrl &&
				registrableDomainForRedirect(initiatorOriginUrl.hostname) !==
					registrableDomainForRedirect(parsed.url.hostname));

		// Sec-Fetch-Site chain state: combine the worst classification seen so
		// far with the relation between the initiator and *this* hop's URL.
		// Once "cross-site" appears, it sticks for the rest of the chain.
		let propagatedFetchSite: "same-site" | "cross-site" | undefined;
		if (initiatorOriginUrl) {
			const hopSite = computeFetchSite(initiatorOriginUrl, parsed.url);
			const propagated = parsed.fetchSiteState
				? worstFetchSite(parsed.fetchSiteState, hopSite)
				: hopSite;
			if (propagated !== "same-origin" && propagated !== "none") {
				propagatedFetchSite = propagated;
			}
		}

		location.searchParams.set(QP.referrerSource, referer ?? "");
		if (crossSiteRedirect) location.searchParams.set(QP.crossSiteRedirect, "1");
		if (propagatedFetchSite)
			location.searchParams.set(QP.fetchSite, propagatedFetchSite);
		if (initiatorOriginUrl)
			location.searchParams.set(QP.initiatorOrigin, initiatorOriginUrl.origin);
		if (parsed.isModule) location.searchParams.set(QP.isModule, "module");

		responseHeaders.set("location", location.href);
	}

	if (response.body && !isRedirect(response)) {
		responseBody = await rewriteBody(handler, request, parsed, response);

		// After rewriting HTML, the body is a JS string which will be encoded as
		// UTF-8 by the Response constructor. Normalize the Content-Type charset so
		// the browser doesn't try to decode UTF-8 bytes with the original encoding.
		normalizeContentType(parsed, responseHeaders);
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
	normalizeContentType(parsed, headers);

	if (handler.crossOriginIsolated) {
		headers.set("Cross-Origin-Opener-Policy", "same-origin");
		headers.set("Cross-Origin-Embedder-Policy", "require-corp");
	}

	if (parsed.isFakeDataURL) URL.revokeObjectURL(dataUrl);

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
		destination: parsed.destination,
	});
}
