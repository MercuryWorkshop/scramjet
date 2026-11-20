/**
 * `window.name` in the emulated top-level.
 *
 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-name
 *
 * Its real name is what targets below it say to reach it (see
 * `client.frameName`). Once the page sets a name, that is the real one, so a
 * popup's `target="main"` finds its opener the way it does natively. Until
 * then it is one scramjet made up, which reads as the empty string a top-level
 * starts out with.
 */

import { GlobalScope, ScramjetClient } from "@client/index";
import { Type } from "@client/webidl";
import { isGeneratedFrameName } from "@client/helpers";

// before any script of the page's can read the name
export const order = -10;

export default function (client: ScramjetClient, _self: Self) {
	if (!client.isEmulatedTop) return;

	client.Intercept(class extends GlobalScope {
		@Type("DOMString")
		static get name(): string {
			const name: string = new client.native.window(this).name;

			return isGeneratedFrameName(name) ? "" : name;
		}

		@Type("DOMString")
		static set name(value: string) {
			new client.native.window(this).name = value;
		}
	});
}
