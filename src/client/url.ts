import { encodeUrl } from "../shared/rewriters/url";
export const URL = globalThis.URL;

if (globalThis.window) {
    window.URL = new Proxy(URL, {
        construct(target, argArray, newTarget) {
            if (typeof argArray[0] === "string") argArray[0] = encodeUrl(argArray[0]);
            if (typeof argArray[1] === "string") argArray[1] = encodeUrl(argArray[1]);

            return Reflect.construct(target, argArray, newTarget);
        },
    })
}
