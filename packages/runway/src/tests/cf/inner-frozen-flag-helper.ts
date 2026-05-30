import { basicTest } from "../../testcommon.ts";

// Ports F() from data4/inner.js_translated.js:2926-2933.

export default basicTest({
	name: "cf-inner-frozen-flag-helper",
	js: `
    const oIvGL6 = { YBmkB4: false };
    function F() { oIvGL6.YBmkB4 = true; }
    F();
    const observed = { frozen: oIvGL6.YBmkB4 };
    assert(observed.frozen === true, "F should set YBmkB4");
    assertConsistent("inner-frozen-flag-helper", observed);
  `,
});
