import { rewriteJs } from "../shared";

const FunctionProxy = new Proxy(Function, {
    construct(target, argArray) {
        if (argArray.length === 1) {
            return Reflect.construct(target, rewriteJs(argArray[0]));
        } else {
            return Reflect.construct(target, rewriteJs(argArray[argArray.length - 1]))
        }
    },
    apply(target, thisArg, argArray) {
        if (argArray.length === 1) {
            return Reflect.apply(target, undefined, [rewriteJs(argArray[0])]);
        } else {
            return Reflect.apply(target, undefined, [...argArray.map((x, index) => index === argArray.length - 1), rewriteJs(argArray[argArray.length - 1])])
        }
    },
});

delete window.Function;

window.Function = FunctionProxy;

window.eval  = new Proxy(window.eval, {
    apply(target, thisArg, argArray) {
        return Reflect.apply(target, thisArg, [rewriteJs(argArray[0])]);
    },
})