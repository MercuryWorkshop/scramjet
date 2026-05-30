import { basicTest } from "../../testcommon.ts";

// Ports the status 400 fail envelope from data4/inner.js_translated.js:3127-3136.

export default basicTest({
	name: "cf-inner-xhr-fail-status400-envelope",
	js: `
    const opt = { xpbnF3: "wid", Lgky2: "rc", VNUtN0: "out", IWdn9: "sig", qxzT2: "fr" };
    function status400Fail(code) {
      return { source: "cloudflare-challenge", widgetId: opt.xpbnF3, event: "fail", rcV: opt.Lgky2, code, cfChlOut: opt.VNUtN0, cfChlOutS: opt.IWdn9, frMd: opt.qxzT2 };
    }
    const observed = status400Fail("600010");
    assert(observed.event === "fail" && observed.code === "600010", "status 400 should produce fail envelope with code");
    assertConsistent("inner-xhr-fail-status400-envelope", observed);
  `,
});
