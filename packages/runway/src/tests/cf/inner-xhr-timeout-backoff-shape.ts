import { basicTest } from "../../testcommon.ts";

// Ports retry backoff from data4/inner.js_translated.js:3105-3109 and timeout scaling at 3113.

export default basicTest({
	name: "cf-inner-xhr-timeout-backoff-shape",
	js: `
    function retryShape(T) {
      return { delay: 250 * (T + 1), timeout: 5000 * (1 + T), nextAttempt: T + 1 };
    }
    const observed = { first: retryShape(0), third: retryShape(2) };
    assert(observed.first.delay === 250 && observed.first.timeout === 5000, "first retry delay/timeout should match source");
    assert(observed.third.delay === 750 && observed.third.timeout === 15000, "later retry delay/timeout should scale by attempt");
    assertConsistent("inner-xhr-timeout-backoff-shape", observed);
  `,
});
