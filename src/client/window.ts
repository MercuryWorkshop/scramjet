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

Function.prototype.apply = new Proxy(Function.prototype.apply, {
	apply(target, thisArg, argArray) {
		if (argArray[0] === windowProxy) {
			argArray[0] = window;
		} else if (argArray[0] === documentProxy) {
			argArray[0] = document;
		}

		return Reflect.apply(target, thisArg, argArray);
	},
});

Function.prototype.call = new Proxy(Function.prototype.call, {
	apply(target, thisArg, argArray) {
		if (argArray[0] === windowProxy) {
			argArray[0] = window;
		} else if (argArray[0] === documentProxy) {
			argArray[0] = document;
		}

		return Reflect.apply(target, thisArg, argArray);
	},
});

Function.prototype.bind = new Proxy(Function.prototype.bind, {
	apply(target, thisArg, argArray) {
		if (argArray[0] === windowProxy) {
			argArray[0] = window;
		} else if (argArray[0] === documentProxy) {
			argArray[0] = document;
		}

		return Reflect.apply(target, thisArg, argArray);
	},
});
