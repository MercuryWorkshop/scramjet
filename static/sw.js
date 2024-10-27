// dumb hack to allow firefox to work (please dont do this in prod)
if (navigator.userAgent.includes("Firefox")) {
	Object.defineProperty(globalThis, "crossOriginIsolated", {
		value: true,
		writable: false,
	});
}

importScripts(
	"/scram/scramjet.wasm.js",
	"/scram/scramjet.shared.js",
	"/scram/scramjet.worker.js"
);

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
	let headers = {};
	if (playgroundData && e.url.href === playgroundData.origin + "/") {
		headers["content-type"] = "text/html";
		e.response = new Response(playgroundData.html, {
			headers,
		});
	} else if (playgroundData && e.url.href === playgroundData.origin + "/style.css") {
		headers["content-type"] = "text/css";
		e.response = new Response(playgroundData.css, {
			headers,
		});
	} else if (playgroundData && e.url.href === playgroundData.origin + "/script.js") {
		headers["content-type"] = "application/javascript";
		e.response = new Response(playgroundData.js, {
			headers,
		});
	} else {
		return;
	}

	e.response.rawHeaders = headers;
	e.response.finalURL = e.url;
});
