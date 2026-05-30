import { basicTest } from "../../testcommon.ts";

// Exact contiguous chain from payload2_lifted.js:17253-17357:
//
//   window.eval                              -> "eval"
//   EventTarget.prototype.addEventListener   -> "addEventListener"
//   EventTarget.prototype.dispatchEvent      -> "dispatchEvent"
//   EventTarget.prototype.removeEventListener-> "removeEventListener"
//   window.fetch                             -> "fetch"
//   Function.prototype.apply                 -> "apply"
//   Function.prototype.bind                  -> "bind"
//   Function.prototype.toString              -> "toString"
//
// The lifted code has type-register damage for each property read. Record raw
// value types and damaged owner types without adding native-code checks.

export default basicTest({
	name: "cf-eventtarget-fetch-function-typeof-chain",
	js: `
    const observed = {
      eval: { valueType: typeof window.eval, damagedOwnerType: typeof window },
      addEventListener: { valueType: typeof EventTarget.prototype.addEventListener, damagedOwnerType: typeof EventTarget.prototype },
      dispatchEvent: { valueType: typeof EventTarget.prototype.dispatchEvent, damagedOwnerType: typeof EventTarget.prototype },
      removeEventListener: { valueType: typeof EventTarget.prototype.removeEventListener, damagedOwnerType: typeof EventTarget.prototype },
      fetch: { valueType: typeof window.fetch, damagedOwnerType: typeof window },
      apply: { valueType: typeof Function.prototype.apply, damagedOwnerType: typeof Function.prototype },
      bind: { valueType: typeof Function.prototype.bind, damagedOwnerType: typeof Function.prototype },
      toString: { valueType: typeof Function.prototype.toString, damagedOwnerType: typeof Function.prototype },
    };

    for (const [name, shape] of Object.entries(observed)) {
      assert(shape.valueType === "function", name + " raw value type should be function, got: " + shape.valueType);
    }

    assertConsistent("eventtarget-fetch-function-typeof-chain", observed);
  `,
});
