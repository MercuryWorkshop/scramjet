import { basicTest } from "../../testcommon.ts";

// Ports error-code-to-translation-key map Q() from data4/inner.js_translated.js:2934-2963.

export default basicTest({
	name: "cf-inner-error-code-translation-map",
	js: `
    function Q(W) {
      if (110100 === W || W === 110110 || W === 400020) return "invalid_sitekey";
      else if (W === 110200) return "invalid_domain";
      else if (W === 110600) return "time_check_cached_warning";
      else if (W === 110620) return "turnstile_expired";
      return undefined;
    }

    const observed = {
      sitekeyA: Q(110100),
      sitekeyB: Q(110110),
      sitekeyC: Q(400020),
      domain: Q(110200),
      time: Q(110600),
      expired: Q(110620),
      unknownType: typeof Q(123),
    };

    assert(observed.sitekeyA === "invalid_sitekey", "110100 should map to invalid_sitekey");
    assert(observed.unknownType === "undefined", "unknown codes should be undefined");
    assertConsistent("inner-error-code-translation-map", observed);
  `,
});
