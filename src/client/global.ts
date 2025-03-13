// import { encodeUrl } from "../shared";
import { iswindow } from ".";
import { SCRAMJETCLIENT } from "../symbols";
import { ScramjetClient } from "./client";
// import { config } from "../shared";
import { getOwnPropertyDescriptorHandler } from "./helpers";

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

			if (
				iswindow &&
				(typeof prop === "string" || typeof prop === "number") &&
				!isNaN(Number(prop)) &&
				value
			) {
				const win: Self = value.self;
				// indexing into window gives you the contentWindow of the subframes for some reason
				// you can't *set* it so this should always be the right value
				if (win) {
					if (SCRAMJETCLIENT in win) {
						// then we've already hooked this frame and we can just send over its proxy
						return win[SCRAMJETCLIENT].globalProxy;
					} else {
						// this can happen if it's an about:blank iframe that we've never gotten the chance to inject into
						// just make a new client for it and inject
						const newclient = new ScramjetClient(win);
						newclient.hook();

						return newclient.globalProxy;
					}
				}
			}

			if (prop === "$scramjet") return undefined;

			if (typeof prop === "string" && UNSAFE_GLOBALS.includes(prop)) {
				// TODO strict mode detect
				return client.wrapfn(value, true);
			}

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
