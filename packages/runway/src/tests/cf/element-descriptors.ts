import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// Chain: Element/DOM property descriptors
// p2_func_140268_223: getOwnPropertyDescriptor(PointerEvent.prototype, "pointerType")
//   → chains to screenX
// p2_func_129651_177: getOwnPropertyDescriptor(MouseEvent.prototype, "screenX")
//   → chains to screenY
// p2_func_130151_159: getOwnPropertyDescriptor(MouseEvent.prototype, "screenY")
//   → chains to appVersion (navigator)
// p2_func_128651_193: getOwnPropertyDescriptor(MouseEvent.prototype, "clientX")
//   → chains to clientY
// p2_func_129151_31: getOwnPropertyDescriptor(MouseEvent.prototype, "clientY")
//   → chains to key
// p2_func_126660_169: getOwnPropertyDescriptor(KeyboardEvent.prototype, "key")
//   → chains to data
// p2_func_127155_135: getOwnPropertyDescriptor(MessageEvent.prototype, "data")
//   → chains to origin
// p2_func_127651_233: getOwnPropertyDescriptor(MessageEvent.prototype, "origin")
//   → chains to source
// p2_func_128151_247: getOwnPropertyDescriptor(MessageEvent.prototype, "source")
//   → chains to next
// p2_func_125363_79: getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
//   → chains to offsetHeight
// p2_func_125143_103: getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
//   → chains to clientHeight
// p2_func_124131_183: getOwnPropertyDescriptor(Element.prototype, "clientHeight")
//   → chains to clientWidth
// p2_func_124638_121: getOwnPropertyDescriptor(Element.prototype, "clientWidth")
//   → chains to visibilityState
// p2_func_123326_119: getOwnPropertyDescriptor(Document.prototype, "visibilityState")
//   → chains to activeElement
// p2_func_122320_135: getOwnPropertyDescriptor(Document.prototype, "activeElement")
//   → chains to hidden
// p2_func_123121_71: getOwnPropertyDescriptor(Document.prototype, "hidden")
//   → chains to next
//
// Control flow for each (exact same as all descriptor checks):
//   1. desc = Object.getOwnPropertyDescriptor(proto, prop)
//   2. if (!desc) → FAIL
//   3. getter = desc.get → must be function
//   4. getter.toString() must include "get <propName>"

export default basicTest({
	name: "cf-element-descriptors",
	js: `
    const checks = [
      // Pointer/Mouse/Keyboard/Message event descriptors
      { proto: MouseEvent.prototype, prop: "screenX" },
      { proto: MouseEvent.prototype, prop: "screenY" },
      { proto: MouseEvent.prototype, prop: "clientX" },
      { proto: MouseEvent.prototype, prop: "clientY" },
      { proto: KeyboardEvent.prototype, prop: "key" },
      { proto: KeyboardEvent.prototype, prop: "code" },
      { proto: MessageEvent.prototype, prop: "data" },
      { proto: MessageEvent.prototype, prop: "origin" },
      { proto: MessageEvent.prototype, prop: "source" },
      // Element layout descriptors
      { proto: HTMLElement.prototype, prop: "offsetWidth" },
      { proto: HTMLElement.prototype, prop: "offsetHeight" },
      { proto: Element.prototype, prop: "clientHeight" },
      { proto: Element.prototype, prop: "clientWidth" },
      // Document descriptors
      { proto: Document.prototype, prop: "visibilityState" },
      { proto: Document.prototype, prop: "hidden" },
    ];

    if (typeof PointerEvent !== "undefined") {
      checks.unshift({ proto: PointerEvent.prototype, prop: "pointerType" });
    }

    for (const { proto, prop } of checks) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      assert(desc !== undefined && desc !== null,
        proto.constructor?.name + ".prototype." + prop + " should have a descriptor");

      const getter = desc.get;
      assert(typeof getter === "function",
        proto.constructor?.name + ".prototype." + prop + " should have a function getter");

      const getterStr = getter.toString();
      assert(getterStr.indexOf("get " + prop) !== -1,
        proto.constructor?.name + ".prototype." + prop + " getter should toString as 'get " + prop + "'");
    }
  `,
});
