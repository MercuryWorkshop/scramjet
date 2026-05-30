import { basicTest } from "../../testcommon.ts";

// Ports C() retry guard from data4/inner.js_translated.js:3097-3099.

export default basicTest({
	name: "cf-inner-xhr-retry-guard",
	js: `
    function shouldAbort(flags, T) {
      function Y(key) { return flags.includes(key); }
      return Y("xhr-retry") || T >= 3;
    }
    const observed = {
      featureFlag: shouldAbort(["xhr-retry"], 0),
      belowLimit: shouldAbort([], 2),
      atLimit: shouldAbort([], 3),
    };
    assert(observed.featureFlag === true && observed.atLimit === true, "xhr retry should abort on flag or >=3 attempts");
    assert(observed.belowLimit === false, "xhr retry should proceed below limit");
    assertConsistent("inner-xhr-retry-guard", observed);
  `,
});
