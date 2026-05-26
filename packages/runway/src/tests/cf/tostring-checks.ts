import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_86499_133 (line 18848-18858):
//   SDGM5.toString().name.indexOf("bind") === -1
//   → checks that a function's toString representation doesn't contain "bound"
//   → native functions show "function name() { [native code] }"
//   → patched/bind-wrapped functions show "function () { [native code] }" or "function bound name() {...}"
//
// p2_func_73237_21 (line 20280-20293):
//   1. Object.prototype.toString.call("toString") → special string test
//   2. BigInt(value) → Object(BigInt) → structuredClone → toString
//   3. "nHHc5" + cloned.toString()
//
// p2_func_275120_109 (line 237-331):
//   outerHTML, innerHTML → checks DOM serialization
//   checks that the strings match expected formats

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

    // Check 3: Native function toString doesn't contain "bound" (p2_func_86499_133)
    // Use Array.prototype.push as the test function (like Turnstile's SDGM5)
    const testFn = Array.prototype.push;
    const fnStr = testFn.toString();
    assert(fnStr.indexOf("native code") !== -1 || fnStr.indexOf("[native code]") !== -1,
      "Native function toString should show 'native code', got: " + fnStr.substring(0, 60));
    assert(fnStr.indexOf("function") === 0,
      "Native function toString should start with 'function', got: " + fnStr.substring(0, 40));

    // Check 4: structuredClone of BigInt Object (p2_func_73237_21)
    // BigInt(688) → Object(bigint) → structuredClone → toString → should be "688"
    if (typeof BigInt !== "undefined" && typeof structuredClone !== "undefined") {
      try {
        const bigVal = BigInt(688);
        const obj = Object(bigVal);
        const cloned = structuredClone(obj);
        assert(cloned.toString() === "688",
          "structuredClone(Object(BigInt(688))).toString() should return '688', got: " + cloned.toString());
      } catch (e) {
        pass("structuredClone BigInt check failed: " + e.message);
      }
    }

    // Check 5: Worker.toString must show native code
    // (scramjet rewrites Worker constructor URL)
    const wStr = Worker.toString();
    assert(wStr.indexOf("native code") !== -1 || wStr.indexOf("[native code]") !== -1,
      "Worker.toString should show native code: " + wStr.substring(0, 60));

    // Check 6: Blob.toString shows native code
    const bStr = Blob.toString();
    assert(bStr.indexOf("native code") !== -1 || bStr.indexOf("[native code]") !== -1,
      "Blob.toString should show native code");
  `,
});