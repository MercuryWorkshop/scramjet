import { basicTest } from "../../testcommon.ts";

// Exact inner VM setup from inner.vm_lifted.js:46-57, getter at 421-426,
// callback holder at 429-431:
//
//   1. create angular object
//   2. create stack_7 = { whenStable: vm_func_844_208 }
//   3. Object.defineProperty(angular, "getTestability", { get: vm_func_881_236 })
//   4. window.angular = angular
//   5. getter side effect: window.apgEV8 = 1

export default basicTest({
	name: "cf-angular-gettestability-getter",
	js: `
    const previousAngular = window.angular;
    const previousApg = window.apgEV8;

    try {
      const angular = {};
      const stack7 = {
        whenStable(callback) {
          callback();
        },
      };

      Object.defineProperty(angular, "getTestability", {
        get() {
          window.apgEV8 = 1;
          return stack7;
        },
      });
      window.angular = angular;

      const desc = Object.getOwnPropertyDescriptor(window.angular, "getTestability");
      assert(desc !== undefined && typeof desc.get === "function",
        "angular.getTestability should be an accessor getter");

      const testability = window.angular.getTestability;
      assert(window.apgEV8 === 1,
        "getTestability getter should set window.apgEV8 = 1");
      assert(typeof testability.whenStable === "function",
        "getTestability should expose whenStable callback holder");

      let callbackRan = false;
      testability.whenStable(() => { callbackRan = true; });
      assert(callbackRan,
        "whenStable should invoke callback");

      assertConsistent("angular-gettestability-getter", {
        descriptorHasGetter: typeof desc.get === "function",
        apgEV8: window.apgEV8,
        whenStableType: typeof testability.whenStable,
        callbackRan,
      });
    } finally {
      if (previousAngular === undefined) delete window.angular; else window.angular = previousAngular;
      if (previousApg === undefined) delete window.apgEV8; else window.apgEV8 = previousApg;
    }
  `,
});
