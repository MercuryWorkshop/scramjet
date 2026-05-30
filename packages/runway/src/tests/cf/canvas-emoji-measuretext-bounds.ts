import { basicTest } from "../../testcommon.ts";

// Strict metric probe from payload2_lifted.js:24944-25039:
//   canvas width=220 height=40, context.font="16px sans-serif", emoji list from
//   the literal split by "a", measureText each item and inspect
//   actualBoundingBoxAscent, actualBoundingBoxDescent, and width.

export default basicTest({
	name: "cf-canvas-emoji-measuretext-bounds",
	js: `
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 40;
    const context = canvas.getContext("2d");
    assert(context, "2d canvas context should exist");
    context.font = "16px sans-serif";

    const emoji = "😀a🤣a😱a👍a🔥a🚀a🧠a🐶a🏠a☀️".split("a");
    const keys = {};
    let accumulator = 0;
    const metrics = emoji.map((value) => {
      const measured = context.measureText(value);
      const ascent = measured.actualBoundingBoxAscent || 0;
      const descent = measured.actualBoundingBoxDescent || 0;
      const width = measured.width || 0;
      const key = ascent + ":" + descent + ":" + width;
      keys[key] = 1;
      accumulator += (ascent + descent + width) * 0.00001;
      return { value, ascent, descent, width, key };
    });

    const observed = {
      canvas: { width: canvas.width, height: canvas.height },
      font: context.font,
      emoji,
      metrics,
      keys: Object.keys(keys).sort(),
      accumulator,
    };

    assert(observed.canvas.width === 220 && observed.canvas.height === 40, "emoji canvas dimensions mismatch");
    assert(observed.emoji.length === 10, "emoji metric list length mismatch");
    assertConsistent("canvas-emoji-measuretext-bounds", observed);
  `,
});
