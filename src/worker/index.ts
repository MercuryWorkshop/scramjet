importScripts("/scramjet.codecs.js");
importScripts("/scramjet.config.js");
importScripts("/scramjet.bundle.js");
import { BareClient } from "@mercuryworkshop/bare-mux";
import { BareResponseFetch } from "@tomphttp/bare-client"

declare global {
    interface Window {
        ScramjetServiceWorker: any;
    }
}

self.ScramjetServiceWorker = class ScramjetServiceWorker {
    client: typeof BareClient.prototype;

    constructor() {
        this.client = new BareClient();
    }

    async fetch(event: FetchEvent) {
        const url = new URL(self.__scramjet$bundle.rewriters.url.decodeUrl(event.request.url));

        // implement header rewriting later
        const response: BareResponseFetch = await this.client.fetch(url, {
            method: event.request.method,
            body: event.request.body,
            headers: event.request.headers
        });

        
        let responseBody;
        const responseHeaders = self.__scramjet$bundle.rewriters.rewriteHeaders(response.rawHeaders, origin);

        if (event.request.destination === "document") {
            responseBody = self.__scramjet$bundle.rewriters.rewriteHtml(await response.text(), url.origin);
        } else if (event.request.destination === "style") {
            responseBody = self.__scramjet$bundle.rewriters.rewriteCss(await response.text(), url.origin);
        } else if (event.request.destination === "script") {
            responseBody = self.__scramjet$bundle.rewriters.rewriteJs(await response.text(), url.origin);
        } else {
            responseBody = response.body;
        }
        
        // if (crossOriginIsolated) {
        //     response.headers["Cross-Origin-Embedder-Policy"] = "require-cors";
        // }

        return new Response(responseBody, {
            headers: responseHeaders as HeadersInit,
            status: response.status,
            statusText: response.statusText
        })
    }
}
