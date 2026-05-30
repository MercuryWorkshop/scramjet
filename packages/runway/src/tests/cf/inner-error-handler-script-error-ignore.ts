import { basicTest } from "../../testcommon.ts";

// Ports early-return filtering in the global error handler from
// data4/inner.js_translated.js:989-1035.

export default basicTest({
	name: "cf-inner-error-handler-script-error-ignore",
	js: `
    const previousError = console.error;
    const calls = [];
    try {
      console.error = (...args) => calls.push(args.map(String));
      let reported = 0;
      let JCzq5 = 0;
      let njYvc7 = false;

      function ulkK4() { reported++; }
      function handler(T) {
        if (T.message.toLowerCase().indexOf("script error") > -1) return;
        if (njYvc7) return;
        console.error("[Cloudflare Turnstile] Unhandled error:", T.message, ", with debug info:", "crumb");
        if (T.error && T.error.ObQqT1) return void (njYvc7 = true, JCzq5++);
        ulkK4();
      }

      handler({ message: "Script error.", filename: "x", lineno: 1, colno: 2, error: new Error("ignored") });

      const observed = { reported, JCzq5, consoleCalls: calls.length, njYvc7 };
      assert(reported === 0 && calls.length === 0, "script error should be ignored before logging/reporting");
      assertConsistent("inner-error-handler-script-error-ignore", observed);
    } finally {
      console.error = previousError;
    }
  `,
});
