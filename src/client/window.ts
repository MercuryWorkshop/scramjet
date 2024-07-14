import { locationProxy } from "./location";

export const windowProxy = new Proxy(window, {
    get(target, prop) {
        const propIsString = typeof prop === "string";
        if (propIsString && prop === "location") {
            return locationProxy;
        } else if (propIsString && ["window", "top", "parent", "self", "globalThis"].includes(prop)) {
            return windowProxy;
        } else if (propIsString && prop === "$scramjet") {
            return;
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
