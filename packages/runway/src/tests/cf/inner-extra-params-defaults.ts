import { basicTest } from "../../testcommon.ts";

// Default branches from inner.js_translated.js:5888-5909 when extraParams omits
// optional values: retry/refresh policy default to "auto", execution defaults to
// "render", appearance defaults to "always", and timing/counter fields default
// to 0.

export default basicTest({
	name: "cf-inner-extra-params-defaults",
	js: `
    const cfOpt = {};
    const qg = {};

    cfOpt.ybhNl8 = qg.retry || "auto";
    cfOpt.ulnYV8 = qg["retry-interval"] || 8000;
    cfOpt.WATg7 = qg["expiry-interval"] || 290000;
    cfOpt.IdPoo4 = qg.language || "auto";
    cfOpt.fbcuL0 = qg["refresh-expired"] || "auto";
    cfOpt.LLKqf9 = qg["refresh-timeout"] || "auto";
    cfOpt.zQqVj9 = qg.execution || "render";
    cfOpt.YlGz3 = qg.appearance || "always";
    cfOpt.TNXB9 = qg.ch || "";
    cfOpt.MIHUr2 = qg.au || "";
    cfOpt.fBtb1 = qg.wPr || {};
    cfOpt.ATpc7 = qg.timeLoadInitMs || 0;
    cfOpt.InJL2 = qg.timeExtraParamsMs || 0;
    cfOpt.NokC2 = qg.upgradeAttempts || 0;
    cfOpt.wWPia3 = qg.upgradeCompletedCount || 0;
    cfOpt.Xmve5 = qg.timeTiefMs || 0;
    cfOpt.DlSI3 = qg.timeInitMs || 0;
    cfOpt.HGlVr6 = qg.timeRenderMs || 0;
    cfOpt.vCBB5 = qg.timeParamsMs || 0;

    const observed = {
      ybhNl8: cfOpt.ybhNl8,
      ulnYV8: cfOpt.ulnYV8,
      WATg7: cfOpt.WATg7,
      IdPoo4: cfOpt.IdPoo4,
      fbcuL0: cfOpt.fbcuL0,
      LLKqf9: cfOpt.LLKqf9,
      zQqVj9: cfOpt.zQqVj9,
      YlGz3: cfOpt.YlGz3,
      TNXB9: cfOpt.TNXB9,
      MIHUr2: cfOpt.MIHUr2,
      fBtb1Keys: Object.keys(cfOpt.fBtb1),
      ATpc7: cfOpt.ATpc7,
      InJL2: cfOpt.InJL2,
      NokC2: cfOpt.NokC2,
      wWPia3: cfOpt.wWPia3,
      Xmve5: cfOpt.Xmve5,
      DlSI3: cfOpt.DlSI3,
      HGlVr6: cfOpt.HGlVr6,
      vCBB5: cfOpt.vCBB5,
    };

    assert(observed.ybhNl8 === "auto", "retry default mismatch");
    assert(observed.ulnYV8 === 8000, "retry interval default mismatch");
    assert(observed.WATg7 === 290000, "expiry interval default mismatch");
    assert(observed.IdPoo4 === "auto", "language default mismatch");
    assert(observed.fbcuL0 === "auto" && observed.LLKqf9 === "auto", "refresh policy defaults mismatch");
    assert(observed.zQqVj9 === "render" && observed.YlGz3 === "always", "render/appearance defaults mismatch");
    assert(observed.ATpc7 === 0 && observed.InJL2 === 0 && observed.Xmve5 === 0, "timing defaults mismatch");
    assertConsistent("inner-extra-params-defaults", observed);
  `,
});
