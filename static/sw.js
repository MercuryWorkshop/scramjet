/// <reference path="../lib/index.d.ts" />

// dumb hack to allow firefox to work (please dont do this in prod)
if (navigator.userAgent.includes("Firefox")) {
	Object.defineProperty(globalThis, "crossOriginIsolated", {
		value: true,
		writable: false,
	});
}

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

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

let playgroundData;
self.addEventListener("message", ({ data }) => {
	if (data.type === "playgroundData") {
		playgroundData = data;
	}
});

// Function to forward data to inspector
async function forwardToInspector(data) {
	const clients = await self.clients.matchAll();
	const inspectorClient = clients.find((client) =>
		client.url.endsWith("/inspector.html")
	);

	if (inspectorClient) {
		inspectorClient.postMessage(data);
	}
}

// Listen to ScramjetRequestEvent
scramjet.addEventListener("request", async (e) => {
	e.response = (async () => {
		// Tee the request body if it exists
		let fetchBody = e.body;

		if (e.body && e.body instanceof ReadableStream) {
			const [tee1, tee2] = e.body.tee();
			fetchBody = tee1;

			// Forward request data to inspector with the second tee stream
			const requestData = {
				type: "scramjet-request",
				data: {
					url: e.url.href,
					method: e.method,
					requestHeaders: e.requestHeaders,
					destination: e.destination,
					timestamp: Date.now(),
					payload: tee2,
				},
			};

			// Send the second tee stream directly with transferStreams
			const clients = await self.clients.matchAll();
			const inspectorClient = clients.find((client) =>
				client.url.endsWith("/inspector.html")
			);

			if (inspectorClient) {
				inspectorClient.postMessage(requestData, [tee2]);
			}
		} else {
			// Forward request data to inspector without body
			const requestData = {
				type: "scramjet-request",
				data: {
					url: e.url.href,
					method: e.method,
					requestHeaders: e.requestHeaders,
					destination: e.destination,
					timestamp: Date.now(),
					payload: typeof e.body === "string" ? e.body : null,
				},
			};
			forwardToInspector(requestData);
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

		// Tee the response body if it exists
		if (resp.body && resp.body instanceof ReadableStream) {
			const [tee1, tee2] = resp.body.tee();
			// Update the response with the first tee
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

			// Forward response data to inspector with the second tee stream
			const responseData = {
				type: "scramjet-response",
				data: {
					url: e.url.href,
					status: resp.status,
					body: tee2,
					responseHeaders: Object.fromEntries(resp.headers.entries()),
					timestamp: Date.now(),
				},
			};
			resp = newresp;

			// Send the second tee stream directly with transferStreams
			const clients = await self.clients.matchAll();
			const inspectorClient = clients.find((client) =>
				client.url.endsWith("/inspector.html")
			);

			if (inspectorClient) {
				inspectorClient.postMessage(responseData, [tee2]);
			}
		} else {
			// Forward response data to inspector without body
			const responseData = {
				type: "scramjet-response",
				data: {
					url: e.url.href,
					status: resp.status,
					responseHeaders: Object.fromEntries(resp.headers.entries()),
					timestamp: Date.now(),
					responseBody: resp.body,
				},
			};
			forwardToInspector(responseData);
		}

		return resp;
	})();

	// Handle playground data
	if (playgroundData && e.url.href.startsWith(playgroundData.origin)) {
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
	}
});
