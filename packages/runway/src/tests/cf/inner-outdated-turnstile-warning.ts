import { basicTest } from "../../testcommon.ts";

// Warning threshold from inner.js_translated.js:5900-5911:
//
//   (ATpc7 > 432e5 || InJL2 > 432e5) && console.warn(
//     "[Cloudflare Turnstile] You are using an outdated version of Turnstile..."
//   )

export default basicTest({
	name: "cf-inner-outdated-turnstile-warning",
	js: `
    const previousWarn = console.warn;

    try {
      const warnings = [];
      console.warn = function(...args) { warnings.push(args.join(" ")); };

      function applyTiming(qg) {
        const cfOpt = {};
        cfOpt.ATpc7 = qg.timeLoadInitMs || 0;
        cfOpt.InJL2 = qg.timeExtraParamsMs || 0;
        if (cfOpt.ATpc7 > 432e5 || cfOpt.InJL2 > 432e5) {
          console.warn("[Cloudflare Turnstile] You are using an outdated version of Turnstile, which may cause challenge failures. Please make sure to embed the latest version.");
        }
        return cfOpt;
      }

      const normal = applyTiming({ timeLoadInitMs: 43200000, timeExtraParamsMs: 1 });
      const staleLoad = applyTiming({ timeLoadInitMs: 43200001, timeExtraParamsMs: 0 });
      const staleExtra = applyTiming({ timeLoadInitMs: 0, timeExtraParamsMs: 43200001 });
      const observed = {
        normal,
        staleLoad,
        staleExtra,
        warningCount: warnings.length,
        warningPrefix: warnings[0] && warnings[0].slice(0, 23),
      };

      assert(warnings.length === 2, "outdated warning should trigger only for values greater than 432e5");
      assert(warnings.every((value) => value.includes("outdated version of Turnstile")), "warning text mismatch");
      assertConsistent("inner-outdated-turnstile-warning", observed);
    } finally {
      console.warn = previousWarn;
    }
  `,
});
