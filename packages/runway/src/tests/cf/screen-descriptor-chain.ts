import { basicTest } from "../../testcommon.ts";

// Source-backed Screen descriptor chain from payload2_lifted.js:9385-9467,
// 9545-9584, and descriptor hits at 9791, 9812, 9950, 10087:
//
//   Screen.prototype.pixelDepth → label "get pixelDepth"
//   Screen.prototype.width      → label "get width"
//   Screen.prototype.colorDepth → label "get colorDepth"
//   Screen.prototype.height     → label "get height"
//   Screen.prototype.availWidth / availHeight in adjacent descriptor chain

export default basicTest({
	name: "cf-screen-descriptor-chain",
	js: `
    const props = ["pixelDepth", "width", "colorDepth", "height", "availWidth", "availHeight"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
        valueType: desc && Object.prototype.hasOwnProperty.call(desc, "value") ? typeof desc.value : undefined,
      };
      assert(desc !== undefined,
        "Screen.prototype descriptor should exist for " + prop);
    }

    assertConsistent("screen-descriptor-chain", descriptors);
  `,
});
