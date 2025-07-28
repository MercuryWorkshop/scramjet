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

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

let playgroundData;
self.addEventListener("message", ({ data }) => {
	if (data.type === "playgroundData") {
		playgroundData = data;
	}
});

scramjet.addEventListener("request", (e) => {
	if (e.url.href.startsWith("https://fake-devtools.invalid")) {
		// route the fake origin devtools requests to the local static files
		e.response = (async () => {
			let response = await fetch("/chi/" + e.url.pathname);

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
		return;
	}
});
