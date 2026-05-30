import { basicTest } from "../../testcommon.ts";

// Ports feature flag helper Y() from data4/inner.js_translated.js:7087-7097.

export default basicTest({
	name: "cf-inner-feature-flag-includes-helper",
	js: `
    function Y(opt, q) {
      return opt.ziQHw8 && opt.ziQHw8.includes(q);
    }

    const observed = {
      missingList: Y({}, "api_js_mismatch_reload"),
      present: Y({ ziQHw8: ["api_js_mismatch_reload", "dark-mode"] }, "api_js_mismatch_reload"),
      absent: Y({ ziQHw8: ["dark-mode"] }, "api_js_mismatch_reload"),
    };

    assert(observed.present === true, "present flag should return true");
    assert(observed.absent === false, "absent flag should return false");
    assertConsistent("inner-feature-flag-includes-helper", observed);
  `,
});
