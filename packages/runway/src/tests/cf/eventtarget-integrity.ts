import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_101299_251: checks EventTarget.prototype.addEventListener exists
//   → the VM code accesses `reg_17.addEventListener` and expects it to be truthy
//   → if falsy → FAIL (property missing)
//   → then verifies toString() reveals native code
//   → chains to removeEventListener
// p2_func_101726_237: checks EventTarget.prototype.removeEventListener exists
//   → same pattern, chains to dispatchEvent
// p2_func_102149_249: checks EventTarget.prototype.dispatchEvent exists
//   → same pattern, chains to next check
//
// Scramjet patches EventTarget.prototype.addEventListener/removeEventListener
// via client.Proxy() in event.ts. The proxy replaces the property value with
// a Proxy wrapper. The VM checks:
//   1. Property exists on prototype (typeof === "function")
//   2. toString() reveals "native code" (not "bound" or custom wrapper code)
//   3. toString().name doesn't contain "bound" (p2_func_86499_133 pattern)

export default basicTest({
  name: "cf-eventtarget-integrity",
  js: `
    const methods = ["addEventListener", "removeEventListener", "dispatchEvent"];

    for (const method of methods) {
      // Step 1: property must exist and be a function
      const fn = EventTarget.prototype[method];
      assert(typeof fn === "function",
        "EventTarget.prototype." + method + " should be a function");

      // Step 2: toString() must show native code
      const fnStr = fn.toString();
      assert(fnStr.indexOf("native code") !== -1 || fnStr.indexOf("[native code]") !== -1,
        "EventTarget.prototype." + method + " should show native code in toString: " + fnStr.substring(0, 60));

      // Step 3: toString().name must not contain "bound"
      // (scramjet's Proxy wrappers would show as "bound" if patched)
      const strName = fn.toString().name || "";
      assert(strName.indexOf("bind") === -1,
        "EventTarget.prototype." + method + " toString name should not contain 'bind'");
    }
  `,
});