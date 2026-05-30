import { basicTest } from "../../testcommon.ts";

// Ports the turnstile-expired-state early return from data4/inner.js_translated.js:6393.

export default basicTest({
	name: "cf-inner-expired-state-skip",
	js: `
    const calls = [];
    function de(flags) {
      function Y(key) { return flags.includes(key); }
      if (Y("turnstile-expired-state")) return;
      calls.push("attach-or-hide");
      calls.push("db:expired:grid");
      calls.push("F");
    }
    de(["turnstile-expired-state"]);
    const afterSkip = calls.slice();
    de([]);
    const observed = { afterSkip, afterRun: calls.slice() };
    assert(afterSkip.length === 0, "turnstile-expired-state flag should skip expired state work");
    assertConsistent("inner-expired-state-skip", observed);
  `,
});
