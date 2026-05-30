import { basicTest } from "../../testcommon.ts";

// Exact KeyboardEvent descriptor probes from payload2_lifted.js:12517-12530
// and 13075-13084:
//
//   Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, "key")
//   Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, "code")
//
// The VM labels the getter functions "get key" and "get code".

export default basicTest({
	name: "cf-keyboardevent-descriptor-key-code",
	js: `
    const props = ["key", "code"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
      };
      assert(desc !== undefined,
        "KeyboardEvent.prototype descriptor should exist for " + prop);
      assert(typeof desc.get === "function",
        "KeyboardEvent.prototype " + prop + " getter should be function");
    }

    assertConsistent("keyboardevent-descriptor-key-code", descriptors);
  `,
});
