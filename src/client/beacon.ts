import { encodeUrl } from "../bundle";

navigator.sendBeacon = new Proxy(navigator.sendBeacon, {
    apply(target, thisArg, argArray) {
        argArray[0] = encodeUrl(argArray[0]);

        return Reflect.apply(target, thisArg, argArray);
    },
});