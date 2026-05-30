import { basicTest } from "../../testcommon.ts";

// Ported from data4/inner.js_translated.js:2131-2140, 2463-2482,
// 2511-2536, and 4624-4636.
//
// Cloudflare records touch capability using both "ontouchstart" in window and
// navigator.maxTouchPoints, timestamps input with performance.now(), and gates
// attestation on ReadableStream.pipeTo/BigInt/crypto/PerformanceObserver.

export default basicTest({
	name: "cf-touch-performance-gate",
	js: `
		const navMaxTouchDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints");
		const capability = {
			hasOntouchstart: "ontouchstart" in window,
			maxTouchPoints: navigator.maxTouchPoints,
			maxTouchPointsType: typeof navigator.maxTouchPoints,
			touchGateA: "ontouchstart" in window || navigator.maxTouchPoints > 0,
			touchGateB: "ontouchstart" in window || navigator.maxTouchPoints !== 0,
			maxTouchDescriptor: navMaxTouchDesc ? {
				configurable: navMaxTouchDesc.configurable,
				enumerable: navMaxTouchDesc.enumerable,
				hasGetter: typeof navMaxTouchDesc.get === "function",
				getterName: typeof navMaxTouchDesc.get === "function" ? navMaxTouchDesc.get.name : null,
				getterString: typeof navMaxTouchDesc.get === "function" ? Function.prototype.toString.call(navMaxTouchDesc.get) : null,
			} : null,
			readableStreamPipeToMissing: typeof ReadableStream === "undefined" || ReadableStream.prototype.pipeTo === undefined,
			bigIntMissing: !window.BigInt,
			cryptoGetRandomValuesMissing: !window.crypto || !crypto.getRandomValues,
			performanceObserverMissing: typeof PerformanceObserver !== "function",
		};

		assert(typeof performance.now === "function", "performance.now should exist");
		const start = performance.now();
		await new Promise((resolve) => setTimeout(resolve, 0));
		const end = performance.now();
		const timing = {
			startType: typeof start,
			endType: typeof end,
			deltaNonNegative: end - start >= 0,
		};

		assert(typeof navigator.maxTouchPoints === "number",
			"navigator.maxTouchPoints should be numeric");
		assert(timing.deltaNonNegative === true,
			"performance.now should be monotonic for input timing");
		assertConsistent("touch-performance-gate", { capability, timing });
	`,
});
