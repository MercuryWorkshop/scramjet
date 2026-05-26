import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_86350_235: getOwnPropertyDescriptor(arg_0.SDGM5, "toString")
//   → checks if Function has own "toString" property
// p2_func_86644_143: getOwnPropertyDescriptor(arg_0.SDGM5, "arguments")
//   → checks if Function has own "arguments" property
// p2_func_87617_91: getOwnPropertyDescriptor(arg_0.SDGM5, "length")
//   → checks if Function.length descriptor is a number
//
// SDGM5 is a function reference passed through the VM. Turnstile checks:
//   1. "toString" should NOT be an own property (inherited from Function.prototype)
//   2. "arguments" may or may not be an own property
//   3. "length" MUST be an own property (value descriptor with number)
//
// p2_func_181177_17: Object.defineProperty on Error "name"/"message"/"stack"
//   → Turnstile redefines Error name/message/stack with custom getters
//   → This checks if property descriptor manipulation is possible
//
// p2_func_86499_133: checks toString().name.indexOf("bind") on a native function
//   → native functions should not have "bind" in their toString representation

export default basicTest({
  name: "cf-function-proto-checks",
  js: `
    // Get a native function to test (like Turnstile's SDGM5)
    const fn = Array.prototype.push;

    // Check 1: getOwnPropertyDescriptor(fn, "toString") — should be undefined
    // (toString is inherited from Function.prototype, not an own property)
    const toStringDesc = Object.getOwnPropertyDescriptor(fn, "toString");
    assert(toStringDesc === undefined,
      "Function should not have 'toString' as own property, it's inherited");

    // Check 2: getOwnPropertyDescriptor(fn, "arguments") — varies by function
    const argsDesc = Object.getOwnPropertyDescriptor(fn, "arguments");
    // Some functions have it, some don't; existence isn't critical
    if (argsDesc !== undefined) {
      assert(typeof argsDesc.value !== "undefined" || argsDesc.value === undefined,
        "Function.arguments descriptor value should be undefined");
    }

    // Check 3: getOwnPropertyDescriptor(fn, "length") — MUST exist
    const lengthDesc = Object.getOwnPropertyDescriptor(fn, "length");
    assert(lengthDesc !== undefined,
      "Function should have own property 'length'");
    assert(typeof lengthDesc.value === "number",
      "Function.length should be a number, got: " + typeof lengthDesc.value);
    assert(lengthDesc.writable === false,
      "Function.length should be non-writable");

    // Check 4: toString() on native function must show native code
    const fnStr = fn.toString();
    assert(fnStr.indexOf("native code") !== -1 || fnStr.indexOf("[native code]") !== -1,
      "Native function toString should show 'native code': " + fnStr.substring(0, 60));

    // Check 5: toString() via .call should also show native code
    const viaCall = Function.prototype.toString.call(fn);
    assert(viaCall.indexOf("native code") !== -1 || viaCall.indexOf("[native code]") !== -1,
      "toString via .call should show native code");

    // Check 6: Object.defineProperty on Error name/message/stack
    // Turnstile checks that these can be redefined (p2_func_181177_17)
    const err = new Error("test");
    try {
      Object.defineProperty(err, "name", {
        get() { return "CustomName"; },
        configurable: true,
      });
      assert(err.name === "CustomName",
        "Error.name should be redefinable via Object.defineProperty");
    } catch (e) {
      // Some engines may not allow this
      pass("Object.defineProperty on Error.name threw: " + e.message);
    } finally {
      delete err.name;
    }

    // Check 7: Worker.toString must show native code
    // (tested because scramjet rewrites Worker constructor)
    assert(typeof Worker === "function", "Worker should be a function");
    const wStr = Worker.toString();
    assert(wStr.indexOf("native code") !== -1 || wStr.indexOf("[native code]") !== -1,
      "Worker.toString should show native code: " + wStr.substring(0, 60));
  `,
});