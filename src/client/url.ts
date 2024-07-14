import { encodeUrl } from "../shared/rewriters/url";

URL = new Proxy(URL, {
    construct(target, argArray, newTarget) {
        if (typeof argArray[0] === "string") argArray[0] = encodeUrl(argArray[0]);

        return Reflect.construct(target, argArray, newTarget);
    },
})