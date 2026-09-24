import { incumbenceMatrix, type Realm } from "../incumbence.ts";

/**
 * The control column.
 *
 * `fetch` resolves against the **current** settings object and `XMLHttpRequest`
 * against the XHR object's **relevant** one, and neither of those is entry or
 * incumbent: both come out as the realm the API itself belongs to, whatever
 * realm was running when it was reached. So this sheet is exactly "the realm of
 * `win`", and it is worth having precisely because it is boring - it is the
 * shape that scramjet's one-client-per-realm interceptors already produce, and
 * it pins which APIs are supposed to keep producing it. A fix that makes
 * everything answer with the entry realm breaks these and nothing else says so.
 */
const RELEVANT: Partial<Record<string, Realm>> = {
	sanity: "frame",
	"sanity-sanity": "top",
	crossrealm: "top",
	functioncall: "top",
	eval: "top",
	functionctor: "top",
	settimeout: "top",
	"settimeout-cb": "top",
	promise: "top",
	"promise-cb": "top",
	"event-listener": "top",
	"event-listener-foreign-cb": "top",
	"reverse-functioncall": "frame",
	"three-realm": "sub",
	"builtin-callback": "top",
	"async-crossrealm-function": "top",
	"inline-handler": "frame",
	"message-event": "top",
};

export default [
	...incumbenceMatrix({
		prefix: "incumbent-fetch",
		sink: (win) =>
			`${win}.fetch('probe.txt').then(function (r) { return r.text() }).then(__report)`,
		expect: RELEVANT,
	}),
	...incumbenceMatrix({
		prefix: "incumbent-xhr",
		sink: (win) =>
			`(function () { var x = new ${win}.XMLHttpRequest(); x.open('GET', 'probe.txt'); x.onload = function () { __report(x.responseText) }; x.send() })()`,
		expect: RELEVANT,
	}),
];
