import { basicTest } from "../../testcommon.ts";

// Exact WebGLRenderingContext method typeof chain from
// payload2_lifted.js:13849-13900:
//
//   window.WebGLRenderingContext.prototype.getParameter
//   window.WebGLRenderingContext.prototype.getShaderPrecisionFormat
//   window.WebGLRenderingContext.prototype.getSupportedExtensions
//   window.WebGLRenderingContext.prototype.readPixels
//
// The lifted output has the same register damage seen in other method typeof
// chains (`typeof reg_17` after property read), but the property reads and
// labels identify the raw method-type observations.

export default basicTest({
	name: "cf-webgl-method-typeof-chain",
	js: `
    const proto = window.WebGLRenderingContext && WebGLRenderingContext.prototype;
    const observed = {
      webglRenderingContextType: typeof window.WebGLRenderingContext,
      getParameter: proto ? typeof proto.getParameter : "missing",
      getShaderPrecisionFormat: proto ? typeof proto.getShaderPrecisionFormat : "missing",
      getSupportedExtensions: proto ? typeof proto.getSupportedExtensions : "missing",
      readPixels: proto ? typeof proto.readPixels : "missing",
    };

    assert(observed.webglRenderingContextType === "function",
      "WebGLRenderingContext should be function, got: " + observed.webglRenderingContextType);
    assert(observed.getParameter === "function",
      "WebGLRenderingContext.prototype.getParameter typeof should be function, got: " + observed.getParameter);
    assert(observed.getShaderPrecisionFormat === "function",
      "WebGLRenderingContext.prototype.getShaderPrecisionFormat typeof should be function, got: " + observed.getShaderPrecisionFormat);
    assert(observed.getSupportedExtensions === "function",
      "WebGLRenderingContext.prototype.getSupportedExtensions typeof should be function, got: " + observed.getSupportedExtensions);
    assert(observed.readPixels === "function",
      "WebGLRenderingContext.prototype.readPixels typeof should be function, got: " + observed.readPixels);

    assertConsistent("webgl-method-typeof-chain", observed);
  `,
});
