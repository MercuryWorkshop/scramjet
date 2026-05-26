import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_20090_243 (line 25053-25074):
//   1. document.location.href → read current URL
//   2. history.replaceState({}, "", "https://example.org/") → temp navigate
//   3. history.replaceState({}, "", originalUrl) → navigate back
//   4. Marks state: OfPqX7 changes from "MtShb2" to "pASD3"
//
// p2_func_20101_109 (line 25108-25127):
//   Duplicate of 20090_243 with same logic
//
// p2_func_20062_85 (line 25129-25152):
//   Variant that removes a child element first, then same location/history logic
//
// p2_func_172199_181 (line 7125-7132):
//   navigator.onLine → typeof check → String conversion

export default basicTest({
  name: "cf-location-history",
  js: `
    // Check 1: document.location.href is readable (p2_func_20090_243)
    assert(typeof document.location.href === "string",
      "document.location.href should be a string");
    assert(document.location.href.length > 0,
      "document.location.href should not be empty");

    // Check 2: history object exists with expected methods
    assert(typeof history === "object",
      "history should be an object");
    assert(typeof history.back === "function",
      "history.back should be a function");
    assert(typeof history.forward === "function",
      "history.forward should be a function");
    assert(typeof history.go === "function",
      "history.go should be a function");
    assert(typeof history.replaceState === "function",
      "history.replaceState should be a function");

    // Check 3: history.replaceState with same-origin URL (p2_func_20090_243)
    // Turnstile navigates to "https://example.org/" and back
    // We can only test same-origin; Turnstile runs from the challenge domain
    const originalHref = document.location.href;
    try {
      const testUrl = new URL(document.location.href);
      testUrl.hash = "#turnstile-integrity-test";
      history.replaceState({}, "", testUrl.href);
      assert(document.location.href.indexOf("#turnstile-integrity-test") !== -1,
        "history.replaceState should update location.href");
    } finally {
      history.replaceState({}, "", originalHref);
    }

    // Check 4: document.location.protocol and hostname
    assert(typeof document.location.protocol === "string",
      "document.location.protocol should be a string");
    assert(typeof document.location.hostname === "string",
      "document.location.hostname should be a string");

    // Check 5: navigator.onLine value collection pattern
    assert(typeof navigator.onLine === "boolean",
      "navigator.onLine should be a boolean");
  `,
});