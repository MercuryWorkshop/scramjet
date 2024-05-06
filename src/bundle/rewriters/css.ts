import { encodeUrl } from "./url"

export function rewriteCss(css: string, origin?: string) {
    css = css.replace(/(?<=url\("?'?)[^"'][\S]*[^"'](?="?'?\);?)/g, (match) => encodeUrl(match, origin));

    return "/* intercepted by scramjet 🐳 */" + css;
}