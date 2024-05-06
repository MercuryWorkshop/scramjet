import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteHtml, rewriteSrcset } from "./rewriters/html";
import { rewriteJs } from "./rewriters/js";

const bundle = {
    rewriters: {
        url: {
            encodeUrl, decodeUrl
        },
        rewriteCss,
        rewriteHtml,
        rewriteSrcset,
        rewriteJs
    }
}

declare global {
    interface Window {
        __scramjet$bundle: typeof bundle;
    }
}

self.__scramjet$bundle = bundle;