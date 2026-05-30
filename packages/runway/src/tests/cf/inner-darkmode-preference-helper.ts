import { basicTest } from "../../testcommon.ts";

// Ports dark-mode selection from data4/inner.js_translated.js:4042-4074.

export default basicTest({
	name: "cf-inner-darkmode-preference-helper",
	js: `
    function computeDarkMode(env, Y, dw) {
      if (Y("dark-mode")) return false;
      if (typeof env.darkmode !== "undefined") return env.darkmode;
      if (typeof env._cf_chl_opt.ExKSG7 !== "undefined") return (env.darkmode = !!env._cf_chl_opt.ExKSG7);
      if (!dw() && env.matchMedia && env.matchMedia("(prefers-color-scheme: dark)").matches) return (env.darkmode = true);
      return (env.darkmode = false);
    }

    const explicitTrue = { _cf_chl_opt: { ExKSG7: 1 } };
    const explicitFalse = { _cf_chl_opt: { ExKSG7: 0 } };
    const mediaDark = { _cf_chl_opt: {}, matchMedia: () => ({ matches: true }) };
    const featureDisabled = { _cf_chl_opt: { ExKSG7: 1 } };

    const observed = {
      explicitTrue: computeDarkMode(explicitTrue, () => false, () => false),
      cached: computeDarkMode(explicitTrue, () => false, () => false),
      explicitFalse: computeDarkMode(explicitFalse, () => false, () => false),
      mediaDark: computeDarkMode(mediaDark, () => false, () => false),
      nwySkip: computeDarkMode({ _cf_chl_opt: {}, matchMedia: () => ({ matches: true }) }, () => false, () => true),
      flagDisabled: computeDarkMode(featureDisabled, (key) => key === "dark-mode", () => false),
    };

    assert(observed.explicitTrue === true, "ExKSG7 truthy should enable dark mode");
    assert(observed.explicitFalse === false, "ExKSG7 falsy should disable dark mode");
    assert(observed.flagDisabled === false, "dark-mode feature flag should force false");
    assertConsistent("inner-darkmode-preference-helper", observed);
  `,
});
