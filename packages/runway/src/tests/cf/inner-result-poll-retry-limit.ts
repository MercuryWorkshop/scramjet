import { basicTest } from "../../testcommon.ts";

// Ports gp() retry limit from data4/inner.js_translated.js:7587-7590.

export default basicTest({
	name: "cf-inner-result-poll-retry-limit",
	js: `
    function gp(flags, q) {
      function Y(key) { return flags.includes(key); }
      if (Y("turnstile-result-poll")) return "skipped";
      q = q || 0;
      if (q > 5) return "fail";
      return "poll";
    }
    const observed = { skipped: gp(["turnstile-result-poll"], 0), zero: gp([], 0), five: gp([], 5), six: gp([], 6) };
    assert(observed.six === "fail", "gp should fail after more than five retries");
    assert(observed.skipped === "skipped", "feature flag should skip polling");
    assertConsistent("inner-result-poll-retry-limit", observed);
  `,
});
