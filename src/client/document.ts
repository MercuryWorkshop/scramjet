import { rewriteUrl } from "../shared";
import { ScramjetClient } from "./client";
import { getOwnPropertyDescriptorHandler } from "./helpers";

export function createDocumentProxy(
	client: ScramjetClient,
	self: typeof globalThis
) {
	return new Proxy(self.document, {
		get(target, prop) {
			if (prop === "location") {
				return client.locationProxy;
			}

			if (prop === "defaultView") {
				return client.globalProxy;
			}

			const value = Reflect.get(target, prop);

			return value;
		},
		set(target, prop, newValue) {
			if (prop === "location") {
				location.href = rewriteUrl(newValue, client.meta);

				return;
			}

			return Reflect.set(target, prop, newValue);
		},
		getOwnPropertyDescriptor: getOwnPropertyDescriptorHandler,
	});
}
