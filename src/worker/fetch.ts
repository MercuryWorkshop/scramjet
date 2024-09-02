import { BareResponseFetch } from "@mercuryworkshop/bare-mux";
import IDBMap from "@webreflection/idb-map";
import { ParseResultType } from "parse-domain";
import { MessageW2C, ScramjetServiceWorker } from ".";
import { renderError } from "./error";
import { FakeServiceWorker } from "./fakesw";
import { CookieStore } from "../shared/cookie";
import {
	ScramjetHeaders,
	decodeUrl,
	encodeUrl,
	rewriteCss,
	rewriteHeaders,
	rewriteHtml,
	rewriteJs,
	rewriteWorkers,
} from "../shared";

import type { URLMeta } from "../shared/rewriters/url";

function newmeta(url: URL): URLMeta {
	return {
		origin: url,
		base: url,
	};
}

export async function swfetch(
	this: ScramjetServiceWorker,
	request: Request,
	client: Client | null
) {
	const urlParam = new URLSearchParams(new URL(request.url).search);

	if (urlParam.has("url")) {
		return Response.redirect(
			encodeUrl(urlParam.get("url"), newmeta(new URL(urlParam.get("url"))))
		);
	}

	try {
		const requesturl = new URL(request.url);
		let workertype = "";
		if (requesturl.searchParams.has("type")) {
			workertype = requesturl.searchParams.get("type") as string;
			requesturl.searchParams.delete("type");
		}
		if (requesturl.searchParams.has("dest")) {
			requesturl.searchParams.delete("dest");
		}
		const url = new URL(decodeUrl(requesturl));

		const activeWorker: FakeServiceWorker | null = this.serviceWorkers.find(
			(w) => w.origin === url.origin
		);

		if (
			activeWorker &&
			activeWorker.connected &&
			urlParam.get("from") !== "swruntime"
		) {
			// TODO: check scope
			const r = await activeWorker.fetch(request);
			if (r) return r;
		}
		if (url.origin == new URL(request.url).origin) {
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
			new URL(client.url).pathname.startsWith(self.$scramjet.config.prefix)
		) {
			// TODO: i was against cors emulation but we might actually break stuff if we send full origin/referrer always
			const url = new URL(decodeUrl(client.url));
			headers.set("Referer", url.toString());
			headers.set("Origin", url.origin);
		}

		const cookies = this.cookieStore.getCookies(url, false);

		if (cookies.length) {
			headers.set("Cookie", cookies);
		}

		// TODO this is wrong somehow
		headers.set("Sec-Fetch-Mode", "cors");
		headers.set("Sec-Fetch-Site", "same-origin");
		headers.set("Sec-Fetch-Dest", "empty");

		const response: BareResponseFetch = await this.client.fetch(url, {
			method: request.method,
			body: request.body,
			headers: headers.headers,
			credentials: "omit",
			mode: request.mode === "cors" ? request.mode : "same-origin",
			cache: request.cache,
			redirect: "manual",
			//@ts-ignore why the fuck is this not typed mircosoft
			duplex: "half",
		});

		return await handleResponse(
			url,
			workertype,
			request.destination,
			response,
			this.cookieStore,
			client
		);
	} catch (err) {
		console.error("ERROR FROM SERVICE WORKER FETCH", err);
		if (!["document", "iframe"].includes(request.destination))
			return new Response(undefined, { status: 500 });

		return renderError(err, decodeUrl(request.url));
	}
}

async function handleResponse(
	url: URL,
	workertype: string,
	destination: RequestDestination,
	response: BareResponseFetch,
	cookieStore: CookieStore,
	client: Client
): Promise<Response> {
	let responseBody: string | ArrayBuffer | ReadableStream;
	const responseHeaders = rewriteHeaders(response.rawHeaders, newmeta(url));

	const maybeHeaders = responseHeaders["set-cookie"] || [];
	for (const cookie in maybeHeaders) {
		if (client)
			client.postMessage({
				scramjet$type: "cookie",
				cookie,
				url: url.href,
			} as MessageW2C);
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
		switch (destination) {
			case "iframe":
			case "document":
				if (responseHeaders["content-type"]?.startsWith("text/html")) {
					responseBody = rewriteHtml(
						await response.text(),
						cookieStore,
						newmeta(url),
						true
					);
				} else {
					responseBody = response.body;
				}
				break;
			case "script":
				responseBody = rewriteJs(await response.arrayBuffer(), newmeta(url));
				// Disable threading for now, it's causing issues.
				// responseBody = await this.threadpool.rewriteJs(await responseBody.arrayBuffer(), url.toString());
				break;
			case "style":
				responseBody = rewriteCss(await response.text(), newmeta(url));
				break;
			case "sharedworker":
			case "worker":
				responseBody = rewriteWorkers(
					await response.arrayBuffer(),
					workertype,
					newmeta(url)
				);
				break;
			default:
				responseBody = response.body;
				break;
		}
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

	if (crossOriginIsolated) {
		responseHeaders["Cross-Origin-Embedder-Policy"] = "require-corp";
	}

	return new Response(responseBody, {
		headers: responseHeaders as HeadersInit,
		status: response.status,
		statusText: response.statusText,
	});
}
