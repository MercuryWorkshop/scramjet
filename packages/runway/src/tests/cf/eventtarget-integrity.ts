import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted property probes:
//
// internal-cf-reverse/data4/payload2_lifted.js:21280-21395
//   EventTarget.prototype.addEventListener
//   EventTarget.prototype.dispatchEvent
//   EventTarget.prototype.removeEventListener
//
// The visible lifted code performs property reads; native-code toString checks
// are covered separately by the generic toString probes and are not part of this
// EventTarget cluster.

export default basicTest({
	name: "cf-eventtarget-integrity",
	js: `
		const methods = ["addEventListener", "dispatchEvent", "removeEventListener"];
		const shape = [];

		for (const method of methods) {
			const fn = EventTarget.prototype[method];
			assert(typeof fn === "function",
				"EventTarget.prototype." + method + " should be a function");
			shape.push([method, typeof fn]);
		}

		assertConsistent("eventtarget-prototype-method-shape", shape);
	`,
});
