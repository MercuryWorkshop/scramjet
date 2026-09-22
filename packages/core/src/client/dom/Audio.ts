import { ScramjetClient } from "@client/client";
import { Constructor } from "@client/webidl";

export default function (client: ScramjetClient, _self: Self) {
	// https://html.spec.whatwg.org/multipage/media.html#dom-audio
	client.Intercept(class extends Audio {
		@Constructor("optional DOMString")
		static konstructor(url?: string) {
			// `undefined` is the argument being absent, which leaves the media
			// element with no source at all. An explicit "" is *given* - it is a
			// real URL that resolves to the document's own - so it is rewritten
			// like any other, where a truthiness test read it as absent.
			return new this(url === undefined ? undefined : client.rewriteUrl(url));
		}
	});
}
