import { rewriteHtml, rewriteJs, encodeUrl } from "./shared";

// @ts-expect-error
trustedTypes.createPolicy = new Proxy(trustedTypes.createPolicy, {
    apply(target, thisArg, argArray) {
        if (argArray[1].createHTML) {
            argArray[1].createHTML = new Proxy(argArray[1].createHTML, {
                apply(target1, thisArg1, argArray1) {
                    return rewriteHtml(target1(...argArray1));
                },
            });
        }

        if (argArray[1].createScript) {
            argArray[1].createScript = new Proxy(argArray[1].createScript, {
                apply(target1, thisArg1, argArray1) {
                    return rewriteJs(target1(...argArray1));
                },
            });
        }

        if (argArray[1].createScriptURL) {
            argArray[1].createScriptURL = new Proxy(argArray[1].createScriptURL, {
                apply(target1, thisArg1, argArray1) {
                    return encodeUrl(target1(...argArray1));
                },
            })
        }

        return Reflect.apply(target, thisArg, argArray);
    },
})