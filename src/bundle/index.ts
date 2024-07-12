export { encodeUrl, decodeUrl } from "./rewriters/url";
export { rewriteCss } from "./rewriters/css";
export { rewriteHtml, rewriteSrcset } from "./rewriters/html";
export { rewriteJs } from "./rewriters/js";
export { rewriteHeaders } from "./rewriters/headers";

export function isScramjetFile(src: string) {
    let bool = false;
    ["codecs", "client", "bundle", "worker", "config"].forEach((file) => {
        if (src === self.__scramjet$config[file]) bool = true;
    });

    return bool;
}