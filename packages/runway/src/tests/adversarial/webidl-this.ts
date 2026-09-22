import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// https://webidl.spec.whatwg.org/#dfn-create-operation-function step 2, and
// the identical step in "create an attribute getter" and "create an attribute
// setter":
//
//   Let esValue be the this value, if it is not null or undefined, or the
//   current realm's global object otherwise.
//
// This is not an obscure corner. An unqualified `addEventListener("message",
// fn)` resolves against the global environment record, whose WithBaseObject is
// undefined, so the native is called with a `this` of *undefined* and WebIDL
// substitutes the window. Page code writes it that way constantly.
//
// An interceptor body is strict-mode code, so it sees that undefined rather
// than the window the native would have used. Anything that then keys
// per-target state on the receiver - `shared/event.ts` keys a WeakMap on it -
// throws where a browser does not, and anything that reads a member off it
// answers about the wrong object.

export default [
	// The regression: `addEventListener` reached without a receiver. The
	// listener bookkeeping is a `WeakMap` keyed on the target, and `undefined`
	// is not a legal WeakMap key, so this threw
	// "TypeError: Invalid value used as weak map key" before the listener was
	// ever registered.
	basicTest({
		name: "webidlthis-bare-addeventlistener-registers",
		js: `
			let fired = false;
			addEventListener("webidlthis-bare", () => {
				fired = true;
			});
			dispatchEvent(new Event("webidlthis-bare"));
			assert(fired, "a listener added without a receiver fires");
		`,
	}),

	// The same call written out, so a failure above can be told apart from the
	// listener machinery being broken in general.
	basicTest({
		name: "webidlthis-qualified-addeventlistener-registers",
		js: `
			let fired = false;
			window.addEventListener("webidlthis-qualified", () => {
				fired = true;
			});
			window.dispatchEvent(new Event("webidlthis-qualified"));
			assert(fired, "a listener added through the window fires");
		`,
	}),

	// Detached and called with an explicit undefined receiver, which is the
	// same step of the same algorithm reached a different way.
	basicTest({
		name: "webidlthis-detached-addeventlistener-registers",
		js: `
			const add = EventTarget.prototype.addEventListener;
			const dispatch = EventTarget.prototype.dispatchEvent;
			let fired = false;
			add.call(undefined, "webidlthis-detached", () => {
				fired = true;
			});
			dispatch.call(undefined, new Event("webidlthis-detached"));
			assert(fired, "a detached addEventListener defaults to the global");
		`,
	}),

	// Removal has to find the same registration the add created, which means
	// both halves must agree on what the target was.
	basicTest({
		name: "webidlthis-bare-removeeventlistener-removes",
		js: `
			let count = 0;
			const listener = () => {
				count += 1;
			};
			addEventListener("webidlthis-remove", listener);
			dispatchEvent(new Event("webidlthis-remove"));
			removeEventListener("webidlthis-remove", listener);
			dispatchEvent(new Event("webidlthis-remove"));
			assertEqual(count, 1, "the listener ran once and was then removed");
		`,
	}),

	// The rule is general, so the other unqualified globals a page reaches the
	// same way have to resolve too. `setTimeout` and `fetch` are already
	// written against the receiver; this holds that in place.
	basicTest({
		name: "webidlthis-bare-globals-resolve",
		js: `
			await new Promise((resolve, reject) => {
				const timer = setTimeout(resolve, 0);
				assert(typeof timer === "number", "setTimeout answered a handle");
				setTimeout(() => reject(new Error("timer never fired")), 2000);
			});

			const response = await fetch("/script.js");
			assert(response.ok, "an unqualified fetch resolves");

			assertEqual(typeof btoa("x"), "string", "an unqualified btoa resolves");
			assertEqual(typeof origin, "string", "an unqualified origin read resolves");
		`,
	}),
];
