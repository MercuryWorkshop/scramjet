importScripts("scramjet.codecs.js");
importScripts("scramjet.config.js");
importScripts( __scramjet$config.bundle || "scramjet.bundle.js")
importScripts( __scramjet$config.worker || "scramjet.worker.js");

const scramjet = new ScramjetServiceWorker();

self.addEventListener("fetch", async (event) => {
    event.respondWith((async() => {
        if (scramjet.route(event)) {
            return await scramjet.fetch(event);
        } else {
            return await fetch(event.request);
        }
    })())
}) 