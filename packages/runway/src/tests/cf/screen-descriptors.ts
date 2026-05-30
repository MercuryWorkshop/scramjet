import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// Chain: Screen property descriptors
// p2_func_142608_151: getOwnPropertyDescriptor(Screen.prototype, "pixelDepth")
//   → chains to width
// p2_func_143282_247: getOwnPropertyDescriptor(Screen.prototype, "width")
//   → chains to height
// p2_func_142286_191: getOwnPropertyDescriptor(Screen.prototype, "height")
//   → chains to colorDepth
// p2_func_141784_33: getOwnPropertyDescriptor(Screen.prototype, "colorDepth")
//   → chains to availHeight
// p2_func_140778_89: getOwnPropertyDescriptor(Screen.prototype, "availHeight")
//   → chains to availWidth
// p2_func_141282_151: getOwnPropertyDescriptor(Screen.prototype, "availWidth")
//   → chains to next
//
// Control flow for each (same as all descriptor checks):
//   1. desc = Object.getOwnPropertyDescriptor(Screen.prototype, prop)
//   2. if (!desc) → FAIL
//   3. getter = desc.get → must be function
//   4. getter.toString() must include "get <propName>"
//   5. Continue chain

export default basicTest({
	name: "cf-screen-descriptors",
	js: `
    const screenProps = [
      "pixelDepth",
      "width",
      "height",
      "colorDepth",
      "availHeight",
      "availWidth",
    ];

    for (const prop of screenProps) {
      const desc = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
      assert(desc !== undefined && desc !== null,
        "Screen.prototype." + prop + " should have a descriptor");

      const getter = desc.get;
      assert(typeof getter === "function",
        "Screen.prototype." + prop + " should have a function getter");

      const getterStr = getter.toString();
      assert(getterStr.indexOf("get " + prop) !== -1,
        "Screen.prototype." + prop + " getter should toString as 'get " + prop + "'");
    }
  `,
});
