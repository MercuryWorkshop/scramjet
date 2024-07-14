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

    set(target, prop, newValue) {
        // ensures that no apis are overwritten
        if (typeof prop === "string" && ["window", "top", "parent", "self", "globalThis", "location"].includes(prop)) {
            return false;
        }

        return Reflect.set(target, prop, newValue);
    },
});

window.__window = windowProxy;