import { basicTest } from "../../testcommon.ts";

// Exact large-string construction from inner.vm_lifted.js:37-44:
//
//   window.nJWjq3(reg_17)
//   " ".repeat(1337331) + "0, /.*honk.*/, "
//   stack_5 = result
//
// The final reg_17[vm_func_472_142]() target is register-dependent, so this
// port preserves the exact observable string construction and nJWjq3 call only.

export default basicTest({
	name: "cf-inner-huge-repeat-honk-string",
	js: `
    const previousNJW = window.nJWjq3;
    const calls = [];

    try {
      window.nJWjq3 = function(value) { calls.push(value); };
      const reg_17 = { marker: "removed-iframe-placeholder" };
      window.nJWjq3(reg_17);
      const constructed = " ".repeat(1337331) + "0, /.*honk.*/, ";
      const suffix = "0, /.*honk.*/, ";

      const observed = {
        nJWjq3CallCount: calls.length,
        nJWjq3ArgumentMarker: calls[0] && calls[0].marker,
        length: constructed.length,
        expectedLength: 1337331 + suffix.length,
        prefixSpaces: constructed.slice(0, 5),
        suffix: constructed.slice(-suffix.length),
      };

      assert(observed.nJWjq3CallCount === 1, "nJWjq3 should be called once");
      assert(observed.length === observed.expectedLength, "huge honk string length mismatch");
      assert(observed.prefixSpaces === "     ", "huge honk prefix should be spaces");
      assert(observed.suffix === suffix, "huge honk suffix mismatch");
      assertConsistent("inner-huge-repeat-honk-string", observed);
    } finally {
      if (previousNJW === undefined) delete window.nJWjq3;
      else window.nJWjq3 = previousNJW;
    }
  `,
});
