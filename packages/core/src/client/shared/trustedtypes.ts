import type { ScramjetClient } from "@client/index";
import {
	Object_create,
	Object_defineProperty,
	Reflect_get,
	drain,
} from "@/shared/snapshot";

export default function (client: ScramjetClient) {
	client.Proxy("TrustedTypePolicyFactory.prototype.createPolicy", {
		apply(ctx) {
			const options = ctx.args[1];
			if (
				options === null ||
				(typeof options !== "object" && typeof options !== "function")
			)
				return;
			const callbacks = Object_create(null);
			const dictionary = Object_create(null);
			// Native Web IDL still chooses the lookup order and rejects invalid
			// callbacks. Getters run once, on the original options receiver, and
			// later changes to the options do not change a policy's callbacks.
			for (const name of drain([
				"createHTML",
				"createScript",
				"createScriptURL",
			])) {
				Object_defineProperty(dictionary, name, {
					get() {
						return (callbacks[name] = Reflect_get(options, name, options));
					},
				});
			}
			ctx.args[1] = dictionary;
			const policy = ctx.call();
			client.box.trustedTypeCallbacks.set(policy, callbacks);
			ctx.return(policy);
		},
	});
}
