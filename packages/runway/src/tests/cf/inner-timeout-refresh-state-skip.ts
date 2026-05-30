import { basicTest } from "../../testcommon.ts";

// Ports the turnstile-timeout-state early return from data4/inner.js_translated.js:3803.

export default basicTest({
	name: "cf-inner-timeout-refresh-state-skip",
	js: `
    const calls = [];
    function dK(flags) {
      function Y(key) { return flags.includes(key); }
      if (Y("turnstile-timeout-state")) return;
      calls.push("attach-or-hide");
      calls.push("db:timeout:grid");
    }
    dK(["turnstile-timeout-state"]);
    const afterSkip = calls.slice();
    dK([]);
    const observed = { afterSkip, afterRun: calls.slice() };
    assert(afterSkip.length === 0, "turnstile-timeout-state flag should skip timeout state work");
    assertConsistent("inner-timeout-refresh-state-skip", observed);
  `,
});
