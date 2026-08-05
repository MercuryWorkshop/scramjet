importScripts("/controller/controller.sw.js");

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

addEventListener("fetch", (e) => {
	if ($akController.shouldRoute(e)) {
		e.respondWith($akController.route(e));
	}
});
