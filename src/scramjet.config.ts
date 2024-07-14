if (!self.$scramjet) {
    //@ts-expect-error really dumb workaround
    self.$scramjet = {}
}
self.$scramjet.config = {
    prefix: "/scramjet/",
    codec: self.$scramjet.codecs.plain,
    config: "/scram/scramjet.config.js",
    shared: "/scram/scramjet.shared.js",
    worker: "/scram/scramjet.worker.js",
    client: "/scram/scramjet.client.js",
    codecs: "/scram/scramjet.codecs.js"
}