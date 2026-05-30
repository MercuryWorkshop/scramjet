import { basicTest } from "../../testcommon.ts";

// Exact method chain from payload2_lifted.js:17826-17863:
//
//   Element.prototype.getBoundingClientRect -> "getBoundingClientRect"
//   Error.prototype.toString                -> "toString"
//   window.eval                             -> "eval"
//
// Preserve intended raw method types plus damaged owner types.

export default basicTest({
	name: "cf-element-error-eval-method-chain",
	js: `
    const observed = {
      getBoundingClientRect: {
        valueType: typeof Element.prototype.getBoundingClientRect,
        damagedOwnerType: typeof Element.prototype,
      },
      errorToString: {
        valueType: typeof Error.prototype.toString,
        damagedOwnerType: typeof Error.prototype,
      },
      eval: {
        valueType: typeof window.eval,
        damagedOwnerType: typeof window,
      },
    };

    assert(observed.getBoundingClientRect.valueType === "function",
      "Element.prototype.getBoundingClientRect should be function");
    assert(observed.errorToString.valueType === "function",
      "Error.prototype.toString should be function");
    assert(observed.eval.valueType === "function",
      "window.eval should be function");

    assertConsistent("element-error-eval-method-chain", observed);
  `,
});
