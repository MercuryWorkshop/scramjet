import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted probe:
// internal-cf-reverse/data4/payload2_lifted.js:28227-28346
//   getExtension("EXT_color_buffer_float")
//   getExtension("EXT_color_buffer_half_float")
//   internal formats [33325,33327,34842,33326,33328,34836,35898]
//   → createFramebuffer/bindFramebuffer → renderbufferStorage
//   → framebufferRenderbuffer → checkFramebufferStatus(36160).

export default basicTest({
	name: "cf-webgl-framebuffer",
	js: `
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl2");
		assertConsistent("webgl-framebuffer-context-available", !!gl);

		if (gl) {
			const formats = [33325, 33327, 34842, 33326, 33328, 34836, 35898];
			const extensions = {
				EXT_color_buffer_float: !!gl.getExtension("EXT_color_buffer_float"),
				EXT_color_buffer_half_float: !!gl.getExtension("EXT_color_buffer_half_float"),
			};

			const framebuffer = gl.createFramebuffer();
			assert(framebuffer !== null, "createFramebuffer should return a framebuffer");
			gl.bindFramebuffer(36160, framebuffer);

			const statuses = [];
			for (const internalFormat of formats) {
				const renderbuffer = gl.createRenderbuffer();
				assert(renderbuffer !== null, "createRenderbuffer should return a renderbuffer");
				gl.bindRenderbuffer(36161, renderbuffer);

				let result = null;
				try {
					gl.renderbufferStorage(36161, internalFormat, 4, 4);
					gl.framebufferRenderbuffer(36160, 36064, 36161, renderbuffer);
					result = gl.checkFramebufferStatus(36160) ? 1 : 0;
				} catch (_) {
					result = null;
				}

				statuses.push([internalFormat, result]);
				gl.deleteRenderbuffer(renderbuffer);
			}

			gl.bindFramebuffer(36160, null);
			gl.deleteFramebuffer(framebuffer);

			assertConsistent("webgl-framebuffer-extensions", extensions);
			assertConsistent("webgl-framebuffer-statuses", statuses);
		}
	`,
});
