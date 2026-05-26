import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions:
// - p2_func_130151_159 (MouseEvent.prototype "screenY"), lines 12181-12191
// - p2_func_128651_193 (MouseEvent.prototype "clientX"), lines 12677-12687
// - p2_func_129151_31 (MouseEvent.prototype "clientY"), lines 12551-12561
// - p2_func_126660_169 (KeyboardEvent.prototype "key"), lines 12593-12603
// - p2_func_127155_135 (MessageEvent.prototype "data"), lines 12614-12624
// - p2_func_127651_233 (MessageEvent.prototype "origin"), lines 12635-12645
// - p2_func_128151_247 (MessageEvent.prototype "source"), lines 12656-12666
// - also: KeyboardEvent "code", ~line 12990
//
// Turnstile checks getOwnPropertyDescriptor on various Event prototypes.

export default basicTest({
  name: "cf-event-descriptors",
  js: `
    const checks = [
      { proto: MouseEvent.prototype, prop: "screenY" },
      { proto: MouseEvent.prototype, prop: "screenX" },
      { proto: MouseEvent.prototype, prop: "clientX" },
      { proto: MouseEvent.prototype, prop: "clientY" },
      { proto: KeyboardEvent.prototype, prop: "key" },
      { proto: KeyboardEvent.prototype, prop: "code" },
      { proto: MessageEvent.prototype, prop: "data" },
      { proto: MessageEvent.prototype, prop: "origin" },
      { proto: MessageEvent.prototype, prop: "source" },
    ];
    for (const { proto, prop } of checks) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      assert(!!desc, proto.constructor?.name + ".prototype." + prop + " should have a descriptor");
      if (desc) {
        assert(typeof desc.get === "function",
          proto.constructor?.name + ".prototype." + prop + " should have a getter");
      }
    }
  `,
});