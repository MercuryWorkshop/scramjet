import { basicTest } from "../../testcommon.ts";

// Source-backed prototype method typeof chain from payload2_lifted.js:16832-16864
// and adjacent continuation:
//
//   HTMLCanvasElement.prototype.toDataURL → label "toDataURL"
//   HTMLElement.prototype.attachShadow    → label "attachShadow"
//   HTMLElement.prototype.click           → label "click"
//
// The lifted output has register damage at the final typeof (`typeof reg_17`),
// but the literal + property read identify the method being probed.

export default basicTest({
	name: "cf-html-element-method-typeof-chain",
	js: `
    const checks = [
      { owner: HTMLCanvasElement.prototype, ownerName: "HTMLCanvasElement.prototype", prop: "toDataURL" },
      { owner: HTMLElement.prototype, ownerName: "HTMLElement.prototype", prop: "attachShadow" },
      { owner: HTMLElement.prototype, ownerName: "HTMLElement.prototype", prop: "click" },
    ];
    const observed = {};

    for (const check of checks) {
      const value = check.owner[check.prop];
      const type = typeof value;
      observed[check.ownerName + "." + check.prop] = type;
      assert(type === "function",
        check.ownerName + "." + check.prop + " typeof should be function, got: " + type);
    }

    assertConsistent("html-element-method-typeof-chain", observed);
  `,
});
