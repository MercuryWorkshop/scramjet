import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteHtml, rewriteSrcset } from "./rewriters/html";
import { rewriteJs } from "./rewriters/js";
import { rewriteHeaders } from "./rewriters/headers";
import { rewriteWorkers } from "./rewriters/worker";
import { isScramjetFile } from "./rewriters/html";
import { BareClient } from "@mercuryworkshop/bare-mux";

declare global {
    interface Window {
        __scramjet$bundle: {
            encodeUrl: typeof encodeUrl;
            decodeUrl: typeof decodeUrl;
            rewriteCss: typeof rewriteCss;
            rewriteHtml: typeof rewriteHtml;
            rewriteSrcset: typeof rewriteSrcset;
            rewriteJs: typeof rewriteJs;
            rewriteHeaders: typeof rewriteHeaders;
            rewriteWorkers: typeof rewriteWorkers;
            BareClient: typeof BareClient;
            isScramjetFile: typeof isScramjetFile
        }
    }
}

self.__scramjet$bundle = {
    encodeUrl,
    decodeUrl,
    rewriteCss,
    rewriteHtml,
    rewriteSrcset,
    rewriteJs,
    rewriteHeaders,
    rewriteWorkers,
    isScramjetFile,
    BareClient
}