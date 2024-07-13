import { Codec } from "./codecs";

declare global {
    interface Window {
        __scramjet$config: {
            prefix: string;
            codec: Codec
            config: string;
            bundle: string;
            worker: string;
            client: string;
            codecs: string;
        }
    }
}

self.__scramjet$config = {
    prefix: "/scramjet/",
    codec: self.__scramjet$codecs.plain,
    config: "/scramjet.config.js",
    bundle: "/scramjet.bundle.js",
    worker: "/scramjet.worker.js",
    client: "/scramjet.client.js",
    codecs: "/scramjet.codecs.js"
}