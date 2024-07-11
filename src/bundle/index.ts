import { encodeUrl, decodeUrl } from "./rewriters/url";
import { rewriteCss } from "./rewriters/css";
import { rewriteSrcset } from "./rewriters/srcset";
import { rewriteJs } from "./rewriters/js";
import { rewriteHeaders } from "./rewriters/headers";

export function isScramjetFile(src: string) {
    let bool = false;
    ["codecs", "client", "bundle", "worker", "config"].forEach((file) => {
        if (src === self.__scramjet$config[file]) bool = true;
    });

    return bool;
}

export { encodeUrl, decodeUrl, rewriteCss, rewriteSrcset, rewriteJs, rewriteHeaders };