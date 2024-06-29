importScripts("scramjet.codecs.js");
importScripts("scramjet.config.js");
importScripts( __scramjet$config.bundle || "scramjet.bundle.js")
importScripts( __scramjet$config.worker || "scramjet.worker.js");
importScripts("bare-client.js")
importScripts("curl-client.js")
importScripts("epoxy-client.js")

let scramjet = null;

const parseStringCodecIntoFunction = (codec) => {
    const encode = eval(codec.encode);
    const decode = eval(codec.decode);

    return { encode, decode }
}

const configHandler = async (event) => {
    const { data } = event;
    if (data.type !== "config") return

    const { codecs } = data;
    for (const codec in codecs) {
        codecs[codec] = parseStringCodecIntoFunction(codecs[codec]);
    }

    scramjet = new ScramjetServiceWorker(data.config, codecs);

    self.removeEventListener("message", configHandler);
}

self.addEventListener("message", configHandler)

self.addEventListener("fetch", async (event) => {
    if (!scramjet) return
    const handleResponse = async() => scramjet.route(event) ? await scramjet.fetch(event) : await fetch(event.request)
    event.respondWith(handleResponse());
})