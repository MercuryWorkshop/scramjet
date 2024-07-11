// ts throws an error if you dont do window.fetch

import { encodeUrl, rewriteHeaders } from "../bundle";

window.fetch = new Proxy(window.fetch, {
    apply(target, thisArg, argArray) {
        console.log(argArray);
        if (!(argArray[0] instanceof Request))  argArray[0] = encodeUrl(argArray[0]);
        console.log(argArray);

        return Reflect.apply(target, thisArg, argArray);
    },
});

Headers = new Proxy(Headers, {
    construct(target, argArray, newTarget) {
        argArray[0] = rewriteHeaders(argArray[0]);

        return Reflect.construct(target, argArray, newTarget);
    },
})

Request = new Proxy(Request, {
    construct(target, argArray, newTarget) {
        if (typeof argArray[0] === "string") argArray[0] = encodeUrl(argArray[0]);

        return Reflect.construct(target, argArray, newTarget);
    },
});

Response.redirect = new Proxy(Response.redirect, {
    apply(target, thisArg, argArray) {
        argArray[0] = encodeUrl(argArray[0]);

        return Reflect.apply(target, thisArg, argArray);
    },
});
