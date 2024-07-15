import { locationProxy } from "./location";

export const windowProxy = new Proxy(window, {
	get(target, prop) {
		const propIsString = typeof prop === "string";
		if (propIsString && prop === "location") {
			return locationProxy;
		} else if (
			propIsString &&
			["window", "top", "parent", "self", "globalThis"].includes(prop)
		) {
			return windowProxy;
		} else if (propIsString && prop === "$scramjet") {
			return;
		} else if (propIsString && prop === "addEventListener") {
			console.log("addEventListener getteetetetetet");

			return new Proxy(window.addEventListener, {
				apply(target1, thisArg, argArray) {
					window.addEventListener(argArray[0], argArray[1]);
				},
			});
		}

		const value = Reflect.get(target, prop);


		// this is bad! i don't know what the right thing to do is
		if (typeof value === "function" && value != Object) {
			return value.bind(target);
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
			return value.bind(target);
		}

		return value;
	}
});
