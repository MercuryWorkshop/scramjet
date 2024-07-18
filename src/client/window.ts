import { encodeUrl } from "../shared/rewriters/url";
import { locationProxy } from "./location";

export const windowProxy = new Proxy(window, {
	get(target, prop) {
		const propIsString = typeof prop === "string";
		if (propIsString && prop === "location") {
			return locationProxy;
		} else if (
			propIsString &&
			["window", "top", "self", "globalThis"].includes(prop)
		) {
			return windowProxy;
		} else if (propIsString && prop == "parent") {
			return window.parent;
		} else if (propIsString && prop === "$scramjet") {
			return;
		} else if (propIsString && prop === "addEventListener") {
			return new Proxy(window.addEventListener, {
				apply(target1, thisArg, argArray) {
					window.addEventListener(argArray[0], argArray[1]);
				},
			});
		}

		const value = Reflect.get(target, prop);

		// this is bad! i don't know what the right thing to do is
		if (typeof value === "function") {
			return new Proxy(value, {
				apply(_target, thisArg, argArray) {
					return value.apply(window, argArray);
				},
			});
		}

		return value;
	},

	set(target, prop, newValue) {
		// ensures that no apis are overwritten
		if (
			typeof prop === "string" &&
			["window", "top", "parent", "self", "globalThis", "location"].includes(
				prop
			)
		) {
			return false;
		}

		return Reflect.set(target, prop, newValue);
	},
});

export const documentProxy = new Proxy(document, {
	get(target, prop) {
		const propIsString = typeof prop === "string";

		if (propIsString && prop === "location") {
			return locationProxy;
		}

		const value = Reflect.get(target, prop);

		if (typeof value === "function") {
			return new Proxy(value, {
				apply(_target, thisArg, argArray) {
					return value.apply(document, argArray);
				},
			});
		}

		return value;
	},
	set(target, prop, newValue) {
		if (typeof prop === "string" && prop === "location") {
			//@ts-ignore
			location = new URL(encodeUrl(newValue));

			return;
		}

		return Reflect.set(target, prop, newValue);
	},
});
