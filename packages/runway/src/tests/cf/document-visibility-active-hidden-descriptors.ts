import { basicTest } from "../../testcommon.ts";

// Source-backed Document descriptor probes from payload2_lifted.js:13212-13230
// and adjacent descriptor hits around 13510, 13571, 13592, 13688, 13767:
//
//   Document.prototype.visibilityState → label "get visibilityState"
//   Document.prototype.activeElement   → label "get activeElement"
//   Document.prototype.hidden          → label "get hidden"

export default basicTest({
	name: "cf-document-visibility-active-hidden-descriptors",
	js: `
    const props = ["visibilityState", "activeElement", "hidden"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
      };
      assert(desc !== undefined,
        "Document.prototype descriptor should exist for " + prop);
      assert(typeof desc.get === "function",
        "Document.prototype " + prop + " getter should be function");
    }

    assertConsistent("document-visibility-active-hidden-descriptors", descriptors);
  `,
});
