import { enc, dec } from "./aes";

// for some reason eslint was parsing the type inside of the function params as a variable
export interface Codec {
    // eslint-disable-next-line
    encode: (str: string | undefined) => string;
    // eslint-disable-next-line
    decode: (str: string | undefined) => string;
}

const xor = {
    encode: (str: string | undefined, key: number = 2) => {
        if (!str) return str;

        return encodeURIComponent(str.split("").map((e, i) => i % key ? String.fromCharCode(e.charCodeAt(0) ^ key) : e).join(""));
    },
    decode: (str: string | undefined, key: number = 2) => {
        if (!str) return str;

        return decodeURIComponent(str).split("").map((e, i) => i % key ? String.fromCharCode(e.charCodeAt(0) ^ key) : e).join("");
    }
}

const plain = {
    encode: (str: string | undefined) => {
        if (!str) return str;

        return encodeURIComponent(str);
    },
    decode: (str: string | undefined) => {
        if (!str) return str;

        return decodeURIComponent(str);
    }
}

/*
const aes = {
    encode: (str: string | undefined) => {
        if (!str) return str;

        return encodeURIComponent(enc(str, "dynamic").substring(10));
    },
    decode: (str: string | undefined) => {
        if (!str) return str;

        return dec("U2FsdGVkX1" + decodeURIComponent(str), "dynamic");
    }
}
*/

const none = {
    encode: (str: string | undefined) => str,
    decode: (str: string | undefined) => str,
}

const base64 = {
    encode: (str: string | undefined) => {
        if (!str) return str;

        return decodeURIComponent(btoa(str));
    },
    decode: (str: string | undefined) => {
        if (!str) return str;

        return atob(str);
    }
}

declare global {
    interface Window {
        __scramjet$codecs: {
            none: Codec;
            plain: Codec;
            base64: Codec;
            xor: Codec;
        }
    }
}

self.__scramjet$codecs = {
    none, plain, base64, xor
}