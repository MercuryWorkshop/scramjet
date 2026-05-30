import { basicTest } from "../../testcommon.ts";

// Exact environment branch from payload2_lifted.js:27747-27836 and
// media-query chain at 27914-28021:
//
//   window.navigator read
//   window.matchMedia gate
//   matchMedia("(prefers-color-scheme: dark)").matches      -> IebN9
//   matchMedia("(forced-colors: active)").matches           -> obVm2
//   matchMedia("(prefers-contrast: more|less|custom)")      -> XPNi1 branch
//   matchMedia("(prefers-reduced-motion: reduce)").matches  -> smdtw6
//   matchMedia("(inverted-colors: inverted)").matches       -> bIcp4
//   matchMedia("(prefers-reduced-data: reduce)").matches    -> qpHoh1
//   matchMedia("(prefers-reduced-transparency: reduce)")    -> JKLQJ2
//   performance.getEntriesByType("navigation")[0].type      -> hSGw0 fallback unknown
//   document.referrer / navigator.getGamepads / navigator.getBattery reads

export default basicTest({
	name: "cf-matchmedia-navigation-gamepad-battery",
	js: `
    const media = typeof matchMedia === "function" ? {
      colorSchemeDark: matchMedia("(prefers-color-scheme: dark)").matches,
      forcedColorsActive: matchMedia("(forced-colors: active)").matches,
      prefersContrastMore: matchMedia("(prefers-contrast: more)").matches,
      prefersContrastLess: matchMedia("(prefers-contrast: less)").matches,
      prefersContrastCustom: matchMedia("(prefers-contrast: custom)").matches,
      prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      invertedColors: matchMedia("(inverted-colors: inverted)").matches,
      prefersReducedData: matchMedia("(prefers-reduced-data: reduce)").matches,
      prefersReducedTransparency: matchMedia("(prefers-reduced-transparency: reduce)").matches,
    } : null;

    const navEntries = performance && typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("navigation")
      : [];
    const firstNavigation = navEntries && navEntries.length > 0 ? navEntries[0] : null;

    const observed = {
      navigatorType: typeof window.navigator,
      matchMediaType: typeof window.matchMedia,
      media,
      navigationEntryCount: navEntries ? navEntries.length : null,
      navigationType: firstNavigation && firstNavigation.type ? firstNavigation.type : "unknown",
      referrer: document.referrer,
      getGamepadsType: typeof navigator.getGamepads,
      getBatteryType: typeof navigator.getBattery,
      permissionsType: typeof navigator.permissions,
    };

    assert(observed.navigatorType === "object",
      "window.navigator should be object, got: " + observed.navigatorType);
    assert(observed.matchMediaType === "function",
      "window.matchMedia should be function, got: " + observed.matchMediaType);

    assertConsistent("matchmedia-navigation-gamepad-battery", observed);
  `,
});
