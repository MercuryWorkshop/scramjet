import { encodeUrl } from "./index";

navigator.sendBeacon = new Proxy(navigator.sendBeacon, {
    apply(target, thisArg, argArray) {
        argArray[0] = encodeUrl(argArray[0]);

        return Reflect.apply(target, thisArg, argArray);
    },
});