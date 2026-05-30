import { basicTest } from "../../testcommon.ts";

// Exact header propagation helper from inner.js_translated.js:7068-7074:
//   getResponseHeader("cf-chl-out") -> _cf_chl_opt.VNUtN0
//   getResponseHeader("cf-chl-out-s") -> _cf_chl_opt.IWdn9

export default basicTest({
	name: "cf-xhr-response-cf-chl-out-headers",
	js: `
    const calls = [];
    const fakeXhr = {
      getResponseHeader(name) {
        calls.push(name);
        if (name === "cf-chl-out") return "out-header-value";
        if (name === "cf-chl-out-s") return "out-s-header-value";
        return null;
      },
    };
    window._cf_chl_opt = {};

    try {
      const q = fakeXhr;
      if (q) {
        const S = q.getResponseHeader("cf-chl-out");
        S && (window._cf_chl_opt.VNUtN0 = S);
        const f = q.getResponseHeader("cf-chl-out-s");
        f && (window._cf_chl_opt.IWdn9 = f);
      }

      const observed = {
        calls,
        VNUtN0: window._cf_chl_opt.VNUtN0,
        IWdn9: window._cf_chl_opt.IWdn9,
      };

      assert(calls.join("|") === "cf-chl-out|cf-chl-out-s", "header read order mismatch");
      assert(observed.VNUtN0 === "out-header-value", "cf-chl-out propagation mismatch");
      assert(observed.IWdn9 === "out-s-header-value", "cf-chl-out-s propagation mismatch");
      assertConsistent("xhr-response-cf-chl-out-headers", observed);
    } finally {
      delete window._cf_chl_opt;
    }
  `,
});
