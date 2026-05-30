import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// Chain A: Navigator descriptors
// p2_func_137755_209: getOwnPropertyDescriptor(Navigator.prototype, "vendor")
//   → if desc exists → p2_func_137813_?? (check getter, forward to webdriver)
//   → else → FAIL
// p2_func_138252_15: getOwnPropertyDescriptor(Navigator.prototype, "webdriver")
//   → chains to userAgent
// p2_func_136741_97: getOwnPropertyDescriptor(Navigator.prototype, "userAgent")
//   → chains to hardwareConcurrency
// p2_func_132681_185: getOwnPropertyDescriptor(Navigator.prototype, "hardwareConcurrency")
//   → chains to deviceMemory
// p2_func_131881_93: getOwnPropertyDescriptor(Navigator.prototype, "deviceMemory")
//   → chains to plugins
// p2_func_135951_237: getOwnPropertyDescriptor(Navigator.prototype, "plugins")
//   → chains to mimeTypes
// p2_func_134721_153: getOwnPropertyDescriptor(Navigator.prototype, "mimeTypes")
//   → chains to languages
// p2_func_133705_201: getOwnPropertyDescriptor(Navigator.prototype, "languages")
//   → chains to appVersion
// p2_func_130651_49: getOwnPropertyDescriptor(Navigator.prototype, "appVersion")
//   → chains to connection
// p2_func_131156_175: getOwnPropertyDescriptor(Navigator.prototype, "connection")
//   → chains to cookieEnabled
// p2_func_131661_97: getOwnPropertyDescriptor(Navigator.prototype, "cookieEnabled")
//   → chains to pdfViewerEnabled
// p2_func_135224_87: getOwnPropertyDescriptor(Navigator.prototype, "pdfViewerEnabled")
//   → chains to language
// p2_func_133204_39: getOwnPropertyDescriptor(Navigator.prototype, "language")
//   → chains to next
//
// Each step in the chain does the exact same control flow:
//   1. desc = Object.getOwnPropertyDescriptor(proto, prop)
//   2. if (!desc) → property missing → FAIL path
//   3. getter = desc.get
//   4. if (typeof getter !== "function") → not a native getter → FAIL path
//   5. getterStr = getter.toString()
//   6. if (!getterStr.includes("get " + propName)) → wrong toString → FAIL path
//   7. Continue to next property in chain

export default basicTest({
	name: "cf-navigator-descriptors",
	js: `
    const navigatorProps = [
      "vendor",
      "webdriver",
      "userAgent",
      "hardwareConcurrency",
      "deviceMemory",
      "plugins",
      "mimeTypes",
      "languages",
      "appVersion",
      "connection",
      "cookieEnabled",
      "pdfViewerEnabled",
      "language",
    ];

    for (const prop of navigatorProps) {
      // Step 1: getOwnPropertyDescriptor
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      // Step 2: descriptor must exist
      assert(desc !== undefined && desc !== null,
        "Navigator.prototype." + prop + " should have a descriptor");

      // Step 3: getter must exist and be a function
      const getter = desc.get;
      assert(typeof getter === "function",
        "Navigator.prototype." + prop + " should have a function getter");

      // Step 4: getter.toString() must include "get <propName>"
      const getterStr = getter.toString();
      assert(getterStr.indexOf("get " + prop) !== -1,
        "Navigator.prototype." + prop + " getter should toString as 'get " + prop + "', got: " + getterStr.substring(0, 60));
    }

    // NavigatorUAData properties follow the exact same pattern
    // p2_func_139521_51: platform
    // p2_func_139258_95: mobile
    // p2_func_138755_129: brands
    if (typeof NavigatorUAData !== "undefined") {
      const uaDataProps = ["platform", "mobile", "brands"];
      const uaProto = NavigatorUAData.prototype;
      for (const prop of uaDataProps) {
        const desc = Object.getOwnPropertyDescriptor(uaProto, prop);
        assert(desc !== undefined && desc !== null,
          "NavigatorUAData.prototype." + prop + " should have a descriptor");
        const getter = desc.get;
        assert(typeof getter === "function",
          "NavigatorUAData.prototype." + prop + " should have a function getter");
        const getterStr = getter.toString();
        assert(getterStr.indexOf("get " + prop) !== -1,
          "NavigatorUAData.prototype." + prop + " getter should toString as 'get " + prop + "'");
      }
    }
  `,
});
