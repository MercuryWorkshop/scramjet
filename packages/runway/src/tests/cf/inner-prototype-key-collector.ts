import { basicTest } from "../../testcommon.ts";

// Ports dL() prototype key collector from data4/inner.js_translated.js:5502-5510.

export default basicTest({
	name: "cf-inner-prototype-key-collector",
	js: `
    const proto = { inheritedOne: true };
    const obj = Object.create(proto);
    obj.ownOne = true;
    function dL(q) {
      let W = [];
      for (; q !== null; W = W.concat(Object.keys(q)), q = Object.getPrototypeOf(q));
      return W;
    }
    const keys = dL(obj);
    const observed = { keys, hasOwn: keys.includes("ownOne"), hasInherited: keys.includes("inheritedOne") };
    assert(observed.hasOwn && observed.hasInherited, "dL should collect own keys across prototype chain");
    assertConsistent("inner-prototype-key-collector", observed);
  `,
});
