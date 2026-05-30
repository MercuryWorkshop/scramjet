import { basicTest } from "../../testcommon.ts";

// Ports the early feature-flag skip from data4/inner.js_translated.js:7194-7196.

export default basicTest({
	name: "cf-inner-time-check-flag-skip",
	js: `
    function Y(opt, key) {
      return opt.ziQHw8 && opt.ziQHw8.includes(key);
    }
    function go(opt, q, W, T, f) {
      let N = Y(opt, W);
      N = N || Y(opt, "time-check-fail-error");
      if (N) return { result: true, failed: false };
      const tooSkewed = Math.abs(Math.floor(Date.now() / 1000) - parseInt(opt.CjLF6, 10)) > q;
      return { result: !tooSkewed, failed: tooSkewed, code: tooSkewed ? f : undefined };
    }

    const observed = {
      directSkip: go({ ziQHw8: ["time-check"], CjLF6: "0" }, 43200, "time-check", "time_check_cached_warning", "200100"),
      errorSkip: go({ ziQHw8: ["time-check-fail-error"], CjLF6: "0" }, 43200, "time-check", "time_check_cached_warning", "200100"),
      failShape: go({ ziQHw8: [], CjLF6: "0" }, 43200, "time-check", "time_check_cached_warning", "200100"),
    };

    assert(observed.directSkip.result === true && observed.directSkip.failed === false, "time-check flag should skip failure");
    assert(observed.errorSkip.result === true && observed.errorSkip.failed === false, "time-check-fail-error flag should skip failure");
    assert(observed.failShape.code === "200100", "unskipped skew failure should carry source code");
    assertConsistent("inner-time-check-flag-skip", observed);
  `,
});
