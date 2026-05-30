import { basicTest } from "../../testcommon.ts";

// Deferred execute branch from inner.js_translated.js:5842-5849 and 5933-5938:
//
//   execute before valid extraParams sets E = true. q7(...) later sets N = true,
//   then q9() clears E and invokes q8().

export default basicTest({
	name: "cf-inner-extra-params-deferred-execute",
	js: `
    let N = false;
    let E = false;
    let q8Calls = 0;
    let q7Calls = 0;

    function q8() { q8Calls++; }
    function q7() { N = true; q7Calls++; }
    function q9() {
      if (!E) return;
      E = false;
      q8();
    }

    function onMessage(qq) {
      if (qq.event === "extraParams") {
        if (N) return;
        q7();
        q9();
      } else if (qq.event === "execute") {
        if (!N) {
          E = true;
          return;
        }
        q8();
      }
    }

    onMessage({ event: "execute" });
    const afterExecute = { N, E, q7Calls, q8Calls };
    onMessage({ event: "extraParams" });
    const afterExtraParams = { N, E, q7Calls, q8Calls };
    onMessage({ event: "execute" });
    const afterReadyExecute = { N, E, q7Calls, q8Calls };
    const observed = { afterExecute, afterExtraParams, afterReadyExecute };

    assert(afterExecute.E === true && afterExecute.q8Calls === 0, "execute should defer before extraParams");
    assert(afterExtraParams.E === false && afterExtraParams.q8Calls === 1, "extraParams should flush deferred execute once");
    assert(afterReadyExecute.q8Calls === 2, "execute after extraParams should run immediately");
    assertConsistent("inner-extra-params-deferred-execute", observed);
  `,
});
