importScripts(
  "/scram/scramjet.codecs.js",
  "/scram/scramjet.config.js",
  "/scram/scramjet.shared.js",
  "/scram/scramjet.worker.js",
);

const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
  if (scramjet.route(event)) {
    return scramjet.fetch(event);
  }

  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
