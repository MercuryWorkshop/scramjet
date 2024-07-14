export { encodeUrl, decodeUrl } from "./rewriters/url";
export { rewriteCss } from "./rewriters/css";
export { rewriteHtml, rewriteSrcset } from "./rewriters/html";
export { rewriteJs } from "./rewriters/js";
export { rewriteHeaders } from "./rewriters/headers";
export { BareClient } from "@mercuryworkshop/bare-mux"

export function isScramjetFile(src: string) {
    let bool = false;
    ["codecs", "client", "shared", "worker", "config"].forEach((file) => {
        if (src === self.__scramjet$config[file]) bool = true;
    });

    return bool;
}