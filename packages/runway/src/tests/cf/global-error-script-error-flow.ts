import { basicTest } from "../../testcommon.ts";

// Narrow observable port of the global error handler flow at
// payload2_lifted.js:454-583:
//
//   read event.error / event.message / filename / lineno / colno
//   message.toLowerCase().indexOf("script error") gate
//   window.njYvc7 = false
//   console.error("[Cloudflare Turnstile] Unexpected error caught:", message,
//     ", with debug info:", window.LNrN0())
//   state.qZqeT2 = 4
//   state.dnsDH6 = message || ""
//   if error is present on the throw path, mark error.ObQqT1 = true
//
// Ambient VM calls (`ulkK4`, `AJGm5`) are intentionally not recreated.

export default basicTest({
	name: "cf-global-error-script-error-flow",
	js: `
    const previousNJ = window.njYvc7;
    const previousDebug = window.LNrN0;
    const previousConsoleError = console.error;
    const captured = [];

    try {
      window.LNrN0 = function() { return { debug: "runway-debug-info" }; };
      console.error = function(...args) { captured.push(args); };

      const state = { AJGm5: null, qZqeT2: 0, dnsDH6: "" };
      const eventError = new Error("script flow error");
      const eventLike = {
        message: "prefix Script error.",
        filename: "https://example.invalid/script.js",
        lineno: 7,
        colno: 13,
        error: eventError,
      };

      const record = {};
      eventLike.error;
      eventLike.message;
      const lower = eventLike.message.toLowerCase();
      const scriptErrorIndex = lower.indexOf("script error");
      if (scriptErrorIndex) {
        window.njYvc7 = false;
        record.pMoH6 = eventLike.message;
        record.mcSlT9 = eventLike.filename;
        record.yimO5 = eventLike.lineno;
        record.qmYAZ7 = eventLike.colno;
        record.mWfy4 = eventLike.error;
        console.error("[Cloudflare Turnstile] Unexpected error caught:", eventLike.message, ", with debug info:", window.LNrN0());
        state.qZqeT2 = 4;
        state.dnsDH6 = eventLike.message ? eventLike.message : "";
        if (eventLike.error) eventLike.error.ObQqT1 = true;
      }

      const observed = {
        scriptErrorIndex,
        njYvc7: window.njYvc7,
        record: {
          pMoH6: record.pMoH6,
          mcSlT9: record.mcSlT9,
          yimO5: record.yimO5,
          qmYAZ7: record.qmYAZ7,
          errorName: record.mWfy4 && record.mWfy4.name,
        },
        consoleArgs: captured[0] && [captured[0][0], captured[0][1], captured[0][2], captured[0][3].debug],
        state: { qZqeT2: state.qZqeT2, dnsDH6: state.dnsDH6 },
        errorMarked: eventError.ObQqT1 === true,
      };

      assert(observed.scriptErrorIndex > 0, "script error substring gate should be non-zero for this fixture");
      assert(observed.njYvc7 === false, "njYvc7 should be false");
      assert(observed.state.qZqeT2 === 4, "qZqeT2 should be 4");
      assert(observed.errorMarked === true, "error should be marked ObQqT1");
      assertConsistent("global-error-script-error-flow", observed);
    } finally {
      console.error = previousConsoleError;
      if (previousDebug === undefined) delete window.LNrN0;
      else window.LNrN0 = previousDebug;
      if (previousNJ === undefined) delete window.njYvc7;
      else window.njYvc7 = previousNJ;
    }
  `,
});
