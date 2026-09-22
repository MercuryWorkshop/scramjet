import { ScramjetClient } from "@client/index";
import { Constructor, Type } from "@client/webidl";
import { String_indexOf, String_substring } from "@/shared/snapshot";

export const enabled = (client: ScramjetClient, self: Self) =>
	"BroadcastChannel" in self;

/**
 * https://html.spec.whatwg.org/multipage/web-messaging.html#broadcastchannel
 */
export default function (client: ScramjetClient) {
	client.Intercept(class extends BroadcastChannel {
		@Constructor("DOMString")
		static konstructor(name: string) {
			return new this(`${client.scopeOrigin}@${name}`);
		}

		@Type("DOMString")
		get name(): string {
			const name = super.name;

			// split on the *first* "@": an origin cannot contain one, so the
			// first is always the separator and a name the page put an "@" in -
			// including one that looks like it is already scoped - comes back
			// intact. A name with no "@" at all is not one of ours and is
			// answered as-is rather than mangled.
			return String_substring(name, String_indexOf(name, "@") + 1);
		}
	});
}
