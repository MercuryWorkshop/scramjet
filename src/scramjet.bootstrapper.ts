import { Codec, Config, ConfigWithStringCodec } from "./types";

declare global {
    interface Window {
        Bootstrapper: typeof Bootstrapper;
    }
}

class Bootstrapper {
    private parsedConfig: Config;
    
    get config() {
        return this.parsedConfig;
    }
    set config(config: Config) {}

    private codecs: { [key: string]: {
        encode: string;
        decode: string;
    } } = {};
    private customCodecs: { [key: string]: Codec } = {};
    
    // eslint-disable-next-line no-unused-vars
    constructor(private _config: ConfigWithStringCodec, private readonly serviceWorkerUrl: string) {
        if (!_config) throw new Error("Config is required");
        if (!serviceWorkerUrl) throw new Error("Service worker URL is required");
    }

    private loadScript(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = () => resolve();
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    init() {
        (async () => {
            await this.loadScript(this._config.codecs);
            const sw = await navigator.serviceWorker.register(this.serviceWorkerUrl, { scope: this._config.prefix });

            this.parsedConfig = {
                ...this._config,
                codec: { ...self.__scramjet$codecs, ...this.customCodecs }[this._config.codec]
            }

            if (sw.active) {
                sw.active.postMessage({ type: "config", config: this._config, codecs: this.codecs });
            }
        })();
    }

    addCodec(name: string, codec: Codec) {
        this.codecs[name] = {
            encode: codec.encode.toString(),
            decode: codec.decode.toString()
        }
        this.customCodecs[name] = codec;
    }
}

window.Bootstrapper = Bootstrapper;