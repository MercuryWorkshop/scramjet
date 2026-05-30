import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_86499_133 (payload2_lifted.js:24000-24009):
//   SDGM5.toString().name.indexOf("bind") === -1
//   → checks that the toString method name does not look bind-wrapped.
//
// p2_func_73237_21 family (payload2_lifted.js:25971-26035):
//   1. Object.prototype.toString.call("toString") → special string test
//   2. BigInt(value) → Object(BigInt) → structuredClone → toString
//   3. "nHHc5" + cloned.toString()

export default basicTest({
	name: "cf-tostring-checks",
	js: `
    // Check 1: Function.prototype.toString is callable
    const funcToString = Function.prototype.toString;
    assert(typeof funcToString === "function",
      "Function.prototype.toString should be a function");

    // Check 2: Object.prototype.toString.call("toString") (p2_func_73237_21)
    // Turnstile calls Object.prototype.toString on the string "toString"
    // This returns "[object String]"
    const objToString = Object.prototype.toString;
    const objStrResult = objToString.call("toString");
    assert(objStrResult === "[object String]",
      "Object.prototype.toString.call('toString') should return '[object String]', got: " + objStrResult);

		// Check 3: native function text and the toString method name shape (p2_func_86499_133)
		const testFn = Array.prototype.push;
		const fnStr = testFn.toString();
		assert(fnStr.indexOf("native code") !== -1 || fnStr.indexOf("[native code]") !== -1,
			"Native function toString should show 'native code', got: " + fnStr.substring(0, 60));
		assert((testFn.toString.name || "").indexOf("bind") === -1,
			"Function toString method name should not contain 'bind'");

		// Check 4: structuredClone of BigInt Object (p2_func_73237_21)
		// BigInt(~~"luagobrr" + 611) → Object(bigint) → structuredClone
		// → "nHHc5" + cloned.toString()
		if (typeof BigInt !== "undefined" && typeof structuredClone !== "undefined") {
			const bigVal = BigInt(~~"luagobrr" + 611);
			const obj = Object(bigVal);
			const cloned = structuredClone(obj);
			const prefixed = "nHHc5" + cloned.toString();
			assert(prefixed === "nHHc5611",
				"structuredClone BigInt prefix should be 'nHHc5611', got: " + prefixed);
		}
	`,
});
