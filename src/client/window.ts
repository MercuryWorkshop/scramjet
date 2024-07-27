import { encodeUrl } from "../shared/rewriters/url";
import { ScramjetClient } from "./client";
import { wrapfn } from "./shared/wrap";

export function createWindowProxy(
	client: ScramjetClient,
	self: typeof globalThis
): typeof globalThis {
	return new Proxy(self, {
		get(target, prop) {
			const propIsString = typeof prop === "string";
			if (propIsString && prop === "location") {
				return client.locationProxy;
			} else if (
				propIsString &&
				["window", "top", "self", "globalThis", "parent"].includes(prop)
			) {
				return self[wrapfn](self[prop]);
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
		defineProperty(target, property, attributes) {
			if (!attributes.get && !attributes.set) {
				attributes.writable = true;
			}
			attributes.configurable = true;

			return Reflect.defineProperty(target, property, attributes);
		},
	});
}

export function createDocumentProxy(
	client: ScramjetClient,
	self: typeof globalThis
) {
	return new Proxy(self.document || {}, {
		get(target, prop) {
			const propIsString = typeof prop === "string";

			if (propIsString && prop === "location") {
				return client.locationProxy;
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
}
