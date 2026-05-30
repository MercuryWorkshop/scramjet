import { basicTest } from "../../testcommon.ts";

// Ports main-wrapper class composition from data4/inner.js_translated.js:5278.

export default basicTest({
	name: "cf-inner-main-wrapper-class-flags",
	js: `
    function renderClasses(opt) {
      const T = document.createElement("div");
      T.classList.add("main-wrapper", ".omNy4");
      opt.ofon9 && T.classList.add("offlabel");
      opt.mJFtX5.rtl && T.classList.add("rtl");
      T.classList.add("theme-" + opt.NJat3, "size-" + opt.GbmE5, "lang-" + opt.mJFtX5.lang);
      return [...T.classList].sort();
    }

    const observed = {
      managedRtl: renderClasses({ ofon9: true, NJat3: "dark", GbmE5: "compact", mJFtX5: { rtl: true, lang: "ar" } }),
      interactiveLtr: renderClasses({ ofon9: false, NJat3: "light", GbmE5: "normal", mJFtX5: { rtl: false, lang: "en-us" } }),
    };

    assert(observed.managedRtl.includes("offlabel") && observed.managedRtl.includes("rtl"), "ofon9/rtl flags should add classes");
    assert(observed.interactiveLtr.includes("theme-light"), "theme class should include configured theme");
    assertConsistent("inner-main-wrapper-class-flags", observed);
  `,
});
