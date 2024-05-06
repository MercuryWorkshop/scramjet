import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteHtml } from "./rewriters/html";

const bundle = {
    rewriters: {
        url: {
            encodeUrl, decodeUrl
        },
        rewriteCss,
        rewriteHtml
    }
}

declare global {
    interface Window {
        __scramjet$bundle: typeof bundle;
    }
}

self.__scramjet$bundle = bundle;