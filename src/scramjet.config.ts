import { Codec } from "./codecs";

declare global {
    interface Window {
        __scramjet$config: {
            prefix: string;
            codec: Codec
            config: string;
            shared: string;
            worker: string;
            client: string;
            codecs: string;
        }
    }
}

self.__scramjet$config = {
    prefix: "/scramjet/",
    codec: self.__scramjet$codecs.plain,
    config: "/scram/scramjet.config.js",
    shared: "/scram/scramjet.shared.js",
    worker: "/scram/scramjet.worker.js",
    client: "/scram/scramjet.client.js",
    codecs: "/scram/scramjet.codecs.js"
}