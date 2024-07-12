import ScramjetServiceWorker from "./scramjet.worker.js";
import "./scramjet.codecs.js";
import "./scramjet.config.js";

const scramjet = new ScramjetServiceWorker();

self.addEventListener("fetch", async (event) => {
    event.respondWith((async() => {
        if (scramjet.route(event)) {
            return await scramjet.fetch(event);
        } else {
            return await fetch(event.request);
        }
    })())
});