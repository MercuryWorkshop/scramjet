import { basicTest } from "../../testcommon.ts";

// Exact descriptor chain from payload2_lifted.js:10810-10860 and duplicate
// entry at 10945-10953:
//
//   Navigator.prototype.plugins      → label "get plugins"
//   Navigator.prototype.userAgent    → label "get userAgent"
//   Navigator.prototype.userAgentData → label "get userAgentData"

export default basicTest({
	name: "cf-navigator-descriptor-plugins-ua",
	js: `
    const props = ["plugins", "userAgent", "userAgentData"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
        valueType: desc && Object.prototype.hasOwnProperty.call(desc, "value") ? typeof desc.value : undefined,
      };
      if (prop !== "userAgentData") {
        assert(desc !== undefined,
          "Navigator.prototype descriptor should exist for " + prop);
      }
    }

    assertConsistent("navigator-descriptor-plugins-ua", descriptors);
  `,
});
