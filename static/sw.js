import ScramjetServiceWorker from "/scram/scramjet.worker.js";
import "/scram/scramjet.codecs.js";
import "/scram/scramjet.config.js";

const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
    if (scramjet.route(event)) {
        return scramjet.fetch(event);
    }

    return fetch(event.request)
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});