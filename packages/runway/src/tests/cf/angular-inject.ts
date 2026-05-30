import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_2210_8, inner.vm_lifted.js:46-57: Angular testability injection
//   1. reg_20 = {} → empty object
//   2. reg_19 = {} → empty object with whenStable method
//   3. reg_19.whenStable = vm_func_844_208 → callback function
//   4. reg_22 = "defineProperty" → store string
//   5. reg_24 = { get: vm_func_881_236 }
//   6. Object.defineProperty(reg_20, "getTestability", reg_24)
//   7. window.angular = reg_20 → inject Angular property
//
// vm_func_881_236, inner.vm_lifted.js:421-427: getter for getTestability
//   1. window.apgEV8 = 1 → set flag
//
// vm_func_844_208, inner.vm_lifted.js:429-431: whenStable callback
//   1. obj[callback]() → invoke callback
//
// This checks:
//   1. Object.defineProperty can add getter properties
//   2. window can be extended with custom properties (angular)
//   3. Function references can be stored and invoked

export default basicTest({
	name: "cf-angular-inject",
	js: `
    // vm_func_2210_8: reg_20 = {} (angular), reg_19 = {} (testability)
    const reg20 = {};
    const reg19 = {};

    // vm_func_844_208: reg_17[arg_0]()
    let invoked = false;
    reg19.whenStable = function(callback) {
      invoked = true;
      assert(typeof callback === "function",
        "whenStable should receive a function callback");
      callback();
    };

    // vm_func_881_236: getter sets window.apgEV8 = 1 and returns stack_7
    const prevApg = window.apgEV8;
    const prevAngular = window.angular;
    Object.defineProperty(reg20, "getTestability", {
      get() {
        window.apgEV8 = 1;
        return reg19;
      },
      configurable: true,
    });

    const descriptor = Object.getOwnPropertyDescriptor(reg20, "getTestability");
    assert(!!descriptor && typeof descriptor.get === "function",
      "getTestability should be installed as a getter descriptor");
    assert(descriptor.set === undefined,
      "getTestability descriptor should not define a setter");
    assert(descriptor.enumerable === false,
      "getTestability descriptor should use Object.defineProperty default enumerable=false");
    assert(descriptor.configurable === true,
      "getTestability descriptor should preserve the configured configurable flag");

    window.angular = reg20;
    assert(window.angular.getTestability === reg19,
      "getTestability getter should return reg19");
    assert(window.apgEV8 === 1,
      "getter should set window.apgEV8 = 1");

    window.angular.getTestability.whenStable(function() {
      invoked = true;
    });
    assert(invoked === true, "whenStable callback should be invoked");

    assertConsistent("angular-gettestability-descriptor", {
      hasGetter: typeof descriptor.get,
      hasSetter: typeof descriptor.set,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      apgEV8: window.apgEV8,
    });

    if (prevAngular === undefined) {
      delete window.angular;
    } else {
      window.angular = prevAngular;
    }
    if (prevApg === undefined) {
      delete window.apgEV8;
    } else {
      window.apgEV8 = prevApg;
    }
  `,
});
