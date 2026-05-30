import { basicTest } from "../../testcommon.ts";

// Exact descriptor chain from payload2_lifted.js:11626-11664 and duplicate
// path at 11793-11802:
//
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "deviceMemory")
//   read descriptor.get, label "get deviceMemory"
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "hardwareConcurrency")
//   read descriptor.get, label "get hardwareConcurrency"

export default basicTest({
	name: "cf-navigator-descriptor-memory-hardware",
	js: `
    const props = ["deviceMemory", "hardwareConcurrency"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
        valueType: desc && Object.prototype.hasOwnProperty.call(desc, "value") ? typeof desc.value : undefined,
      };
      if (desc) {
        assert(desc.get === undefined || typeof desc.get === "function",
          prop + " descriptor getter should be function when present");
      }
    }

    assertConsistent("navigator-descriptor-memory-hardware", descriptors);
  `,
});
