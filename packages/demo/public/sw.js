importScripts("/assets/core.sw.js");

addEventListener("fetch", (e) => {
	if ($akController.shouldRoute(e)) {
		e.respondWith($akController.route(e));
	}
});
