import { rewriteJs } from "./js";

function canParseUrl(url: string, origin?: URL) {
    try {
        new URL(url, origin);

        return true;
    } catch {
        return false;
    }
}

// something is broken with this but i didn't debug it
export function encodeUrl(url: string, origin?: URL) {
    if (!origin) {
        origin = new URL(self.$scramjet.config.codec.decode(location.href.slice((location.origin + self.$scramjet.config.prefix).length)));
    }

    if (url.startsWith("javascript:")) {
        return "javascript:" + rewriteJs(url.slice("javascript:".length));
    } else if (/^(#|mailto|about|data)/.test(url)) {
        return url;
    } else if (canParseUrl(url, origin)) {
        return location.origin + self.$scramjet.config.prefix + self.$scramjet.config.codec.encode(new URL(url, origin).href);
    }
}

// something is also broken with this but i didn't debug it
export function decodeUrl(url: string) {
    if (/^(#|about|data|mailto|javascript)/.test(url)) {
        return url;
    } else if (canParseUrl(url)) {
        return self.$scramjet.config.codec.decode(url.slice((location.origin + self.$scramjet.config.prefix).length))
    } else {
        return url;
    }
}