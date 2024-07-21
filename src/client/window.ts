import { client } from ".";
import { encodeUrl } from "../shared/rewriters/url";
import { locationProxy } from "./location";

export const windowProxy = new Proxy(self, {
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
			return self.parent;
		} else if (propIsString && prop === "$scramjet") {
			return;
		}

		const value = Reflect.get(target, prop);

		// this is bad! i don't know what the right thing to do is
		if (typeof value === "function") {
			return new Proxy(value, {
				apply(_target, thisArg, argArray) {
					return value.apply(self, argArray);
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

export const documentProxy = new Proxy(self.document || {}, {
	get(target, prop) {
		const propIsString = typeof prop === "string";

		if (propIsString && prop === "location") {
			return locationProxy;
		}

		const value = Reflect.get(target, prop);

		if (typeof value === "function") {
			return new Proxy(value, {
				apply(_target, thisArg, argArray) {
					return value.apply(self.document, argArray);
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

client.Proxy(
	[
		"Function.prototype.call",
		"Function.prototype.bind",
		"Function.prototype.apply",
	],
	{
		apply(ctx) {
			if (ctx.args[0] === windowProxy) ctx.args[0] = window;
			if (ctx.args[0] === documentProxy) ctx.args[0] = document;
		},
	}
);
