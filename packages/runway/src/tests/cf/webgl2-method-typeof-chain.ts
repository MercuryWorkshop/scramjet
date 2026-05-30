import { basicTest } from "../../testcommon.ts";

// Exact WebGL2 method chain from payload2_lifted.js:14585-14609,
// 14725-14763, and 14994-15033:
//
//   WebGL2RenderingContext.prototype.getSupportedExtensions
//   WebGL2RenderingContext.prototype.readPixels
//   WebGL2RenderingContext.prototype.getParameter
//   WebGL2RenderingContext.prototype.getShaderPrecisionFormat
//   WebGL2RenderingContext.prototype.bufferData
//   WebGL2RenderingContext.prototype.getExtension
//
// The VM reads the properties and records typeof; no native-code checks added.

export default basicTest({
	name: "cf-webgl2-method-typeof-chain",
	js: `
    const proto = WebGL2RenderingContext.prototype;
    const observed = {
      constructorType: typeof WebGL2RenderingContext,
      getSupportedExtensions: typeof proto.getSupportedExtensions,
      readPixels: typeof proto.readPixels,
      getParameter: typeof proto.getParameter,
      getShaderPrecisionFormat: typeof proto.getShaderPrecisionFormat,
      bufferData: typeof proto.bufferData,
      getExtension: typeof proto.getExtension,
    };

    for (const [name, valueType] of Object.entries(observed)) {
      assert(valueType === "function", name + " should be function, got: " + valueType);
    }

    assertConsistent("webgl2-method-typeof-chain", observed);
  `,
});
