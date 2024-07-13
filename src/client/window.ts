const windowProxy = new Proxy(window, {
    get(target, prop) {
        const propIsString = typeof prop === "string";
        if (propIsString && prop === "location") {
            return target.__location;
        } else if (propIsString && ["window", "top", "parent", "self", "globalThis"].includes(prop)) {
            return target.__window;
        }

        return target[prop];
    },

    set(target, p, newValue, receiver) {
        return Reflect.set(target, p, newValue, receiver);
    },
});

window.__window = windowProxy;