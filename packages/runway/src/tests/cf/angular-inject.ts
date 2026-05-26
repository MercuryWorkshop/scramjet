import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_2210_8 (lines 40-53): Angular testability injection
//   1. reg_20 = {} → empty object
//   2. reg_19 = {} → empty object with whenStable method
//   3. reg_19.whenStable = vm_func_844_208 → callback function
//   4. reg_22 = "defineProperty" → store string
//   5. reg_24 = { get: vm_func_881_236 }
//   6. Object.defineProperty(reg_20, "getTestability", reg_24)
//   7. window.angular = reg_20 → inject Angular property
//
// vm_func_881_236 (lines 328-334): getter for getTestability
//   1. window.apgEV8 = 1 → set flag
//
// vm_func_844_208 (lines 336-339): whenStable callback
//   1. obj[callback]() → invoke callback
//
// This checks:
//   1. Object.defineProperty can add getter properties
//   2. window can be extended with custom properties (angular)
//   3. Function references can be stored and invoked

export default basicTest({
  name: "cf-angular-inject",
  js: `
    // Step 1-3: Create object with whenStable method (like Turnstile)
    let callbackInvoked = false;
    const testabilityObj = {
      whenStable(callback) {
        callbackInvoked = true;
        assert(typeof callback === "function",
          "whenStable should receive a function callback");
        callback();
      },
    };

    // Step 4-6: Object.defineProperty with custom getter
    let getterInvoked = false;
    const targetObj = {};
    Object.defineProperty(targetObj, "getTestability", {
      get() {
        getterInvoked = true;
        return testabilityObj;
      },
      configurable: true,
      enumerable: true,
    });

    assert(typeof targetObj.getTestability === "object",
      "getTestability getter should return object");
    assert(getterInvoked === true,
      "getTestability getter should have been called");
    assert(targetObj.getTestability === testabilityObj,
      "getTestability should return the testability object");

    // Step 7: Inject into window (Turnstile sets window.angular)
    const oldAngular = window.angular;
    window.angular = targetObj;

    assert(window.angular === targetObj,
      "window.angular should be writable");
    assert(typeof window.angular.getTestability === "object",
      "window.angular.getTestability should be the testability object");
    assert(typeof window.angular.getTestability.whenStable === "function",
      "whenStable should be callable");

    // Verify whenStable callback chain works
    window.angular.getTestability.whenStable(function() {
      callbackInvoked = true;
    });

    // Restore
    if (oldAngular !== undefined) {
      window.angular = oldAngular;
    } else {
      delete window.angular;
    }
  `,
});