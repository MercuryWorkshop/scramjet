import { basicTest } from "../../testcommon.ts";

// Ported from data4/payload2_lifted.js:13904-13967 and 14169-14185.
//
// The VM fingerprints Window.prototype.postMessage and then probes
// Object.getOwnPropertyDescriptor(window, "postMessage"), repeating the same
// shape for setInterval and setTimeout. These APIs are common proxy/shim
// targets, so compare exact descriptor placement and native function strings.

export default basicTest({
	name: "cf-window-message-timer-descriptors",
	js: `
		const describeDescriptor = (obj, prop) => {
			const desc = Object.getOwnPropertyDescriptor(obj, prop);
			if (!desc) return null;
			const value = desc.value;
			const getter = desc.get;
			const setter = desc.set;
			return {
				configurable: desc.configurable,
				enumerable: desc.enumerable,
				writable: "writable" in desc ? desc.writable : null,
				hasValue: "value" in desc,
				valueType: typeof value,
				valueName: typeof value === "function" ? value.name : null,
				valueLength: typeof value === "function" ? value.length : null,
				valueString: typeof value === "function" ? Function.prototype.toString.call(value) : null,
				hasGetter: typeof getter === "function",
				getterString: typeof getter === "function" ? Function.prototype.toString.call(getter) : null,
				hasSetter: typeof setter === "function",
				setterString: typeof setter === "function" ? Function.prototype.toString.call(setter) : null,
			};
		};

		assert(typeof Window === "function", "Window constructor should exist");

		const props = ["postMessage", "setInterval", "setTimeout"];
		const snapshot = {};
		for (const prop of props) {
			const protoDesc = describeDescriptor(Window.prototype, prop);
			const ownDesc = describeDescriptor(window, prop);
			const fn = window[prop];

			assert(typeof fn === "function", "window." + prop + " should be callable");
			assert(protoDesc !== null || ownDesc !== null,
				"window." + prop + " should have a descriptor on window or Window.prototype");

			snapshot[prop] = {
				proto: protoDesc,
				own: ownDesc,
				valueName: fn.name,
				valueLength: fn.length,
				valueString: Function.prototype.toString.call(fn),
				windowEqualsPrototype: protoDesc && protoDesc.value ? window[prop] === protoDesc.value : null,
			};
		}

		const timeoutId = setTimeout(() => {}, 0);
		clearTimeout(timeoutId);
		const intervalId = setInterval(() => {}, 50);
		clearInterval(intervalId);

		assertConsistent("window-message-timer-descriptors", snapshot);
	`,
});
