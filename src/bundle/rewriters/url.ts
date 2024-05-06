function canParseUrl(url: string, origin?: string) {
    if (URL.canParse) {
        console.log(URL.canParse(url, origin) + "\n" + url + "\n" + origin);

        return URL.canParse(url, origin);
    } else {
        try {
            new URL(url, origin);
    
            return true;
        } catch {
            return false;
        }
    }
}

// something is broken with this but i didn't debug it
export function encodeUrl(url: string, origin?: string) {
    // if (!origin) {
    //     origin = self.__scramjet$config.codec.decode(location.href.slice((location.origin + self.__scramjet$config.prefix).length));
    // }

    if (url.startsWith("javascript:")) {
        // implement when js rewriting is done
        return url;
    } else if (/^(#|mailto|about|data)/.test(url)) {
        return url;
    } else if (canParseUrl(url, origin)) {
        console.log(self.__scramjet$config.prefix + self.__scramjet$config.codec.encode(new URL(url, origin).href));

        return self.__scramjet$config.prefix + self.__scramjet$config.codec.encode(new URL(url, origin).href);
    }
}

// something is also broken with this but i didn't debug it
export function decodeUrl(url: string) {
    if (/^(#|about|data|mailto|javascript)/.test(url)) {
        return url;
    } else if (canParseUrl(url)) {
        return self.__scramjet$config.codec.decode(url.slice((location.origin + self.__scramjet$config.prefix).length))
    } else {
        return url;
    }
}