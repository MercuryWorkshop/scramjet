import { basicTest } from "../../testcommon.ts";

// Ports the special ObQqT1 fail-once branch from data4/inner.js_translated.js:1023-1034.

export default basicTest({
	name: "cf-inner-error-handler-obqqt-fail-once",
	js: `
    const previousError = console.error;
    const logs = [];
    try {
      console.error = (...args) => logs.push(args.map(String));
      let njYvc7 = false;
      let failCalls = 0;
      let reports = 0;
      function JCzq5() { failCalls++; }
      function ulkK4() { reports++; }
      function LNrN0() { return "a>b"; }

      function handler(T) {
        if (T.message.toLowerCase().indexOf("script error") > -1) return;
        if (njYvc7) return;
        console.error("[Cloudflare Turnstile] Unhandled error:", T.message, ", with debug info:", LNrN0());
        if (T.error && T.error.ObQqT1) return void (njYvc7 = true, JCzq5());
        ulkK4();
      }

      handler({ message: "first", filename: "inner.js", lineno: 1, colno: 2, error: { ObQqT1: true } });
      handler({ message: "second", filename: "inner.js", lineno: 3, colno: 4, error: { ObQqT1: true } });

      const observed = { failCalls, reports, logs: logs.length, njYvc7, debugMarker: logs[0]?.[2] };
      assert(failCalls === 1, "ObQqT1 branch should call JCzq5 once");
      assert(reports === 0, "ObQqT1 branch should not call ulkK4");
      assertConsistent("inner-error-handler-obqqt-fail-once", observed);
    } finally {
      console.error = previousError;
    }
  `,
});
