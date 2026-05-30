import { basicTest } from "../../testcommon.ts";

// Source-backed getter trap from inner.vm_lifted.js:125-135, traversal at
// 181-197, and getter at 204-211:
//
//   1. collector includes { window: ["frameElement"] }
//   2. window.BPOu4 is an array
//   3. original value is stored under logical key "window.frameElement"
//   4. Object.defineProperty(target, "frameElement", {
//        get: getter,
//        configurable: false,
//        enumerable: false,
//      })
//   5. getter pushes the logical key into window.BPOu4
//
// The real target is window.frameElement and the descriptor is non-configurable.
// This test uses a sacrificial object to preserve descriptor semantics without
// permanently mutating the real Window object.

export default basicTest({
	name: "cf-inner-frameelement-getter-trap",
	js: `
    const previousBPOu4 = window.BPOu4;
    try {
      window.BPOu4 = [];
      const target = {};
      const logicalKey = "window.frameElement";
      const originalValue = window.frameElement;

      Object.defineProperty(target, "frameElement", {
        get() {
          window.BPOu4.push(logicalKey);
          return originalValue;
        },
        configurable: false,
        enumerable: false,
      });

      const desc = Object.getOwnPropertyDescriptor(target, "frameElement");
      assert(desc !== undefined, "sacrificial frameElement descriptor should exist");
      assert(typeof desc.get === "function", "frameElement descriptor getter should be function");
      assert(desc.configurable === false, "frameElement descriptor should be non-configurable");
      assert(desc.enumerable === false, "frameElement descriptor should be non-enumerable");

      const value = target.frameElement;
      assert(value === originalValue, "getter should return stored original frameElement value");
      assert(window.BPOu4.length === 1 && window.BPOu4[0] === logicalKey,
        "getter should push logical key into BPOu4");

      assertConsistent("inner-frameelement-getter-trap", {
        descriptor: {
          hasGet: typeof desc.get === "function",
          configurable: desc.configurable,
          enumerable: desc.enumerable,
        },
        originalValueType: typeof originalValue,
        pushed: window.BPOu4.slice(),
      });
    } finally {
      if (previousBPOu4 === undefined) delete window.BPOu4; else window.BPOu4 = previousBPOu4;
    }
  `,
});
