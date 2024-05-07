importScripts("./scramjet.codecs.js");
importScripts("./scramjet.config.js");
importScripts("./scramjet.worker.js");
importScripts("./bare-client.js")

const scramjet = new ScramjetServiceWorker();

self.addEventListener("fetch", async (event) => {
    event.respondWith((async() => {
        if (event.request.url.startsWith(location.origin + __scramjet$config.prefix)) {
            return await scramjet.fetch(event);
        } else {
            return await fetch(event.request);
        }
    })())
}) 