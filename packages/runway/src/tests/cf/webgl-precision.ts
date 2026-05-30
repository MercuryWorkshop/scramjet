import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted probe:
// internal-cf-reverse/data4/payload2_lifted.js:31576-31612
//   getParameter(34921/36348/36349)
//   getShaderPrecisionFormat for FRAGMENT_SHADER/VERTEX_SHADER and LOW/MEDIUM/HIGH
//   INT/FLOAT precision constants.

export default basicTest({
	name: "cf-webgl-precision",
	js: `
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		assertConsistent("webgl-precision-context-available", !!gl);

		if (gl) {
			const parameters = [
				gl.getParameter(34921),
				gl.getParameter(36348),
				gl.getParameter(36349),
			];

			const shaderPrecisionTypes = [
				[35632, [36341, 36338, 36336, 36337, 36339, 36340]],
				[35633, [36338, 36341, 36336, 36337, 36339, 36340]],
			];
			const precision = [];

			for (const [shaderType, precisionTypes] of shaderPrecisionTypes) {
				for (const precisionType of precisionTypes) {
					const value = gl.getShaderPrecisionFormat(shaderType, precisionType);
					precision.push([
						shaderType,
						precisionType,
						value ? value.rangeMin : null,
						value ? value.rangeMax : null,
						value ? value.precision : null,
					]);
				}
			}

			assertConsistent("webgl-parameters", parameters);
			assertConsistent("webgl-shader-precision", precision);
		}
	`,
});
