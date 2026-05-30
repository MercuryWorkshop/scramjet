import { basicTest } from "../../testcommon.ts";

// Exact translated URLSearchParams block from inner.js_translated.js:671-675:
//
//   const queryString = window.location.search;
//   const urlParams = new URLSearchParams(queryString);
//   if (urlParams.has("__cfDebugTurnstileOutcome")) {
//     window.__cfDebugTurnstileOutcome = urlParams.get("__cfDebugTurnstileOutcome");
//   }

export default basicTest({
	name: "cf-debug-turnstile-outcome-urlparams",
	js: `
    const originalHref = location.href;
    const originalOutcome = window.__cfDebugTurnstileOutcome;
    const value = "runway-debug-outcome";

    try {
      const url = new URL(location.href);
      url.searchParams.set("__cfDebugTurnstileOutcome", value);
      history.pushState({}, "", url.href);

      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      if (urlParams.has("__cfDebugTurnstileOutcome")) {
        window.__cfDebugTurnstileOutcome = urlParams.get("__cfDebugTurnstileOutcome");
      }

      const observed = {
        search: window.location.search,
        hasOutcome: urlParams.has("__cfDebugTurnstileOutcome"),
        paramValue: urlParams.get("__cfDebugTurnstileOutcome"),
        globalValue: window.__cfDebugTurnstileOutcome,
      };

      assert(observed.hasOutcome === true, "URLSearchParams should find debug outcome");
      assert(observed.paramValue === value, "debug outcome param mismatch");
      assert(observed.globalValue === value, "debug outcome global mismatch");
      assertConsistent("debug-turnstile-outcome-urlparams", observed);
    } finally {
      history.replaceState({}, "", originalHref);
      if (originalOutcome === undefined) delete window.__cfDebugTurnstileOutcome;
      else window.__cfDebugTurnstileOutcome = originalOutcome;
    }
  `,
});
