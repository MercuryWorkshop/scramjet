import { incumbenceMatrix, incumbenceTest } from "../incumbence.ts";

/**
 * `window.open` parses its URL against the **entry** settings object, so the
 * answer is the realm whose script or callback the browser entered to get here,
 * and not the realm that owns the `open` being called.
 *
 * This is the sink the pattern list was written against, so it runs all of
 * them. Every expectation below was measured against Chromium.
 */
const windowOpen = incumbenceMatrix({
	prefix: "incumbent-window-open",
	sink: (win) => `${win}.open('flag.html')`,
	expect: {
		sanity: "frame",
		"sanity-sanity": "top",
		crossrealm: "frame",
		functioncall: "frame",
		eval: "frame",
		"eval-functioncall": "frame",
		functionctor: "frame",
		settimeout: "top",
		"settimeout-cb": "frame",
		"settimeout-cb-eval": "frame",
		promise: "top",
		"promise-cb": "frame",
		"cross-promise": "frame",
		"cross-promise-direct": "top",
		"event-listener": "frame",
		"external-script": "frame",
		"external-script-crossrealm": "frame",
		module: "frame",
		"module-external": "frame",
		"base-element": "base",
		"base-element-crossrealm": "frame",
		"reverse-crossrealm": "top",
		"reverse-functioncall": "top",
		"three-realm-sanity": "sub",
		"three-realm": "top",
		"three-realm-timer": "top",
		"settimeout-foreign-cb": "top",
		"event-listener-foreign-cb": "top",
		"event-listener-foreign-target": "top",
		"promise-bound": "top",
		"message-event": "frame",
		queuemicrotask: "frame",
		"async-await": "frame",
		"async-crossrealm-function": "top",
		"inline-handler": "frame",
		"direct-eval-crossrealm": "frame",
		"builtin-callback": "frame",
		"argument-coercion": "frame",
		"dynamic-import": "top",
		"about-blank": "frame",
		srcdoc: "frame",
	},
});

/**
 * A receiver from one realm and a function from another.
 *
 * `this` decides which window the popup is opened *from* - its opener, its
 * target name lookup - and decides nothing at all about the URL. The realm the
 * method came from decides nothing either way. These are sink-specific, so they
 * are not patterns: splitting the two only means something for an API whose
 * receiver is a realm's own global or document.
 */
const receiver = [
	incumbenceTest({
		name: "incumbent-window-open-receiver-foreign-function",
		docs: { frame: "parent.open.call(window, 'flag.html')" },
		expect: "frame",
	}),
	incumbenceTest({
		name: "incumbent-window-open-receiver-foreign-receiver",
		docs: { frame: "open.call(parent, 'flag.html')" },
		expect: "frame",
	}),
	incumbenceTest({
		name: "incumbent-window-open-receiver-foreign-function-reverse",
		docs: { top: "onload = () => frames[0].open.call(window, 'flag.html')" },
		expect: "top",
	}),
	incumbenceTest({
		name: "incumbent-window-open-receiver-foreign-receiver-reverse",
		docs: { top: "onload = () => open.call(frames[0], 'flag.html')" },
		expect: "top",
	}),
	incumbenceTest({
		name: "incumbent-window-open-receiver-bound",
		docs: { frame: "parent.open.bind(window)('flag.html')" },
		expect: "frame",
	}),
	incumbenceTest({
		name: "incumbent-window-open-receiver-reflect-apply",
		docs: { frame: "Reflect.apply(parent.open, window, ['flag.html'])" },
		expect: "frame",
	}),
	incumbenceTest({
		// three-argument `document.open` is the window open steps under another
		// name, reached through a Document receiver instead of a Window one
		name: "incumbent-document-open-crossrealm",
		docs: { frame: "parent.document.open('flag.html', '_blank', '')" },
		expect: "frame",
	}),
	incumbenceTest({
		name: "incumbent-document-open-foreign-receiver",
		docs: {
			frame: "document.open.call(parent.document, 'flag.html', '_blank', '')",
		},
		expect: "frame",
	}),
	incumbenceTest({
		// the method taken off the top's interface prototype rather than off one
		// of its documents, so nothing but the receiver names a realm.
		// `Window.prototype` has no `open` to do this with - the window's is an
		// own property of the global - which is why this one is on Document
		name: "incumbent-document-open-interface-prototype",
		docs: {
			frame:
				"parent.Document.prototype.open.call(document, 'flag.html', '_blank', '')",
		},
		expect: "frame",
	}),
];

export default [...windowOpen, ...receiver];
