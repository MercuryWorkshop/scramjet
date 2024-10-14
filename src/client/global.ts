// import { encodeUrl } from "../shared";
import { ScramjetClient } from "./client";
// import { config } from "../shared";
import { getOwnPropertyDescriptorHandler } from "./helpers";
import { indirectEval } from "./shared/eval";

export const UNSAFE_GLOBALS = [
	"window",
	"self",
	"globalThis",
	"this",
	"parent",
	"top",
	"location",
	"document",
	"eval",
	"frames",
];

export function createGlobalProxy(
	client: ScramjetClient,
	self: typeof globalThis
): typeof globalThis {
	return new Proxy(self, {
		get(target, prop) {
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
