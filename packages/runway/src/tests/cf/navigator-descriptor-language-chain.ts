import { basicTest } from "../../testcommon.ts";

// Exact descriptor chain from payload2_lifted.js:11292-11352,
// continuations at 11416-11430 and 11493-11507:
//
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "language")
//   read descriptor.get, label "get language"
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "languages")
//   read descriptor.get, label "get languages"
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints")
//   read descriptor.get, label "get maxTouchPoints"

export default basicTest({
	name: "cf-navigator-descriptor-language-chain",
	js: `
    const props = ["language", "languages", "maxTouchPoints"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
        valueType: desc && Object.prototype.hasOwnProperty.call(desc, "value") ? typeof desc.value : undefined,
      };
      assert(desc !== undefined,
        "Navigator.prototype descriptor should exist for " + prop);
    }

    assertConsistent("navigator-descriptor-language-chain", descriptors);
  `,
});
