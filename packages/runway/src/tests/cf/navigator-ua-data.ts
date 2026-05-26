import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_136953_93 (line 10620): Navigator.prototype.userAgentData descriptor
// p2_func_138755_129 (line 10381): NavigatorUAData.prototype.brands descriptor
// p2_func_139258_95 (line 10227): NavigatorUAData.prototype.mobile descriptor
// p2_func_139521_51 (line 10128-10137): NavigatorUAData.prototype.platform descriptor
// p2_func_134208_23 (line 11378): Navigator.prototype.maxTouchPoints descriptor
//
// Each follows the standard descriptor check pattern:
//   1. getOwnPropertyDescriptor(proto, prop)
//   2. if (!desc) → FAIL
//   3. getter = desc.get → must be function
//   4. getter.toString() must include "get <propName>"

export default basicTest({
  name: "cf-navigator-ua-data",
  js: `
    // Check 1: maxTouchPoints descriptor (p2_func_134208_23)
    const mtpDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints");
    assert(mtpDesc !== undefined,
      "Navigator.prototype.maxTouchPoints should have a descriptor");
    assert(typeof mtpDesc.get === "function",
      "Navigator.prototype.maxTouchPoints should have a function getter");
    assert(mtpDesc.get.toString().indexOf("get maxTouchPoints") !== -1,
      "maxTouchPoints getter should toString as 'get maxTouchPoints'");

    // Check 2: userAgentData descriptor on Navigator (p2_func_136953_93)
    if (typeof NavigatorUAData !== "undefined") {
      const uadDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgentData");
      assert(uadDesc !== undefined,
        "Navigator.prototype.userAgentData should have a descriptor");
      assert(typeof uadDesc.get === "function",
        "Navigator.prototype.userAgentData should have a function getter");

      // Check 3-5: NavigatorUAData.prototype properties
      const uaProto = NavigatorUAData.prototype;
      const uaDataProps = ["platform", "brands", "mobile"];
      for (const prop of uaDataProps) {
        const desc = Object.getOwnPropertyDescriptor(uaProto, prop);
        assert(desc !== undefined,
          "NavigatorUAData.prototype." + prop + " should have a descriptor");
        assert(typeof desc.get === "function",
          "NavigatorUAData.prototype." + prop + " should have a function getter");
        assert(desc.get.toString().indexOf("get " + prop) !== -1,
          "NavigatorUAData.prototype." + prop + " getter should toString as 'get " + prop + "'");
      }

      // Check 6: getHighEntropyValues on NavigatorUAData (p2_func_108643_47)
      assert(typeof uaProto.getHighEntropyValues === "function",
        "NavigatorUAData.prototype.getHighEntropyValues should be a function");
    }
  `,
});