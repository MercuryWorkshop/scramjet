import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_86159_111, payload2_lifted.js:20544-20556:
//   1. Object.getOwnPropertyNames(SDGM5) → enumerate ALL own properties of a function
//   2. .sort() → sort alphabetically
//   3. .toString() → convert sorted array of prop names to comma-separated string
//
// This is DIFFERENT from the individual descriptor checks — this enumerates
// EVERY own property of the function object and produces a sorted string.
// The result is compared against expected values to detect tampering.
//
// The exact string is engine/function-dependent; this test keeps to stable
// invariants: own property enumeration returns an array, sorting/stringifying
// works, and ordinary vs arrow/built-in functions expose the expected shape.
//
// p2_func_20026_251 (line 25175):
//   element.contains(child) — checks DOM containment
//   → branches to location/history test chain (p2_func_20062_85 etc)

export default basicTest({
	name: "cf-function-properties",
	js: `
		// p2_func_86159_111 enumerates an existing function object's own property
		// names, sorts them, and stringifies the sorted array.
		function testFn() {}
		const nativeFn = Array.prototype.push;
		const arrowFn = () => {};

		const functionShapes = [
			["ordinary", Object.getOwnPropertyNames(testFn).sort().toString()],
			["native-method", Object.getOwnPropertyNames(nativeFn).sort().toString()],
			["arrow", Object.getOwnPropertyNames(arrowFn).sort().toString()],
		];

		for (const [, propString] of functionShapes) {
			assert(typeof propString === "string",
				"sorted function property names should stringify to a string");
		}

		assertConsistent("function-own-property-names", functionShapes);
	`,
});
