import { basicTest } from "../../testcommon.ts";

// Ports response header capture helper R() from data4/inner.js_translated.js:7068-7074.

export default basicTest({
	name: "cf-inner-response-header-capture",
	js: `
    const opt = {};
    function R(q) {
      if (!q) return;
      const S = q.getResponseHeader("cf-chl-out");
      S && (opt.VNUtN0 = S);
      const f = q.getResponseHeader("cf-chl-out-s");
      f && (opt.IWdn9 = f);
    }

    R({ getResponseHeader: (name) => ({ "cf-chl-out": "out-value", "cf-chl-out-s": "sig-value" })[name] || null });
    const afterSet = { ...opt };
    R({ getResponseHeader: () => null });
    const observed = { afterSet, afterEmpty: { ...opt } };

    assert(opt.VNUtN0 === "out-value" && opt.IWdn9 === "sig-value", "cf-chl-out headers should be captured");
    assertConsistent("inner-response-header-capture", observed);
  `,
});
