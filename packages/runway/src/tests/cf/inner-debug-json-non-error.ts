import { basicTest } from "../../testcommon.ts";

// Ports the non-Error branch of oKAYx0 from data4/inner.js_translated.js:980-987.

export default basicTest({
	name: "cf-inner-debug-json-non-error",
	js: `
    function oKAYx0(W) {
      let f;
      if (W instanceof Error) f = W.message;
      else f = JSON.stringify(W);
      return { pMoH6: f, mcSlT9: undefined, yimO5: undefined, qmYAZ7: undefined, mWfy4: W };
    }

    const input = { reason: "synthetic", code: 17 };
    const normalized = oKAYx0(input);
    const observed = {
      message: normalized.pMoH6,
      hasFile: "mcSlT9" in normalized,
      sameObject: normalized.mWfy4 === input,
    };

    assert(normalized.pMoH6 === JSON.stringify(input), "non-Error values should stringify");
    assertConsistent("inner-debug-json-non-error", observed);
  `,
});
