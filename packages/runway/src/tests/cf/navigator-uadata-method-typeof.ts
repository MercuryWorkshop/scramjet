import { basicTest } from "../../testcommon.ts";

// Exact control flow from payload2_lifted.js:16327-16351:
//
// p2_func_108934_113:
//   1. window.NavigatorUAData
//   2. NavigatorUAData.prototype
//   3. literal "getHighEntropyValues"
//   4. read NavigatorUAData.prototype.getHighEntropyValues
//   5. typeof probe, reported with label "getHighEntropyValues"
//
// p2_func_109356_95:
//   1. window.NavigatorUAData
//   2. NavigatorUAData.prototype
//   3. literal "toJSON"
//   4. read NavigatorUAData.prototype.toJSON
//   5. typeof probe, reported with label "toJSON"

export default basicTest({
	name: "cf-navigator-uadata-method-typeof",
	js: `
    if (typeof NavigatorUAData === "undefined") {
      assertConsistent("navigator-uadata-method-typeof", {
        navigatorUADataType: "undefined",
      });
      pass("NavigatorUAData is absent; source probe has a missing-constructor path");
    } else {
      const proto = NavigatorUAData.prototype;
      const getHighEntropyValuesType = typeof proto.getHighEntropyValues;
      const toJSONType = typeof proto.toJSON;

      assert(getHighEntropyValuesType === "function",
        "NavigatorUAData.prototype.getHighEntropyValues typeof should be function, got: " + getHighEntropyValuesType);
      assert(toJSONType === "function",
        "NavigatorUAData.prototype.toJSON typeof should be function, got: " + toJSONType);

      assertConsistent("navigator-uadata-method-typeof", {
        navigatorUADataType: typeof NavigatorUAData,
        getHighEntropyValuesType,
        toJSONType,
      });
    }
  `,
});
