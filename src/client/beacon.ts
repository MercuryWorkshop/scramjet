navigator.sendBeacon = new Proxy(navigator.sendBeacon, {
    apply(target, thisArg, argArray) {
        argArray[0] = self.__scramjet$bundle.rewriters.url.encodeUrl(argArray[0]);

        return Reflect.apply(target, thisArg, argArray);
    },
});