import { incumbenceMatrix } from "../incumbence.ts";

/**
 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-location-href
 *
 *   Let url be the result of encoding-parsing a URL given the given value,
 *   relative to the entry settings object.
 *
 * The same settings object `window.open` uses, so this column should match the
 * one in `incumbent.ts` row for row - which is the point of running it. The two
 * sinks reach entry through completely different code in scramjet
 * (`client/location.ts` against `client/dom/open.ts`) and there is no reason
 * for them to agree unless both are right.
 *
 * The receiver is a fresh about:blank popup rather than a frame, so the setter
 * runs against a realm with no URL of its own and nothing but the entry
 * settings object can supply the base URL.
 */
export default incumbenceMatrix({
	prefix: "incumbent-location",
	sink: (win) => `${win}.open('', '_blank').location.href = 'flag.html'`,
	expect: {
		sanity: "frame",
		"sanity-sanity": "top",
		crossrealm: "frame",
		functioncall: "frame",
		eval: "frame",
		functionctor: "frame",
		settimeout: "top",
		"settimeout-cb": "frame",
		promise: "top",
		"promise-cb": "frame",
		"event-listener": "frame",
		"event-listener-foreign-cb": "top",
		"reverse-functioncall": "top",
		"three-realm": "top",
		"builtin-callback": "frame",
		"async-crossrealm-function": "top",
		"inline-handler": "frame",
		"message-event": "frame",
	},
});
