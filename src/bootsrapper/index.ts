import IDBMap from "idb-map-entries";
import { ScramjetConfig } from "../types";
import { Codec } from "../codecs";

export class ScramjetBootstrapper {
    config: ScramjetConfig;
    private store: IDBMap;
    codec: Codec;

    constructor(config: ScramjetConfig) {
        const defaultConfig = {
            prefix: "/scramjet/",
            codec: "plain",
            wrapfn: "$scramjet$wrap",
            trysetfn: "$scramjet$tryset",
            importfn: "$scramjet$import",
            rewritefn: "$scramjet$rewrite",
            shared: "/scramjet.shared.js",
            worker: "/scramjet.worker.js",
            thread: "/scramjet.thread.js",
            client: "/scramjet.client.js",
            codecs: "/scramjet.codecs.js",
        }

        this.config = Object.assign({}, defaultConfig, config);

        // rspack won't let me use a dynamic import
        fetch(config.codecs).then(async (response) => {
            eval(await response.text());

            self.$scramjet.codec = self.$scramjet.codecs[this.config.codec];
            self.$scramjet.config = this.config;
        });

        console.log(this.config);
        this.store = new IDBMap("config", {
            prefix: "scramjet"
        });
        this.saveConfig();
    }

    registerSw(serviceWorkerPath: string) {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register(serviceWorkerPath, {
                    scope: this.config.prefix
                })
                .then((registration) => {
                    console.log("ServiceWorker registration successful with scope: ", registration.scope);
                })
                .catch((err) => {
                    console.log("ServiceWorker registration failed: ", err);
                });
        }
    }

    saveConfig() {
        this.store.set("config", this.config).then(() => {
            console.log("scramjet config saved");
        });
    }

    modifyConfig(config: ScramjetConfig) {
        this.config = Object.assign({}, this.config, config);

        this.saveConfig();
    }
}

window.ScramjetBootstrapper = ScramjetBootstrapper;