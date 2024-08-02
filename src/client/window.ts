import { encodeUrl } from "./shared";
import { ScramjetClient } from "./client";
import { indirectEval } from "./shared/eval";
import { config } from "./shared";

export function createWindowProxy(
	client: ScramjetClient,
	self: typeof globalThis
): typeof globalThis {
	return new Proxy(self, {
		get(target, prop) {
			const propIsString = typeof prop === "string";
			if (prop === "location") return client.locationProxy;

			if (
				propIsString &&
				["window", "top", "self", "globalThis", "parent"].includes(prop)
			)
				return self[config.wrapfn](self[prop]);

			if (prop === "$scramjet") return;

			if (prop === "eval") return indirectEval.bind(client);

			const value = Reflect.get(target, prop);

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
