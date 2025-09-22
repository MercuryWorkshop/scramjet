/// <reference types="@mercuryworkshop/scramjet" />
importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
	await scramjet.loadConfig();
	if (scramjet.route(event)) {
		return scramjet.fetch(event);
	}

	return fetch(event.request);
}

self.addEventListener("install", () => {
	self.skipWaiting();
});
self.addEventListener("activate", (e) => {
	e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

let playgroundData;
self.addEventListener("message", ({ data }) => {
	if (data.type === "playgroundData") {
		playgroundData = data;
	}
});

let reqid = 0;
scramjet.addEventListener("request", (e) => {
	if (e.url.href.startsWith("https://fake-devtools.invalid")) {
		// route the fake origin devtools requests to the local static files
		e.response = (async () => {
			let response = await fetch(e.url.pathname);

			let rawHeaders = {};
			for (const [key, value] of response.headers.entries()) {
				rawHeaders[key.toLowerCase()] = value;
			}
			response.rawHeaders = rawHeaders;
			response.rawResponse = {
				body: response.body,
				headers: rawHeaders,
				status: response.status,
				statusText: response.statusText,
			};
			response.finalURL = e.url.toString();
			return response;
		})();
	} else if (playgroundData && e.url.href.startsWith(playgroundData.origin)) {
		const headers = {};
		const origin = playgroundData.origin;
		if (e.url.href === origin + "/") {
			headers["content-type"] = "text/html";
			e.response = new Response(playgroundData.html, {
				headers,
			});
		} else if (e.url.href === origin + "/style.css") {
			headers["content-type"] = "text/css";
			e.response = new Response(playgroundData.css, {
				headers,
			});
		} else if (e.url.href === origin + "/script.js") {
			headers["content-type"] = "application/javascript";
			e.response = new Response(playgroundData.js, {
				headers,
			});
		} else {
			e.response = new Response("empty response", {
				headers,
			});
		}
		e.response.rawHeaders = headers;
		e.response.rawResponse = {
			body: e.response.body,
			headers: headers,
			status: e.response.status,
			statusText: e.response.statusText,
		};
		e.response.finalURL = e.url.toString();
	} else {
		if (!e.client) {
			console.warn("dropped req", e.url);
			return;
		}
		e.response = (async () => {
			let fetchBody = e.body;

			let id = reqid++;

			if (e.body && e.body instanceof ReadableStream) {
				const [tee1, tee2] = e.body.tee();
				fetchBody = tee1;

				const requestData = {
					type: "scramjet-request",
					data: {
						url: e.url.href,
						method: e.method,
						requestHeaders: e.requestHeaders,
						destination: e.destination,
						timestamp: Date.now(),
						payload: tee2,
						id,
					},
				};

				e.client.postMessage(requestData, [tee2]);
			} else {
				const requestData = {
					type: "scramjet-request",
					data: {
						url: e.url.href,
						method: e.method,
						requestHeaders: e.requestHeaders,
						destination: e.destination,
						timestamp: Date.now(),
						payload: typeof e.body === "string" ? e.body : null,
						id,
					},
				};
				e.client.postMessage(requestData);
			}

			let resp = await e.currentTarget.client.fetch(e.url, {
				method: e.method,
				body: fetchBody,
				headers: e.requestHeaders,
				credentials: "omit",
				mode: e.mode === "cors" ? e.mode : "same-origin",
				cache: e.cache,
				redirect: "manual",
				duplex: "half",
			});

			if (resp.body && resp.body instanceof ReadableStream) {
				const [tee1, tee2] = resp.body.tee();

				let newresp = new Response(tee1, {
					status: resp.status,
					statusText: resp.statusText,
					headers: resp.headers,
				});
				newresp.rawHeaders = resp.rawHeaders;
				newresp.rawResponse = {
					body: resp.body,
					headers: resp.rawHeaders,
				};
				newresp.finalURL = resp.url;

				const responseData = {
					type: "scramjet-response",
					data: {
						url: e.url.href,
						status: resp.status,
						body: tee2,
						responseHeaders: Object.fromEntries(resp.headers.entries()),
						timestamp: Date.now(),
						id,
					},
				};
				resp = newresp;

				e.client.postMessage(responseData, [tee2]);
			} else {
				const responseData = {
					type: "scramjet-response",
					data: {
						url: e.url.href,
						status: resp.status,
						responseHeaders: Object.fromEntries(resp.headers.entries()),
						timestamp: Date.now(),
						responseBody: resp.body,
						id,
					},
				};
				e.client.postMessage(responseData);
			}

			return resp;
		})();
	}
});
