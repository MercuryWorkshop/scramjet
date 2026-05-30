import { basicTest } from "../../testcommon.ts";

// Exact MessageEvent descriptor cluster from payload2_lifted.js:12543-12606
// and follow-ups around 12699, 12776, 12853:
//
//   MessageEvent.prototype.data   → label "get data"
//   MessageEvent.prototype.origin → label "get origin"
//   MessageEvent.prototype.source → label "get source"

export default basicTest({
	name: "cf-messageevent-descriptor-data-origin-source",
	js: `
    const props = ["data", "origin", "source"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
      };
      assert(desc !== undefined,
        "MessageEvent.prototype descriptor should exist for " + prop);
      assert(typeof desc.get === "function",
        "MessageEvent.prototype " + prop + " getter should be function");
    }

    assertConsistent("messageevent-descriptor-data-origin-source", descriptors);
  `,
});
