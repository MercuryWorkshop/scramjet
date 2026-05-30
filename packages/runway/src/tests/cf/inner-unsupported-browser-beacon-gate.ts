import { basicTest } from "../../testcommon.ts";

// Ports the `unsupported_browser_beacon` feature gate from data4/inner.js_translated.js:4269-4271.

export default basicTest({
	name: "cf-inner-unsupported-browser-beacon-gate",
	js: `
    function Y(opt, key) {
      return opt.ziQHw8 && opt.ziQHw8.includes(key);
    }
    function run(opt) {
      const calls = [];
      const unsupported = true;
      if (unsupported) {
        calls.push("j:unsupported_browser");
        if (!Y(opt, "unsupported_browser_beacon")) calls.push("ulkK4");
        calls.push("reject");
      }
      return calls;
    }

    const observed = {
      ungated: run({ ziQHw8: [] }),
      gated: run({ ziQHw8: ["unsupported_browser_beacon"] }),
    };

    assert(observed.ungated.includes("ulkK4"), "ungated unsupported browser should report beacon");
    assert(!observed.gated.includes("ulkK4"), "feature flag should suppress unsupported browser beacon");
    assertConsistent("inner-unsupported-browser-beacon-gate", observed);
  `,
});
