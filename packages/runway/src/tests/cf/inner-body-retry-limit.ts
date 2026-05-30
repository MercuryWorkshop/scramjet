import { basicTest } from "../../testcommon.ts";

// Ports missing-body retry limit from data4/inner.js_translated.js:5790.

export default basicTest({
	name: "cf-inner-body-retry-limit",
	js: `
    let q3 = 100;
    let failCalls = 0;
    let retryCalls = 0;
    function q4(hasBody) {
      if (!hasBody) return ++q3 > 100 ? void (q3 = 0, failCalls++) : void retryCalls++;
      q3 = 0;
    }
    q4(false);
    const afterFail = { q3, failCalls, retryCalls };
    q4(false);
    const afterRetry = { q3, failCalls, retryCalls };
    q4(true);
    const observed = { afterFail, afterRetry, afterBody: { q3, failCalls, retryCalls } };
    assert(afterFail.failCalls === 1 && afterFail.q3 === 0, "after >100 missing body retries, q4 should fail and reset q3");
    assert(afterRetry.retryCalls === 1, "below limit missing body should schedule retry");
    assertConsistent("inner-body-retry-limit", observed);
  `,
});
