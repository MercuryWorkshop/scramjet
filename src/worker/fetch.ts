import { BareResponseFetch } from "@mercuryworkshop/bare-mux";
import IDBMap from "@webreflection/idb-map";
import { ParseResultType } from "parse-domain";
import { ScramjetServiceWorker } from ".";
import { renderError } from "./error";

export async function swfetch(
	this: ScramjetServiceWorker,
	{ request }: FetchEvent
) {
	const urlParam = new URLSearchParams(new URL(request.url).search);
	const { encodeUrl, decodeUrl } = self.$scramjet.shared.url;
	const { rewriteHeaders, rewriteHtml, rewriteJs, rewriteCss, rewriteWorkers } =
		self.$scramjet.shared.rewrite;
	const { parseDomain } = self.$scramjet.shared.util;

	if (urlParam.has("url")) {
		return Response.redirect(
			encodeUrl(urlParam.get("url"), new URL(urlParam.get("url")))
		);
	}

	try {
		const url = new URL(decodeUrl(request.url));

		const cookieStore = new IDBMap(url.host, {
			durability: "relaxed",
			prefix: "Cookies",
		});

		const response: BareResponseFetch = await this.client.fetch(url, {
			method: request.method,
			body: request.body,
			headers: request.headers,
			credentials: "omit",
			mode: request.mode === "cors" ? request.mode : "same-origin",
			cache: request.cache,
			redirect: request.redirect,
			//@ts-ignore why the fuck is this not typed mircosoft
			duplex: "half",
		});

		let responseBody;
		const responseHeaders = rewriteHeaders(response.rawHeaders, url);

		for (const cookie of (responseHeaders["set-cookie"] || []) as string[]) {
			let cookieParsed = cookie.split(";").map((x) => x.trim().split("="));

			let [key, value] = cookieParsed.shift();
			if (!value) continue;
			value = value.replace('"', "");

			const hostArg = cookieParsed.find((x) => x[0] === "Domain");
			cookieParsed = cookieParsed.filter((x) => x[0] !== "Domain");
			let host = hostArg ? hostArg[1] : undefined;

			if (url.protocol === "http" && cookieParsed.includes(["Secure"]))
				continue;
			if (
				cookieParsed.includes(["SameSite", "None"]) &&
				!cookieParsed.includes(["Secure"])
			)
				continue;

			if (host && host !== url.host) {
				if (host.startsWith(".")) host = host.slice(1);
				const urlDomain = parseDomain(url.hostname);

				if (urlDomain.type === ParseResultType.Listed) {
					const { subDomains: domain, topLevelDomains } = urlDomain;
					if (!host.endsWith([domain, ...topLevelDomains].join("."))) continue;
				} else {
					continue;
				}

				const realCookieStore = new IDBMap(host, {
					durability: "relaxed",
					prefix: "Cookies",
				});
				realCookieStore.set(key, {
					value: value,
					args: cookieParsed,
					subdomain: true,
				});
			} else {
				cookieStore.set(key, {
					value: value,
					args: cookieParsed,
					subdomain: false,
				});
			}
		}

		for (const header in responseHeaders) {
			// flatten everything past here
			if (Array.isArray(responseHeaders[header]))
				responseHeaders[header] = responseHeaders[header][0];
		}

		if (response.body) {
			switch (request.destination) {
				case "iframe":
				case "document":
					if (
						responseHeaders["content-type"]?.toString()?.startsWith("text/html")
					) {
						responseBody = rewriteHtml(await response.text(), url);
					} else {
						responseBody = response.body;
					}
					break;
				case "script":
					responseBody = rewriteJs(await response.arrayBuffer(), url);
					// Disable threading for now, it's causing issues.
					// responseBody = await this.threadpool.rewriteJs(responseBody, url.toString());
					break;
				case "style":
					responseBody = rewriteCss(await response.text(), url);
					break;
				case "sharedworker":
				case "worker":
					responseBody = rewriteWorkers(await response.text(), url);
					break;
				default:
					responseBody = response.body;
					break;
			}
		}
		// downloads
		if (["document", "iframe"].includes(request.destination)) {
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
		if (crossOriginIsolated) {
			responseHeaders["Cross-Origin-Embedder-Policy"] = "require-corp";
		}

		return new Response(responseBody, {
			headers: responseHeaders as HeadersInit,
			status: response.status,
			statusText: response.statusText,
		});
	} catch (err) {
		console.error("ERROR FROM SERVICE WORKER FETCH", err);
		if (!["document", "iframe"].includes(request.destination))
			return new Response(undefined, { status: 500 });

		return renderError(err, decodeUrl(request.url));
	}
}
