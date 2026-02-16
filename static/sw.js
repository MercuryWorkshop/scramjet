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

scramjet.addEventListener("request", (e) => {
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
	} else {
		return;
	}
});
