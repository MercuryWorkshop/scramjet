import { GlobalScope, ScramjetClient } from "@client/index";
import { Type } from "@client/webidl";

export default function (client: ScramjetClient) {
	// https://html.spec.whatwg.org/multipage/webappapis.html#dom-origin
	client.Intercept(class extends GlobalScope {
		/**
		 * This is [Replacable] - do NOT define a setter, the browser will handle it for us
		 */
		@Type("USVString")
		static get origin(): string {
			void new client.native.window(this).origin;
			
			// have to specifically give the string "null"
			// https://html.spec.whatwg.org/multipage/webappapis.html#dom-origin
			return client.siteOrigin ?? "null";
		}
	});
}
