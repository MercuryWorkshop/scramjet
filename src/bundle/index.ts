import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteHtml, rewriteSrcset } from "./rewriters/html";
import { rewriteJs } from "./rewriters/js";
import { rewriteHeaders } from "./rewriters/headers";

export function isScramjetFile(src: string) {
    let bool = false;
    ["codecs", "client", "bundle", "worker", "config"].forEach((file) => {
        if (src === self.__scramjet$config[file]) bool = true;
    });

    return bool;
}

const bundle = {
    rewriters: {
        url: {
            encodeUrl, decodeUrl
        },
        rewriteCss,
        rewriteHtml,
        rewriteSrcset,
        rewriteJs,
        rewriteHeaders
    },
    isScramjetFile
}

declare global {
    interface Window {
        __scramjet$bundle: typeof bundle;
    }
}

self.__scramjet$bundle = bundle;