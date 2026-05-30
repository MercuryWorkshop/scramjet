import { basicTest } from "../../testcommon.ts";

// Direct port of breadcrumb replace/pop/join helpers from
// data4/inner.js_translated.js:814-857.

export default basicTest({
	name: "cf-inner-breadcrumb-replace-pop-join",
	js: `
    let DbGvg5 = [];
    const cOVIw7 = 30;
    function sTuu5(q) {
      DbGvg5.length < cOVIw7 && DbGvg5.push(q);
    }
    function nJWjq3(q) {
      DbGvg5.length > 0 ? DbGvg5[DbGvg5.length - 1] = q : sTuu5(q);
    }
    function xXKy0() {
      DbGvg5.pop();
    }
    function LNrN0() {
      return DbGvg5.join(">");
    }
    function dHZo3() {
      DbGvg5 = [];
    }

    nJWjq3("first");
    sTuu5("second");
    nJWjq3("second-replaced");
    const joinedBeforePop = LNrN0();
    xXKy0();
    const joinedAfterPop = LNrN0();
    dHZo3();

    const observed = {
      joinedBeforePop,
      joinedAfterPop,
      lengthAfterClear: DbGvg5.length,
    };

    assert(joinedBeforePop === "first>second-replaced", "nJWjq3 should replace last crumb");
    assert(joinedAfterPop === "first", "xXKy0 should pop last crumb");
    assertConsistent("inner-breadcrumb-replace-pop-join", observed);
  `,
});
