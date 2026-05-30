import { basicTest } from "../../testcommon.ts";

// Source-backed CanvasRenderingContext2D method typeof probes from
// payload2_lifted.js:19064-19087 and 19720-19744:
//
//   CanvasRenderingContext2D.prototype.getImageData → label "getImageData"
//   CanvasRenderingContext2D.prototype.moveTo       → label "moveTo"
//   CanvasRenderingContext2D.prototype.fillText     → label "fillText"
//   duplicate getImageData path later in the chain

export default basicTest({
	name: "cf-canvas-2d-method-typeof-chain",
	js: `
    const props = ["getImageData", "moveTo", "fillText"];
    const observed = {};

    for (const prop of props) {
      const value = CanvasRenderingContext2D.prototype[prop];
      const type = typeof value;
      observed[prop] = type;
      assert(type === "function",
        "CanvasRenderingContext2D.prototype." + prop + " typeof should be function, got: " + type);
    }

    assertConsistent("canvas-2d-method-typeof-chain", observed);
  `,
});
