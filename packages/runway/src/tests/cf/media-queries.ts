import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_12897_251 (line 26057-26081):
//   1. matchMedia("(prefers-color-scheme: dark)").matches → stores as boolean
//   2. matchMedia("(forced-colors: active)").matches → stores as boolean
//   3. matchMedia("(prefers-contrast: more)").matches
//      → if true → p2_func_13229_67 (skip other contrast queries)
//   4. matchMedia("(prefers-contrast: less)").matches → if true → skip
//   5. → p2_func_13232_45: matchMedia("(prefers-contrast: custom)").matches
//      → if true → p2_func_13315_227
//   6. → p2_func_13318_141:
//      a. matchMedia("(prefers-reduced-motion: reduce)").matches
//      b. matchMedia("(inverted-colors: inverted)").matches
//      c. matchMedia("(prefers-reduced-data: reduce)").matches
//      d. matchMedia("(prefers-reduced-transparency: reduce)").matches
//      e. Check performance exists → p2_func_13732_237
// p2_func_13315_227: same as 13318_141 but with different register init

export default basicTest({
	name: "cf-media-queries",
	js: `
    // window.matchMedia must be a function
    assert(typeof window.matchMedia === "function",
      "window.matchMedia should be a function");

    // Step 1: prefers-color-scheme: dark (p2_func_12897_251)
    const csDark = matchMedia("(prefers-color-scheme: dark)");
    assert(typeof csDark.matches === "boolean",
      "matchMedia('prefers-color-scheme: dark').matches should be a boolean");
    assert(typeof csDark.media === "string",
      "matchMedia result should have .media string property");
    assert(typeof csDark.addEventListener === "function",
      "matchMedia result should have addEventListener");

    // Step 2: forced-colors: active (p2_func_12897_251)
    const fcActive = matchMedia("(forced-colors: active)");
    assert(typeof fcActive.matches === "boolean",
      "matchMedia('forced-colors: active').matches should be a boolean");

    // Step 3: prefers-contrast cascade (p2_func_12897_251 + p2_func_13232_45)
    const pcMore = matchMedia("(prefers-contrast: more)");
    assert(typeof pcMore.matches === "boolean",
      "matchMedia('prefers-contrast: more').matches should be a boolean");

    if (!pcMore.matches) {
      const pcLess = matchMedia("(prefers-contrast: less)");
      assert(typeof pcLess.matches === "boolean",
        "matchMedia('prefers-contrast: less').matches should be a boolean");

      if (!pcLess.matches) {
        const pcCustom = matchMedia("(prefers-contrast: custom)");
        assert(typeof pcCustom.matches === "boolean",
          "matchMedia('prefers-contrast: custom').matches should be a boolean");
      }
    }

    // Step 4: prefers-reduced-motion: reduce (p2_func_13318_141)
    const prm = matchMedia("(prefers-reduced-motion: reduce)");
    assert(typeof prm.matches === "boolean",
      "matchMedia('prefers-reduced-motion').matches should be a boolean");

    // Step 5: inverted-colors: inverted (p2_func_13318_141)
    const invColor = matchMedia("(inverted-colors: inverted)");
    assert(typeof invColor.matches === "boolean",
      "matchMedia('inverted-colors').matches should be a boolean");

    // Step 6: prefers-reduced-data: reduce (p2_func_13318_141)
    const prd = matchMedia("(prefers-reduced-data: reduce)");
    assert(typeof prd.matches === "boolean",
      "matchMedia('prefers-reduced-data').matches should be a boolean");

    // Step 7: prefers-reduced-transparency: reduce (p2_func_13318_141)
    const prt = matchMedia("(prefers-reduced-transparency: reduce)");
    assert(typeof prt.matches === "boolean",
      "matchMedia('prefers-reduced-transparency').matches should be a boolean");
  `,
});
