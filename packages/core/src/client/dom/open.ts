import { GlobalScope, ScramjetClient } from "@client/index";
import { openWindowSteps } from "@client/helpers";
import { Arguments, Returns, Type } from "@client/webidl";

export default function (client: ScramjetClient, _self: Self) {
	client.Intercept(class extends GlobalScope {
		// https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-open
		// the steps themselves are shared with the three-argument
		// `document.open`, which is the same operation under another name
		@Arguments("optional USVString", "optional DOMString", "optional DOMString")
		@Returns("WindowProxy?")
		static open(
			url?: string,
			target?: string,
			features?: string
		): Window | null {
			// through the receiver rather than a captured `self`: the steps run
			// against the window the call named, so `other.open(...)` opens
			// relative to `other` the way it does natively
			return openWindowSteps(
				client,
				new client.native.window(this).open,
				url,
				target,
				features
			);
		}

		/**
		 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-frameelement
		 *
		 *   1. Let current be this's node navigable.
		 *   2. If current is null, then return null.
		 *   3. Let container be current's container.
		 *   4. If container is null, then return null.
		 *   5. If container's node document's origin is not same origin-domain
		 *      with the current settings object's origin, then return null.
		 *   6. Return container.
		 *
		 * Steps 1-4 are the native's, reached through the receiver so that
		 * `otherWindow.frameElement` still answers about `otherWindow` and a
		 * `this` that is not a window still gets the brand check.
		 */
		@Type("Element?")
		static get frameElement(): Element | null {
			const container = new client.native.window(this)
				.frameElement as Element | null;
			if (!container) return container;

			const document = new client.native.Element(container).ownerDocument;
			const embedderGlobal =
				document && new client.native.Document(document).defaultView;
			const embedder =
				embedderGlobal && client.box.globals.get(embedderGlobal as Self);

			// the container lives outside the sandbox - the embedder's own page,
			// or the real top frame. the site was never meant to see either, and
			// step 5 would have hidden them because their origin is not the
			// site's
			if (!embedder) return null;

			// step 5, made against the sites' origins rather than the proxy's.
			// Every document scramjet serves is genuinely same-origin, so the
			// check the native makes here always passes, and a cross-origin
			// embed was handed a live element in its embedder's document -
			// enough to detect being framed where a browser reports nothing, and
			// a reachable path into another site's DOM.
			//
			// The comparison is plain origin equality where the spec says "same
			// origin-domain", which folds in `document.domain` relaxation.
			// `dom/document.ts` accepts a relaxation and then drops it on the
			// floor - relaxing the proxy's origin would relax it for every site
			// at once - so no proxied document ever has one to fold in.
			// `siteOrigin` rather than `url.origin`, because an about:blank or
			// about:srcdoc document on either side of the comparison inherits
			// its embedder's origin instead of having one
			const embedderOrigin = embedder.siteOrigin;
			const ownOrigin = client.siteOrigin;

			// `client` rather than the receiver: step 5 compares against the
			// *current settings object*, which is the realm that made the call,
			// and an interceptor is installed once per realm.
			//
			// A null on either side rejects. It is not "cannot tell" - it is a
			// document whose origin is definitely not any proxied site's, and
			// nothing is same origin-domain with one of those, so step 5 hides
			// the container exactly as it would for a mismatch
			if (
				embedderOrigin === null ||
				ownOrigin === null ||
				embedderOrigin !== ownOrigin
			) {
				return null;
			}

			return container;
		}
	});
}
