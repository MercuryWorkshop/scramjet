import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted probe:
// internal-cf-reverse/data4/payload2_lifted.js:24985-25012
//   createElement("canvas") → 1x1 offscreen canvas → getContext("2d")
//   → font = "1px sans-serif" → fillText("🇺🇸", 0, height)
//   → getImageData(0, 0, width, height).data → scan alpha bytes.

export default basicTest({
	name: "cf-canvas-emoji-alpha",
	js: `
		const canvas = document.createElement("canvas");
		canvas.height = 1;
		canvas.width = 1;
		Object.assign(canvas.style, {
			position: "absolute",
			left: "-9999px",
			top: "-9999px",
			visibility: "hidden",
		});

		const ctx = canvas.getContext("2d");
		assert(ctx !== null, "2D canvas context should be available");
		ctx.font = canvas.height + "px sans-serif";
		ctx.fillText("\\uD83C\\uDDFA\\uD83C\\uDDF8", 0, canvas.height);

		const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = image.data;
		let alphaMask = 0;
		for (let i = 3; i < data.length; i += 4) {
			alphaMask = alphaMask || data[i];
		}

		assertConsistent("canvas-emoji-alpha-mask", alphaMask);
	`,
});
