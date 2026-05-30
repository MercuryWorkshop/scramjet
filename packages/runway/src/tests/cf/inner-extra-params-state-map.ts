import { basicTest } from "../../testcommon.ts";

// Exact extraParams state mapping from inner.js_translated.js:5879-5911.
// This ports the q7(...) field assignment block without the later challenge
// execution helpers, so runway tracks the capture-specific Turnstile option keys
// and defaults used by the translated data4 inner script.

export default basicTest({
	name: "cf-inner-extra-params-state-map",
	js: `
    const previousCfOpt = window._cf_chl_opt;
    const previousDateNow = Date.now;

    try {
      Date.now = function() { return 1234567890; };
      const b = window;
      b._cf_chl_opt = { xpbnF3: "runway-widget-extra-map", zFnv2: "fallback-u" };
      const qg = {
        action: "managed-action",
        cData: "managed-cdata",
        chlPageData: "page-data",
        url: "https://challenge.example/cdn-cgi/challenge-platform/h/b/flow/ov1/0.123",
        retry: "auto",
        "retry-interval": 8001,
        "expiry-interval": 290001,
        language: "fr-FR",
        "refresh-expired": "manual",
        "refresh-timeout": "never",
        execution: "execute",
        appearance: "interaction-only",
        ch: "challenge-hash",
        au: "api-url",
        wPr: { width: 300, height: 65 },
        timeLoadInitMs: 10,
        timeExtraParamsMs: 20,
        upgradeAttempts: 3,
        upgradeCompletedCount: 2,
        timeTiefMs: 30,
        timeInitMs: 40,
        timeRenderMs: 50,
        timeParamsMs: 60,
      };

      const origin = "https://parent.example";
      const apiJsMismatchReloadAttempts = 7;
      const apiJsMismatchReloadCompletedCount = 5;

      b._cf_chl_opt.IaLa3 = qg.action;
      b._cf_chl_opt.VoOn0 = qg.cData;
      b._cf_chl_opt.dfppG1 = qg.chlPageData;
      b._cf_chl_opt.UPWX8 = qg.url;
      b._cf_chl_opt.ybhNl8 = qg.retry || "auto";
      b._cf_chl_opt.ulnYV8 = qg["retry-interval"] || 8000;
      b._cf_chl_opt.WATg7 = qg["expiry-interval"] || 290000;
      b._cf_chl_opt.IdPoo4 = qg.language || "auto";
      b._cf_chl_opt.fbcuL0 = qg["refresh-expired"] || "auto";
      b._cf_chl_opt.LLKqf9 = qg["refresh-timeout"] || "auto";
      b._cf_chl_opt.zQqVj9 = qg.execution || "render";
      b._cf_chl_opt.YlGz3 = qg.appearance || "always";
      b._cf_chl_opt.PqZJ2 = origin;
      b._cf_chl_opt.TNXB9 = qg.ch || "";
      b._cf_chl_opt.MIHUr2 = qg.au || "";
      b._cf_chl_opt.fBtb1 = qg.wPr || {};
      b._cf_chl_opt.ATpc7 = qg.timeLoadInitMs || 0;
      b._cf_chl_opt.InJL2 = qg.timeExtraParamsMs || 0;
      b._cf_chl_opt.kAtRR1 = apiJsMismatchReloadAttempts;
      b._cf_chl_opt.mUTV7 = apiJsMismatchReloadCompletedCount;
      b._cf_chl_opt.NokC2 = qg.upgradeAttempts || 0;
      b._cf_chl_opt.wWPia3 = qg.upgradeCompletedCount || 0;
      b._cf_chl_opt.Xmve5 = qg.timeTiefMs || 0;
      b._cf_chl_opt.DlSI3 = qg.timeInitMs || 0;
      b._cf_chl_opt.HGlVr6 = qg.timeRenderMs || 0;
      b._cf_chl_opt.vCBB5 = qg.timeParamsMs || 0;
      b._cf_chl_opt.jqEN9 = Date.now();

      const observed = {
        IaLa3: b._cf_chl_opt.IaLa3,
        VoOn0: b._cf_chl_opt.VoOn0,
        dfppG1: b._cf_chl_opt.dfppG1,
        UPWX8: b._cf_chl_opt.UPWX8,
        ybhNl8: b._cf_chl_opt.ybhNl8,
        ulnYV8: b._cf_chl_opt.ulnYV8,
        WATg7: b._cf_chl_opt.WATg7,
        IdPoo4: b._cf_chl_opt.IdPoo4,
        fbcuL0: b._cf_chl_opt.fbcuL0,
        LLKqf9: b._cf_chl_opt.LLKqf9,
        zQqVj9: b._cf_chl_opt.zQqVj9,
        YlGz3: b._cf_chl_opt.YlGz3,
        PqZJ2: b._cf_chl_opt.PqZJ2,
        TNXB9: b._cf_chl_opt.TNXB9,
        MIHUr2: b._cf_chl_opt.MIHUr2,
        fBtb1: b._cf_chl_opt.fBtb1,
        ATpc7: b._cf_chl_opt.ATpc7,
        InJL2: b._cf_chl_opt.InJL2,
        kAtRR1: b._cf_chl_opt.kAtRR1,
        mUTV7: b._cf_chl_opt.mUTV7,
        NokC2: b._cf_chl_opt.NokC2,
        wWPia3: b._cf_chl_opt.wWPia3,
        Xmve5: b._cf_chl_opt.Xmve5,
        DlSI3: b._cf_chl_opt.DlSI3,
        HGlVr6: b._cf_chl_opt.HGlVr6,
        vCBB5: b._cf_chl_opt.vCBB5,
        jqEN9: b._cf_chl_opt.jqEN9,
      };

      assert(observed.IaLa3 === qg.action, "action should map to IaLa3");
      assert(observed.VoOn0 === qg.cData, "cData should map to VoOn0");
      assert(observed.dfppG1 === qg.chlPageData, "chlPageData should map to dfppG1");
      assert(observed.UPWX8 === qg.url, "url should map to UPWX8");
      assert(observed.LLKqf9 === "never", "refresh-timeout should map to LLKqf9");
      assert(observed.fbcuL0 === "manual", "refresh-expired should map to fbcuL0");
      assert(observed.kAtRR1 === 7 && observed.mUTV7 === 5, "reload counters should map through q7 args");
      assert(observed.jqEN9 === 1234567890, "jqEN9 should capture Date.now()");
      assertConsistent("inner-extra-params-state-map", observed);
    } finally {
      Date.now = previousDateNow;
      if (previousCfOpt === undefined) delete window._cf_chl_opt;
      else window._cf_chl_opt = previousCfOpt;
    }
  `,
});
