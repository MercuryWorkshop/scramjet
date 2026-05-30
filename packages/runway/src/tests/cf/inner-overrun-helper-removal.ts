import { basicTest } from "../../testcommon.ts";

// Ports H() helper-loop removal from data4/inner.js_translated.js:4601-4617.

export default basicTest({
	name: "cf-inner-overrun-helper-removal",
	js: `
    const wrapper = document.createElement("div");
    wrapper.id = "fr-helper-loop-wrapper";
    document.body.appendChild(wrapper);
    try {
      function dh(id) { return document.getElementById(id); }
      function H(opt) { if (!opt.ZAvY1) return; dh("fr-helper-loop-wrapper").remove(); }
      H({ ZAvY1: false });
      const afterSkip = !!document.getElementById("fr-helper-loop-wrapper");
      H({ ZAvY1: true });
      const observed = { afterSkip, afterRemove: !!document.getElementById("fr-helper-loop-wrapper") };
      assert(afterSkip === true && observed.afterRemove === false, "H should remove helper only when ZAvY1 is enabled");
      assertConsistent("inner-overrun-helper-removal", observed);
    } finally { wrapper.remove(); }
  `,
});
