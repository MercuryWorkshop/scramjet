importScripts("/scramjet.codecs.js");
importScripts("/scramjet.config.js");
importScripts("/scramjet.bundle.js");
import { BareClient } from "@tomphttp/bare-client";

declare global {
    interface Window {
        ScramjetServiceWorker: any;
    }
}

self.ScramjetServiceWorker = class ScramjetServiceWorker {
    client: typeof BareClient.prototype;

    constructor() {
        this.client = new BareClient(location.origin + self.__scramjet$config.bareServer);
    }

    async fetch(event: FetchEvent) {
        const url = new URL(self.__scramjet$bundle.rewriters.url.decodeUrl(event.request.url));

        self.__scramjet$bundle.rewriters.rewriteHeaders(event.request.headers)

        // implement header rewriting later
        const response = await this.client.fetch(url, {
            method: event.request.method,
            body: event.request.body,
            headers: event.request.headers
        });

        self.__scramjet$bundle.rewriters.rewriteHeaders(response.headers);

        let responseBody;

        if (event.request.destination === "document") {
            responseBody = self.__scramjet$bundle.rewriters.rewriteHtml(await response.text(), url.origin);
        } else if (event.request.destination === "style") {
            responseBody = self.__scramjet$bundle.rewriters.rewriteCss(await response.text(), url.origin);
        } else if (event.request.destination === "script") {
            responseBody = self.__scramjet$bundle.rewriters.rewriteJs(await response.text(), url.origin);
        } else {
            responseBody = response.body;
        }

        return new Response(responseBody, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
        })
    }
}
