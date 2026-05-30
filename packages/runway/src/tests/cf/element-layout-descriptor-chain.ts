import { basicTest } from "../../testcommon.ts";

// Exact layout descriptor chain from payload2_lifted.js:13055-13143 and
// 13232-13259:
//
//   HTMLElement.prototype.offsetWidth  → label "get offsetWidth"
//   HTMLElement.prototype.offsetHeight → label "get offsetHeight"
//   Element.prototype.clientHeight     → label "get clientHeight"
//   Element.prototype.clientWidth      → label "get clientWidth"

export default basicTest({
	name: "cf-element-layout-descriptor-chain",
	js: `
    const checks = [
      { owner: HTMLElement.prototype, ownerName: "HTMLElement.prototype", prop: "offsetWidth" },
      { owner: HTMLElement.prototype, ownerName: "HTMLElement.prototype", prop: "offsetHeight" },
      { owner: Element.prototype, ownerName: "Element.prototype", prop: "clientHeight" },
      { owner: Element.prototype, ownerName: "Element.prototype", prop: "clientWidth" },
    ];
    const descriptors = {};

    for (const check of checks) {
      const desc = Object.getOwnPropertyDescriptor(check.owner, check.prop);
      const key = check.ownerName + "." + check.prop;
      descriptors[key] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
      };
      assert(desc !== undefined,
        key + " descriptor should exist");
      assert(typeof desc.get === "function",
        key + " getter should be function");
    }

    assertConsistent("element-layout-descriptor-chain", descriptors);
  `,
});
