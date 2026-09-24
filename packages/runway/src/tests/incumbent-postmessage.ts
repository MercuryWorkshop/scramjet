import { incumbenceMatrix } from "../incumbence.ts";

/**
 * https://html.spec.whatwg.org/multipage/web-messaging.html#window-post-message-steps
 *
 *   Let source be the WindowProxy object corresponding to incumbent settings
 *   object's global object (a Window object).
 *
 * The **incumbent** settings object, where `window.open` uses the entry one, so
 * the two answer sheets differ - the column below is not the one in
 * `incumbent.ts`, and every row where they disagree is a row where an
 * implementation that computes one settings object and uses it for both is
 * wrong about one of them.
 *
 * The message always goes to the top and always through the top's own
 * `postMessage`, so the only thing varying down the column is which realm the
 * browser considers to be running.
 *
 * The other two things `postMessage` takes from the incumbent settings object -
 * the message's `origin`, and what a `targetOrigin` of `"/"` matches - are its
 * origin rather than its identity, and every realm here is same origin, which
 * they have to be to reach into each other at all. `source` is the observable
 * that distinguishes them.
 */
export default incumbenceMatrix({
	prefix: "incumbent-postmessage",
	sink: (win) => `${win}.__top.postMessage('ping', '*')`,
	// the same call as a bound native function, for the `backup-` patterns:
	// nothing of the page's goes on the stack when the host calls it, so the
	// incumbent is whatever the backup incumbent settings object stack says.
	//
	// The empty `transfer` is bound too, so that the argument the host hands a
	// callback - an event, a resolution value - lands past the arguments
	// `postMessage` declares and is ignored, rather than being taken as one
	sinkfn: (win) =>
		`${win}.__top.postMessage.bind(${win}.__top, 'ping', '*', [])`,
	setup: {
		top: `addEventListener('message', function (e) {
			var realm = 'unknown';
			try {
				if (e.source === window) realm = 'top';
				else if (e.source === frames[0]) realm = 'frame';
				else if (frames[0] && e.source === frames[0].frames[0]) realm = 'sub';
			} catch (err) {}
			__report(realm);
		})`,
	},
	expect: {
		sanity: "frame",
		"sanity-sanity": "top",
		crossrealm: "frame",
		functioncall: "top",
		eval: "top",
		functionctor: "top",
		settimeout: "top",
		"settimeout-cb": "frame",
		promise: "top",
		"promise-cb": "top",
		"event-listener": "frame",
		"event-listener-foreign-cb": "top",
		"reverse-functioncall": "frame",
		"three-realm": "sub",
		"builtin-callback": "top",
		"async-crossrealm-function": "top",
		"inline-handler": "frame",
		"message-event": "frame",

		// the backup incumbent settings object: the realm that was incumbent
		// when the callback was converted, answering for a callback that puts no
		// script of its own on the stack
		"backup-control-direct": "frame",
		"backup-settimeout": "frame",
		"backup-queuemicrotask": "frame",
		// chromium, and not the spec: HostMakeJobCallback is supposed to record
		// the incumbent settings object at the time `then` was called - the
		// frame's - and HostCallJobCallback to run the reaction under it. What
		// chromium answers with instead is the handler's own realm, which for a
		// bound function is its target's. Measured, like every row here, because
		// a proxy has to reproduce the browser it runs in
		"backup-promise": "top",
		"backup-message-event": "frame",
		"backup-sync-dispatch": "frame",
		"backup-foreign-bound": "frame",
		"backup-three-realm": "sub",
	},
});
