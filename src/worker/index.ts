import { BareClient } from "@mercuryworkshop/bare-mux";
import { BareResponseFetch } from "@mercuryworkshop/bare-mux"

declare global {
    interface Window {
        ScramjetServiceWorker;
    }
}

self.ScramjetServiceWorker = class ScramjetServiceWorker {
    client: typeof BareClient.prototype;
    config: typeof self.__scramjet$config;
    constructor(config = self.__scramjet$config) {
        this.client = new BareClient();
        if (!config.prefix) config.prefix = "/scramjet/";
        this.config = config;
    }

    route({ request }: FetchEvent) {
        if (request.url.startsWith(location.origin + this.config.prefix)) return true;
        else return false;
    }

    async fetch({ request }: FetchEvent) {
        try {
            const url = new URL(self.__scramjet$bundle.rewriters.url.decodeUrl(request.url));

            const response: BareResponseFetch = await this.client.fetch(url, {
                method: request.method,
                body: request.body,
                headers: request.headers,
                credentials: "omit",
                mode: request.mode === "cors" ? request.mode : "same-origin",
                cache: request.cache,
                redirect: request.redirect,
            });

            let responseBody;
            const responseHeaders = self.__scramjet$bundle.rewriters.rewriteHeaders(response.rawHeaders, origin);
            if (response.body) {
                switch (request.destination) {
                case "iframe":
                case "document":
                    responseBody = self.__scramjet$bundle.rewriters.rewriteHtml(await response.text(), url.origin);
                    break;
                case "script":
                    responseBody = self.__scramjet$bundle.rewriters.rewriteJs(await response.text(), url.origin);
                    break;
                case "style":
                    responseBody = self.__scramjet$bundle.rewriters.rewriteCss(await response.text(), url.origin);
                    break;
                case "sharedworker":
                    break;
                case "worker":
                    break;
                default:
                    responseBody = response.body;
                    break;
                }
            }
            
            if (responseHeaders["accept"] === "text/event-stream") {
                responseHeaders["content-type"] = "text/event-stream";
            }
            if (crossOriginIsolated) {
                responseHeaders["Cross-Origin-Embedder-Policy"] = "require-corp";
            }

            return new Response(responseBody, {
                headers: responseHeaders as HeadersInit,
                status: response.status,
                statusText: response.statusText
            })
        } catch (err) {
            if (!["document", "iframe"].includes(request.destination))
                return new Response(undefined, { status: 500 });

            console.error(err);
        }
    }
}
