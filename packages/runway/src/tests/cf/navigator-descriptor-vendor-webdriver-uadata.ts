import { basicTest } from "../../testcommon.ts";

// Source-backed descriptor clusters from payload2_lifted.js:10610-10660 and
// UAData brand/mobile/platform clusters at 10136-10244 and 10389-10468:
//
//   Navigator.prototype.userAgentData
//   Navigator.prototype.vendor
//   Navigator.prototype.webdriver
//   NavigatorUAData.prototype.brands
//   NavigatorUAData.prototype.mobile
//   NavigatorUAData.prototype.platform

export default basicTest({
	name: "cf-navigator-descriptor-vendor-webdriver-uadata",
	js: `
    const navigatorProps = ["userAgentData", "vendor", "webdriver"];
    const navigatorDescriptors = {};

    for (const prop of navigatorProps) {
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      navigatorDescriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
        valueType: desc && Object.prototype.hasOwnProperty.call(desc, "value") ? typeof desc.value : undefined,
      };
    }

    const uaDataDescriptors = {};
    if (typeof NavigatorUAData !== "undefined") {
      for (const prop of ["brands", "mobile", "platform"]) {
        const desc = Object.getOwnPropertyDescriptor(NavigatorUAData.prototype, prop);
        uaDataDescriptors[prop] = {
          exists: !!desc,
          hasGet: !!(desc && desc.get),
          getType: desc && desc.get ? typeof desc.get : undefined,
          valueType: desc && Object.prototype.hasOwnProperty.call(desc, "value") ? typeof desc.value : undefined,
        };
        assert(desc !== undefined,
          "NavigatorUAData.prototype descriptor should exist for " + prop);
      }
    }

    assertConsistent("navigator-descriptor-vendor-webdriver-uadata", {
      navigatorDescriptors,
      navigatorUADataType: typeof NavigatorUAData,
      uaDataDescriptors,
    });
  `,
});
