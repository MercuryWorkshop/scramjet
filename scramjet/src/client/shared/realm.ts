import { ScramjetClient } from "@client/index";
import { config } from "@/shared";

export const POLLUTANT = Symbol.for("scramjet realm pollutant");

export default function (client: ScramjetClient, self: typeof globalThis) {
	// object.$setrealm({}).postMessage(...)
	// the empty object is the "pollutant" which can reconstruct the real realm
	// i explain more in postmessage.ts
	Object.defineProperty(self.Object.prototype, config.globals.setrealmfn, {
		value(pollution: object) {
			// this is bad!! sites could detect this
			Object.defineProperty(this, POLLUTANT, {
				value: pollution,
				writable: false,
				configurable: true,
				enumerable: false,
			});

			return this;
		},
		writable: true,
		configurable: true,
		enumerable: false,
	});
}
