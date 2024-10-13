// import { encodeUrl } from "../shared";
import { ScramjetClient } from "./client";
// import { config } from "../shared";
import { getOwnPropertyDescriptorHandler } from "./helpers";
import { indirectEval } from "./shared/eval";

export const UNSAFE_GLOBALS = [
	"window",
	"top",
	"self",
	"globalThis",
	"parent",
	"document",
	"frames",
	"eval",
];

export function createGlobalProxy(
	client: ScramjetClient,
	self: typeof globalThis
): typeof globalThis {
	return new Proxy(self, {
		get(target, prop) {
			if (prop === "location") return client.locationProxy;
			if (typeof prop === "string" && UNSAFE_GLOBALS.includes(prop)) return client.wrapfn(self[prop]);
			if (prop === "$scramjet") return;
			if (prop === "eval") return indirectEval.bind(client);

			const value = Reflect.get(target, prop);
			if (typeof prop === "string" && UNSAFE_GLOBALS.includes(prop))
				return client.wrapfn(value);
			
			return value;
		},

		set(target, prop, value) {
			if (prop === "location") {
				client.url = value;

				return;
			}

			return Reflect.set(target, prop, value);
		},
		has(target, prop) {
			if (prop === "$scramjet") return false;

			return Reflect.has(target, prop);
		},
		ownKeys(target) {
			return Reflect.ownKeys(target).filter((key) => key !== "$scramjet");
		},
		defineProperty(target, property, attributes) {
			if (!attributes.get && !attributes.set) {
				attributes.writable = true;
			}
			attributes.configurable = true;

			return Reflect.defineProperty(target, property, attributes);
		},
		getOwnPropertyDescriptor: getOwnPropertyDescriptorHandler,
	});
}
