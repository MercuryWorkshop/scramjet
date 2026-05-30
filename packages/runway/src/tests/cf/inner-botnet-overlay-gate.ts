import { basicTest } from "../../testcommon.ts";

// Botnet overlay gate from inner.js_translated.js:4724-4734:
//
//   !b._cf_chl_opt.ofon9 && dg(s("turnstile_botnet"), "botnet-overlay")

export default basicTest({
	name: "cf-inner-botnet-overlay-gate",
	js: `
    const overlays = [];
    function s(key) { return key === "turnstile_botnet" ? "Botnet detected" : key; }
    function dg(content, className) { overlays.push({ content, className }); }
    function render(ofon9) {
      const b = { _cf_chl_opt: { ofon9 } };
      if (!b._cf_chl_opt.ofon9) dg(s("turnstile_botnet"), "botnet-overlay");
    }

    render(false);
    render(true);

    const observed = { overlays };
    assert(overlays.length === 1, "botnet overlay should render only when ofon9 is false");
    assert(overlays[0].content === "Botnet detected", "botnet translation key should be used");
    assert(overlays[0].className === "botnet-overlay", "botnet overlay class mismatch");
    assertConsistent("inner-botnet-overlay-gate", observed);
  `,
});
