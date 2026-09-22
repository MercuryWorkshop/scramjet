import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// `interceptor-nativeness.ts` covers what an intercepted *member* looks like.
// This covers the two places where the object graph around one is wrong rather
// than the member itself.

export default [
	// https://webidl.spec.whatwg.org/#interface-prototype-object
	//
	// "The interface prototype object must also have a property named
	// `constructor` [...] whose value is a reference to the interface object."
	//
	// A `@Constructor` interceptor replaces `globalThis.X` with a Proxy over
	// the native constructor, and nothing touches `X.prototype.constructor` -
	// which still names the native. So `X.prototype.constructor === X`, which
	// holds for every interface in every engine, is false for exactly the set
	// of interfaces scramjet constructs through. That is a one-expression
	// enumeration of what the proxy patches.
	basicTest({
		name: "ifaceidentity-prototype-constructor-is-the-interface-object",
		js: `
			// the legacy factory functions are genuinely not interface objects:
			// their .prototype is another interface, so its own constructor
			// names that one. Every engine reports them, bare included.
			const LEGACY = ["Image", "Audio", "Option", "Iterator"];
			const broken = [];
			for (const name of Object.getOwnPropertyNames(self)) {
				if (LEGACY.includes(name)) continue;
				let ctor;
				try {
					ctor = self[name];
				} catch {
					continue;
				}
				if (typeof ctor !== "function") continue;
				// an interface object always has a non-writable .prototype;
				// a plain constructor function's is writable
				const proto = Object.getOwnPropertyDescriptor(ctor, "prototype");
				if (!proto || proto.writable !== false) continue;
				if (!proto.value || typeof proto.value !== "object") continue;

				const own = Object.getOwnPropertyDescriptor(proto.value, "constructor");
				if (!own) continue;
				if (own.value !== ctor) broken.push(name);
			}
			assertEqual(
				broken.join(","),
				"",
				"X.prototype.constructor === X for every interface"
			);
		`,
	}),

	// `dom/storage.ts` replaces `localStorage` with a Proxy whose `get` trap
	// mints a fresh arrow function per read. Three separate tells fall out of
	// that, and a fourth from how the proxy is installed:
	//
	//   - the member is a different object on every read, where the native is
	//     `[SameObject]`-equivalent by virtue of living on Storage.prototype
	//   - `Function.prototype.toString` renders its source, not
	//     "function getItem() { [native code] }" - and that source names
	//     `scopeUrl`
	//   - its `name` is "" rather than the member's
	//   - `window.localStorage` is deleted and reassigned, so it is a data
	//     property where WindowLocalStorage declares a readonly attribute, and
	//     `delete` also moved it to the end of the window's key order
	basicTest({
		name: "ifaceidentity-storage-members-are-native",
		js: `
			const bad = [];
			if (localStorage.getItem !== localStorage.getItem) {
				bad.push("getItem is a different object on each read");
			}
			const source = Function.prototype.toString.call(localStorage.getItem);
			if (!/\\[native code\\]/.test(source)) {
				bad.push("getItem stringifies as source: " + source.slice(0, 60));
			}
			if (localStorage.getItem.name !== "getItem") {
				bad.push("getItem.name is " + JSON.stringify(localStorage.getItem.name));
			}
			if (!Object.getOwnPropertyNames(Storage.prototype).includes("getItem")) {
				bad.push("Storage.prototype has no getItem");
			}
			const descriptor = Object.getOwnPropertyDescriptor(self, "localStorage");
			if (descriptor && !descriptor.get) {
				bad.push("window.localStorage is a data property, not an accessor");
			}
			assertEqual(bad.join(" | "), "", "Storage members look native");
		`,
	}),
];
