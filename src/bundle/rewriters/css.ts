import { encodeUrl } from "./url";

export function rewriteCss(css: string, origin?: URL) {
    css = css.replace(/(?<=url\("?'?)[^"'][\S]*[^"'](?="?'?\);?)/gm, (match) => encodeUrl(match, origin));
    //painful regex simulator
    css = css.replace(/@import\s+(['"])?([^'"\);]+)\1?\s*(?:;|$)/gm, (match, quote, url) => {
        return `@import ${quote || ""}${encodeUrl(url.trim(), origin)}${quote || ""};`;  
    });
    return css;
    
}
