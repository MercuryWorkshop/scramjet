import { AkClient } from "@client/index";
import { Object_defineProperty, Symbol_for } from "@/shared/snapshot";

export const POLLUTANT = Symbol_for("ak realm pollutant");

export default function (client: AkClient, self: GlobalThis) {
	// object.$setrealm({}).postMessage(...)
	// the empty object is the "pollutant" which can reconstruct the real realm
	// i explain more in postmessage.ts
	Object_defineProperty(self.Object.prototype, "$ak$setrealmfn", {
		value(pollution: object) {
			// this is bad!! sites could detect this
			Object_defineProperty(this, POLLUTANT, {
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
